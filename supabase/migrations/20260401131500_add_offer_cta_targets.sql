/*
  # Add offer CTA targets

  1. Database changes
    - adds CTA target type and optional category/product references to offers
    - defaults existing offers to opening the full menu

  2. Notes
    - existing banners keep working as normal menu CTAs
    - category/product link targets become available in admin after this migration
*/

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS cta_target_type text,
  ADD COLUMN IF NOT EXISTS cta_target_category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cta_target_menu_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL;

UPDATE offers
SET cta_target_type = 'menu'
WHERE cta_target_type IS NULL;

ALTER TABLE offers
  ALTER COLUMN cta_target_type SET DEFAULT 'menu';
