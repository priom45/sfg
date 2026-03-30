/*
  # Make order IDs sequential

  1. Database changes
    - creates `order_id_sequence`
    - updates `generate_order_id()` to return `SW-1`, `SW-2`, `SW-3`, ...
    - continues from the highest existing numeric order ID

  2. Notes
    - existing order IDs stay unchanged
    - new orders stop using random zero-padded IDs
*/

CREATE SEQUENCE IF NOT EXISTS public.order_id_sequence
  AS bigint
  START WITH 1
  INCREMENT BY 1;

DO $$
DECLARE
  max_existing_order_number bigint;
BEGIN
  SELECT COALESCE(MAX((substring(order_id FROM '^SW-([0-9]+)$'))::bigint), 0)
  INTO max_existing_order_number
  FROM public.orders;

  IF max_existing_order_number > 0 THEN
    PERFORM setval('public.order_id_sequence', max_existing_order_number, true);
  ELSE
    PERFORM setval('public.order_id_sequence', 1, false);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.generate_order_id()
RETURNS text AS $$
BEGIN
  RETURN 'SW-' || nextval('public.order_id_sequence')::text;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.orders
  ALTER COLUMN order_id SET DEFAULT public.generate_order_id();
