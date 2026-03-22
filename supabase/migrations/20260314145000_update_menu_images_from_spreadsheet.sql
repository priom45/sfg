/*
  # Update menu item images from the provided Supreme Waffle spreadsheet

  1. Data Changes
    - Replace existing menu item image URLs with the Cloudinary URLs from `supreme waffle.xlsx`
    - Preserve current pricing, descriptions, and category assignments

  2. Notes
    - The workbook also contains `red velvet waffle`, `sweet dog waffle`, `burger`, and `burger 1+1`
      image rows, but those products do not exist in the current menu seed and the workbook does not
      include their category or price data. They are intentionally not inserted here.
*/

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773388546/classic_waffle_w70izl.png'
WHERE name IN ('Classic Belgian', 'Classic Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773388626/dark_fantasy_waffle_iajnh3.png'
WHERE name IN ('Dark Fantasy Belgian', 'Dark Fantasy Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773388756/white_fantasy_waffle_b8hdgd.png'
WHERE name IN ('White Fantasy Belgian', 'White Fantasy Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391183/milk_fantasy_waffle_umpyxo.png'
WHERE name IN ('Milk Fantasy Belgian', 'Milk Fantasy Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391044/dark_milk_hytgnq.png'
WHERE name IN ('Dark & Milk Belgian', 'Dark & Milk Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391053/dark_white_ggjjxz.png'
WHERE name IN ('Dark & White Belgian', 'Dark & White Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391074/triple_chocolate_hkkygm.png'
WHERE name IN ('Triple Chocolate Belgian', 'Triple Chocolate Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391268/crunchy_oreo_z5kehx.png'
WHERE name IN ('Crunchy Oreo Belgian', 'Crunchy Oreo Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391310/kitkat_waffle_xrfoan.png'
WHERE name IN ('KitKat Belgian', 'KitKat Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391357/snickers_waffle_bdd9zl.png'
WHERE name IN ('Snickers Belgian', 'Snickers Stick');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391442/hot_dog_waffle_ts7f5c.png'
WHERE name = 'Hot Dog Waffle';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391485/french_fries_lqgnib.png'
WHERE name IN (
  'French Fries - Regular',
  'French Fries - Medium',
  'French Fries - Large',
  'Peri Peri Fries - Regular',
  'Peri Peri Fries - Medium',
  'Peri Peri Fries - Large'
);

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391666/fried_momos_ouefsr.png'
WHERE name IN ('Fried Momos - 4 pcs', 'Fried Momos - 6 pcs', 'Fried Momos - 8 pcs');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391675/kurkure_momos_yqhjto.png'
WHERE name IN ('Kurkure Momos - 4 pcs', 'Kurkure Momos - 6 pcs', 'Kurkure Momos - 8 pcs');

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391702/small_platter_oulf5j.png'
WHERE name = 'Momos Platter - Regular';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391712/med_platter_vrgf3u.png'
WHERE name = 'Momos Platter - Medium';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391720/large_platter_g8y7he.png'
WHERE name = 'Momos Platter - Large';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391773/nuggets_cilfj0.png'
WHERE name = 'Chicken Nuggets';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773391778/chicken_popcorn_bjufdx.png'
WHERE name = 'Chicken Popcorn';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392170/vanila_ouln1u.png'
WHERE name = 'Vanilla Milkshake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392170/vanila_ouln1u.png'
WHERE name = 'Vanilla Thick Shake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392173/chocolate_xwvnae.png'
WHERE name = 'Chocolate Milkshake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392173/chocolate_xwvnae.png'
WHERE name = 'Chocolate Thick Shake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392182/oreo_uc5lid.png'
WHERE name = 'Oreo Milkshake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392182/oreo_uc5lid.png'
WHERE name = 'Oreo Thick Shake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392189/kitkat_r6axta.png'
WHERE name = 'KitKat Milkshake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392189/kitkat_r6axta.png'
WHERE name = 'KitKat Thick Shake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392189/kitkat_r6axta.png'
WHERE name = 'Dark Fantasy Milkshake';

UPDATE menu_items
SET image_url = 'https://res.cloudinary.com/dnld18j0c/image/upload/v1773392189/kitkat_r6axta.png'
WHERE name = 'Dark Fantasy Thick Shake';
