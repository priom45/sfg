/*
  # Add menu item inventory tracking

  1. Menu item changes
    - Add `manual_availability` to preserve the admin's visibility toggle
    - Add `track_inventory` to opt items into quantity tracking
    - Add `available_quantity` for admin-only stock counts
    - Keep `is_available` as the effective customer-facing availability flag

  2. Order changes
    - Add `inventory_reserved` so inventory is only restored once
    - Add `inventory_reservation_items` to store the reserved item quantities per order

  3. Functions
    - `compute_menu_item_availability(...)`
    - `reserve_menu_item_inventory(order_id)`
    - `release_menu_item_inventory(order_id)`

  4. Triggers
    - Sync effective menu availability whenever menu items change
    - Restore reserved inventory automatically when orders become cancelled or expired
*/

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS manual_availability boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS track_inventory boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_quantity integer NOT NULL DEFAULT 0;

ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS menu_items_available_quantity_check;

ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_available_quantity_check
  CHECK (available_quantity >= 0);

UPDATE public.menu_items
SET manual_availability = is_available
WHERE manual_availability IS DISTINCT FROM is_available;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS inventory_reserved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inventory_reservation_items jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.compute_menu_item_availability(
  p_manual_availability boolean,
  p_track_inventory boolean,
  p_available_quantity integer
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_manual_availability, true)
    AND (
      NOT COALESCE(p_track_inventory, false)
      OR GREATEST(COALESCE(p_available_quantity, 0), 0) > 0
    );
$$;

CREATE OR REPLACE FUNCTION public.sync_menu_item_inventory_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.manual_availability := COALESCE(NEW.manual_availability, COALESCE(NEW.is_available, true));
  NEW.track_inventory := COALESCE(NEW.track_inventory, false);
  NEW.available_quantity := GREATEST(COALESCE(NEW.available_quantity, 0), 0);
  NEW.is_available := public.compute_menu_item_availability(
    NEW.manual_availability,
    NEW.track_inventory,
    NEW.available_quantity
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_menu_item_inventory_state_on_write ON public.menu_items;

CREATE TRIGGER sync_menu_item_inventory_state_on_write
BEFORE INSERT OR UPDATE ON public.menu_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_menu_item_inventory_state();

UPDATE public.menu_items
SET is_available = public.compute_menu_item_availability(
  manual_availability,
  track_inventory,
  available_quantity
);

CREATE OR REPLACE FUNCTION public.reserve_menu_item_inventory(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_item record;
  v_reserved_items jsonb := '[]'::jsonb;
BEGIN
  SELECT id, inventory_reserved
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;

  IF COALESCE(v_order.inventory_reserved, false) THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  FOR v_item IN
    WITH aggregated_items AS (
      SELECT
        oi.menu_item_id,
        SUM(GREATEST(oi.quantity, 1))::integer AS requested_quantity
      FROM public.order_items oi
      WHERE oi.order_id = p_order_id
      GROUP BY oi.menu_item_id
    )
    SELECT
      mi.id,
      mi.name,
      mi.track_inventory,
      mi.available_quantity,
      aggregated_items.requested_quantity
    FROM aggregated_items
    JOIN public.menu_items mi
      ON mi.id = aggregated_items.menu_item_id
    ORDER BY mi.id
    FOR UPDATE OF mi
  LOOP
    IF COALESCE(v_item.track_inventory, false) THEN
      IF COALESCE(v_item.available_quantity, 0) < COALESCE(v_item.requested_quantity, 0) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error',
            CASE
              WHEN COALESCE(v_item.available_quantity, 0) <= 0
                THEN format('%s is out of stock right now', v_item.name)
              ELSE format('%s has only %s left right now', v_item.name, v_item.available_quantity)
            END
        );
      END IF;

      v_reserved_items := v_reserved_items || jsonb_build_array(
        jsonb_build_object(
          'menu_item_id', v_item.id,
          'quantity', v_item.requested_quantity
        )
      );
    END IF;
  END LOOP;

  IF v_reserved_items <> '[]'::jsonb THEN
    UPDATE public.menu_items mi
    SET
      available_quantity = GREATEST(0, mi.available_quantity - reserved_items.requested_quantity),
      is_available = public.compute_menu_item_availability(
        mi.manual_availability,
        mi.track_inventory,
        GREATEST(0, mi.available_quantity - reserved_items.requested_quantity)
      )
    FROM (
      SELECT
        (entry->>'menu_item_id')::uuid AS menu_item_id,
        SUM(GREATEST((entry->>'quantity')::integer, 0))::integer AS requested_quantity
      FROM jsonb_array_elements(v_reserved_items) entry
      GROUP BY (entry->>'menu_item_id')::uuid
    ) reserved_items
    WHERE mi.id = reserved_items.menu_item_id;
  END IF;

  UPDATE public.orders
  SET
    inventory_reserved = (v_reserved_items <> '[]'::jsonb),
    inventory_reservation_items = v_reserved_items
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_menu_item_inventory(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
BEGIN
  SELECT id, inventory_reserved, inventory_reservation_items
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  IF NOT COALESCE(v_order.inventory_reserved, false) THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  IF COALESCE(v_order.inventory_reservation_items, '[]'::jsonb) <> '[]'::jsonb THEN
    UPDATE public.menu_items mi
    SET
      available_quantity = GREATEST(0, mi.available_quantity + reserved_items.quantity),
      is_available = public.compute_menu_item_availability(
        mi.manual_availability,
        mi.track_inventory,
        GREATEST(0, mi.available_quantity + reserved_items.quantity)
      )
    FROM (
      SELECT
        (entry->>'menu_item_id')::uuid AS menu_item_id,
        SUM(GREATEST((entry->>'quantity')::integer, 0))::integer AS quantity
      FROM jsonb_array_elements(COALESCE(v_order.inventory_reservation_items, '[]'::jsonb)) entry
      GROUP BY (entry->>'menu_item_id')::uuid
    ) reserved_items
    WHERE mi.id = reserved_items.menu_item_id;
  END IF;

  UPDATE public.orders
  SET
    inventory_reserved = false,
    inventory_reservation_items = '[]'::jsonb
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_pending_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count integer := 0;
BEGIN
  WITH expired_orders AS (
    UPDATE public.orders
    SET status = 'expired'
    WHERE status = 'pending'
      AND payment_status <> 'paid'
      AND expires_at <= now()
    RETURNING 1
  )
  SELECT COUNT(*)
  INTO v_expired_count
  FROM expired_orders;

  RETURN COALESCE(v_expired_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_pending_orders() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.restore_inventory_for_inactive_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.inventory_reserved, false)
    AND NEW.status IN ('cancelled', 'expired')
    AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.release_menu_item_inventory(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restore_inventory_for_inactive_order_on_write ON public.orders;

CREATE TRIGGER restore_inventory_for_inactive_order_on_write
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.restore_inventory_for_inactive_order();
