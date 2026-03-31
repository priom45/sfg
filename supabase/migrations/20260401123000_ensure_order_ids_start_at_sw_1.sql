/*
  # Ensure order IDs start at SW-1

  1. Database changes
    - normalizes `order_id_sequence` to start at 1 with a floor of 1
    - syncs the sequence from the highest existing positive `SW-n` order ID
    - keeps future generated order IDs sequential: `SW-1`, `SW-2`, `SW-3`, ...

  2. Notes
    - existing historical order IDs are left unchanged
    - if the only existing order is `SW-0`, the next generated order becomes `SW-1`
*/

CREATE SEQUENCE IF NOT EXISTS public.order_id_sequence
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1;

ALTER SEQUENCE public.order_id_sequence
  MINVALUE 1
  START WITH 1;

DO $$
DECLARE
  max_existing_order_number bigint;
BEGIN
  SELECT COALESCE(
    MAX((substring(order_id FROM '^SW-([0-9]+)$'))::bigint),
    0
  )
  INTO max_existing_order_number
  FROM public.orders
  WHERE substring(order_id FROM '^SW-([0-9]+)$') IS NOT NULL
    AND (substring(order_id FROM '^SW-([0-9]+)$'))::bigint >= 1;

  IF max_existing_order_number >= 1 THEN
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
