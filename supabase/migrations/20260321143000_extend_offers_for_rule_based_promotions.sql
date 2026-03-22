ALTER TABLE offers
  ALTER COLUMN code DROP NOT NULL;

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_discount_type_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_discount_type_check
  CHECK (discount_type IN ('percentage', 'flat', 'free_addons'));

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS offer_mode text NOT NULL DEFAULT 'coupon',
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'min_order',
  ADD COLUMN IF NOT EXISTS required_item_quantity integer;

UPDATE offers
SET
  offer_mode = COALESCE(offer_mode, 'coupon'),
  trigger_type = COALESCE(trigger_type, 'min_order')
WHERE offer_mode IS NULL OR trigger_type IS NULL;

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_offer_mode_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_offer_mode_check
  CHECK (offer_mode IN ('coupon', 'automatic'));

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_trigger_type_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_trigger_type_check
  CHECK (trigger_type IN ('min_order', 'item_quantity'));

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_required_item_quantity_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_required_item_quantity_check
  CHECK (required_item_quantity IS NULL OR required_item_quantity >= 1);

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_coupon_code_required_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_coupon_code_required_check
  CHECK (
    offer_mode = 'automatic'
    OR (code IS NOT NULL AND btrim(code) <> '')
  );
