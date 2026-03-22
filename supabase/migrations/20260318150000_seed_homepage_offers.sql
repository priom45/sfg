/*
  # Seed homepage offers for carousel display

  1. Deactivates any previous active offers so the homepage shows a clean set
  2. Upserts four active offers with valid date windows
*/

UPDATE offers
SET is_active = false;

INSERT INTO offers (
  title,
  description,
  code,
  discount_type,
  discount_value,
  min_order,
  valid_from,
  valid_until,
  is_active
) VALUES
  (
    'Weekend Special',
    'Get flat discount on orders above Rs.499',
    'WEEKEND20',
    'percentage',
    20,
    499,
    now() - interval '1 day',
    now() + interval '365 days',
    true
  ),
  (
    'Waffle Combo Deal',
    'Save more when you order two signature waffles together',
    'COMBO149',
    'flat',
    149,
    699,
    now() - interval '1 day',
    now() + interval '365 days',
    true
  ),
  (
    'Shake Add-On Offer',
    'Add any milkshake with your waffle order and save instantly',
    'SHAKE99',
    'flat',
    99,
    399,
    now() - interval '1 day',
    now() + interval '365 days',
    true
  ),
  (
    'Midnight Craving',
    'Late-night sweet craving? Grab a fresh discount before checkout',
    'NIGHT15',
    'percentage',
    15,
    299,
    now() - interval '1 day',
    now() + interval '365 days',
    true
  )
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  min_order = EXCLUDED.min_order,
  valid_from = EXCLUDED.valid_from,
  valid_until = EXCLUDED.valid_until,
  is_active = EXCLUDED.is_active;
