/*
  # Add has_customizations to menu items

  1. Schema
    - Add `has_customizations` to `menu_items`
    - Default to `false`

  2. Data backfill
    - Enable add-ons for sweet waffle and shake categories
    - Leave savory categories without add-ons
*/

ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS has_customizations boolean NOT NULL DEFAULT false;

UPDATE menu_items
SET has_customizations = true
WHERE category_id IN (
  'c0000000-0001-0000-0000-000000000001',
  'c0000000-0001-0000-0000-000000000002',
  'c0000000-0001-0000-0000-000000000004',
  'c0000000-0001-0000-0000-000000000005',
  'c0000000-0001-0000-0000-000000000006'
);
