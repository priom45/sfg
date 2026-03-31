ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS display_badge text,
  ADD COLUMN IF NOT EXISTS display_reward text,
  ADD COLUMN IF NOT EXISTS is_cart_eligible boolean NOT NULL DEFAULT true;

UPDATE offers
SET is_cart_eligible = true
WHERE is_cart_eligible IS NULL;
