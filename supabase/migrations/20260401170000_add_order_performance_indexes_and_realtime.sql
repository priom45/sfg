/*
  # Reduce order query pressure

  1. Add indexes for the hottest order access patterns
     - customer history by user and time
     - kitchen/admin views by status and time
     - order items by parent order
  2. Publish order_items to Supabase Realtime
     - allows kitchen screens to react to inserts without aggressive polling
*/

CREATE INDEX IF NOT EXISTS orders_user_id_placed_at_idx
  ON public.orders (user_id, placed_at DESC);

CREATE INDEX IF NOT EXISTS orders_status_placed_at_idx
  ON public.orders (status, placed_at DESC);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx
  ON public.order_items (order_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
  END IF;
END $$;
