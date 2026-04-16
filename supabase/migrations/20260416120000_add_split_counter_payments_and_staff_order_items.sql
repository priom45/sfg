/*
  # Add split counter payments and staff order item edits

  1. Orders
    - Allow `counter_payment_method = 'split'`
    - Add `online_received_amount` for UPI/scanner counter collections
    - Add `paid_amount` so extra items added after payment only reopen the remaining balance

  2. Staff order edits
    - Add `add_staff_order_item(...)` RPC for chefs/admins to append simple menu items
      to active orders and update totals in one database transaction
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'counter_payment_method'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN counter_payment_method text;
  END IF;

  ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_counter_payment_method_check;

  ALTER TABLE public.orders
    ADD CONSTRAINT orders_counter_payment_method_check
    CHECK (counter_payment_method IN ('cash', 'online', 'split'));

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'cash_received_amount'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN cash_received_amount numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'online_received_amount'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN online_received_amount numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'paid_amount'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN paid_amount numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_cash_received_amount_nonnegative_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_cash_received_amount_nonnegative_check
  CHECK (cash_received_amount IS NULL OR cash_received_amount >= 0);

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_online_received_amount_nonnegative_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_online_received_amount_nonnegative_check
  CHECK (online_received_amount IS NULL OR online_received_amount >= 0);

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_paid_amount_nonnegative_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_paid_amount_nonnegative_check
  CHECK (paid_amount >= 0);

UPDATE public.orders
SET paid_amount = total
WHERE payment_status = 'paid'
  AND COALESCE(paid_amount, 0) = 0;

CREATE OR REPLACE FUNCTION public.add_staff_order_item(
  p_order_id uuid,
  p_menu_item_id uuid,
  p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_menu_item record;
  v_quantity integer;
  v_line_total numeric(10,2);
  v_next_subtotal numeric(10,2);
  v_next_total numeric(10,2);
  v_paid_amount numeric(10,2);
  v_next_payment_status text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('chef', 'admin')
  ) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  v_quantity := GREATEST(COALESCE(p_quantity, 1), 1);

  IF v_quantity > 99 THEN
    RAISE EXCEPTION 'Quantity is too high';
  END IF;

  SELECT id, subtotal, total, payment_status, paid_amount, status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status IN ('cancelled', 'expired', 'delivered') THEN
    RAISE EXCEPTION 'Items cannot be added to this order';
  END IF;

  SELECT id, name, price, is_available
  INTO v_menu_item
  FROM public.menu_items
  WHERE id = p_menu_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Menu item not found';
  END IF;

  IF NOT COALESCE(v_menu_item.is_available, false) THEN
    RAISE EXCEPTION '% is not currently available', v_menu_item.name;
  END IF;

  v_line_total := ROUND((COALESCE(v_menu_item.price, 0) * v_quantity)::numeric, 2);
  v_next_subtotal := ROUND((COALESCE(v_order.subtotal, 0) + v_line_total)::numeric, 2);
  v_next_total := ROUND((COALESCE(v_order.total, 0) + v_line_total)::numeric, 2);
  v_paid_amount := CASE
    WHEN v_order.payment_status = 'paid'
      THEN GREATEST(COALESCE(v_order.paid_amount, v_order.total, 0), COALESCE(v_order.total, 0))
    ELSE COALESCE(v_order.paid_amount, 0)
  END;
  v_next_payment_status := CASE
    WHEN v_order.payment_status = 'paid' AND v_line_total > 0 THEN 'pending'
    ELSE v_order.payment_status
  END;

  INSERT INTO public.order_items (
    order_id,
    menu_item_id,
    item_name,
    quantity,
    unit_price,
    customizations
  )
  VALUES (
    p_order_id,
    p_menu_item_id,
    v_menu_item.name,
    v_quantity,
    v_menu_item.price,
    '[]'::jsonb
  );

  UPDATE public.orders
  SET
    subtotal = v_next_subtotal,
    total = v_next_total,
    payment_status = v_next_payment_status,
    payment_verified_at = CASE
      WHEN v_next_payment_status = 'pending' THEN NULL
      ELSE payment_verified_at
    END,
    paid_amount = v_paid_amount
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'lineTotal', v_line_total,
    'newTotal', v_next_total,
    'paymentStatus', v_next_payment_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_staff_order_item(uuid, uuid, integer) TO authenticated;
