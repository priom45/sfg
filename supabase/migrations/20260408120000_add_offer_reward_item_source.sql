ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS reward_item_source text NOT NULL DEFAULT 'specific_item';

UPDATE offers
SET reward_item_source = 'specific_item'
WHERE reward_item_source IS NULL;

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_reward_item_source_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_reward_item_source_check
  CHECK (reward_item_source IN ('specific_item', 'qualifying_item'));

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_free_item_reward_required_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_free_item_reward_required_check
  CHECK (
    discount_type <> 'free_item'
    OR reward_item_source = 'qualifying_item'
    OR reward_menu_item_id IS NOT NULL
  );

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_free_item_matching_source_requires_quantity_trigger_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_free_item_matching_source_requires_quantity_trigger_check
  CHECK (
    discount_type <> 'free_item'
    OR reward_item_source <> 'qualifying_item'
    OR trigger_type = 'item_quantity'
  );
