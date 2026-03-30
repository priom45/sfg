/*
  # Extend customization option preview overrides for item-specific images

  1. Changes
    - Add `menu_item_id` to `customization_option_preview_overrides`
    - Allow either `category_id` or `menu_item_id`
    - Add unique indexes for category-targeted and item-targeted overrides
*/

ALTER TABLE customization_option_preview_overrides
ADD COLUMN IF NOT EXISTS menu_item_id uuid REFERENCES menu_items(id) ON DELETE CASCADE;

ALTER TABLE customization_option_preview_overrides
ALTER COLUMN category_id DROP NOT NULL;

DROP INDEX IF EXISTS customization_option_preview_overrides_group_option_category_idx;

ALTER TABLE customization_option_preview_overrides
DROP CONSTRAINT IF EXISTS customization_option_preview_overrides_single_target_check;

ALTER TABLE customization_option_preview_overrides
ADD CONSTRAINT customization_option_preview_overrides_single_target_check CHECK (
  (category_id IS NOT NULL AND menu_item_id IS NULL)
  OR (category_id IS NULL AND menu_item_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS customization_option_preview_overrides_group_option_category_idx
  ON customization_option_preview_overrides(group_id, option_name, category_id)
  WHERE category_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customization_option_preview_overrides_group_option_item_idx
  ON customization_option_preview_overrides(group_id, option_name, menu_item_id)
  WHERE menu_item_id IS NOT NULL;
