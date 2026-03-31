ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_discount_type_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_discount_type_check
  CHECK (discount_type IN ('percentage', 'flat', 'free_addons', 'free_item'));

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS qualifying_category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qualifying_menu_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reward_menu_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reward_item_quantity integer NOT NULL DEFAULT 1;

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_reward_item_quantity_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_reward_item_quantity_check
  CHECK (reward_item_quantity >= 1);

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_free_item_reward_required_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_free_item_reward_required_check
  CHECK (
    discount_type <> 'free_item'
    OR reward_menu_item_id IS NOT NULL
  );

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_free_item_scope_required_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_free_item_scope_required_check
  CHECK (
    discount_type <> 'free_item'
    OR trigger_type <> 'item_quantity'
    OR qualifying_category_id IS NOT NULL
    OR qualifying_menu_item_id IS NOT NULL
  );
