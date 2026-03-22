/*
  # Replace entire menu with The Supreme Waffel actual menu

  1. Data Changes
    - Delete all existing menu_items
    - Delete all existing categories
    - Delete all existing customization_options and customization_groups
    - Insert 9 new categories:
      - Belgian Waffles, Stick Waffles, Hot Dog Waffle, Cone Waffles,
        Milkshakes, Thick Shakes, Fries, Chicken Momos, Chicken Snacks
    - Insert all menu items with correct prices
    - Insert updated customization groups (Base, Topping, Drizzle)

  2. Notes
    - All waffles are vegetarian
    - Momos and Hot Dog are non-veg
    - Chicken Snacks are non-veg
    - Prices match the official The Supreme Waffel menu
*/

-- Clear existing data (no orders exist)
DELETE FROM customization_options;
DELETE FROM customization_groups;
DELETE FROM menu_items;
DELETE FROM categories;

-- Insert new categories
INSERT INTO categories (id, name, slug, image_url, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000001', 'Belgian Waffles', 'belgian-waffles', 'https://images.pexels.com/photos/2280545/pexels-photo-2280545.jpeg?auto=compress&cs=tinysrgb&w=400', 1),
  ('c0000000-0001-0000-0000-000000000002', 'Stick Waffles', 'stick-waffles', 'https://images.pexels.com/photos/5765/food-sweet-cookies-dessert.jpg?auto=compress&cs=tinysrgb&w=400', 2),
  ('c0000000-0001-0000-0000-000000000003', 'Hot Dog Waffle', 'hot-dog-waffle', 'https://images.pexels.com/photos/4518843/pexels-photo-4518843.jpeg?auto=compress&cs=tinysrgb&w=400', 3),
  ('c0000000-0001-0000-0000-000000000004', 'Cone Waffles', 'cone-waffles', 'https://images.pexels.com/photos/1343504/pexels-photo-1343504.jpeg?auto=compress&cs=tinysrgb&w=400', 4),
  ('c0000000-0001-0000-0000-000000000005', 'Milkshakes', 'milkshakes', 'https://images.pexels.com/photos/3727250/pexels-photo-3727250.jpeg?auto=compress&cs=tinysrgb&w=400', 5),
  ('c0000000-0001-0000-0000-000000000006', 'Thick Shakes', 'thick-shakes', 'https://images.pexels.com/photos/3625372/pexels-photo-3625372.jpeg?auto=compress&cs=tinysrgb&w=400', 6),
  ('c0000000-0001-0000-0000-000000000007', 'Fries', 'fries', 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=400', 7),
  ('c0000000-0001-0000-0000-000000000008', 'Chicken Momos', 'chicken-momos', 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 8),
  ('c0000000-0001-0000-0000-000000000009', 'Chicken Snacks', 'chicken-snacks', 'https://images.pexels.com/photos/6210876/pexels-photo-6210876.jpeg?auto=compress&cs=tinysrgb&w=400', 9);

-- BELGIAN WAFFLES (Regular base)
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000001', 'Classic Belgian', 'Classic vanilla belgian waffle', 49, 'https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.2, true, true, 1),
  ('c0000000-0001-0000-0000-000000000001', 'Dark Fantasy Belgian', 'Rich dark chocolate belgian waffle', 79, 'https://images.pexels.com/photos/2373520/pexels-photo-2373520.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 2),
  ('c0000000-0001-0000-0000-000000000001', 'White Fantasy Belgian', 'Creamy white chocolate belgian waffle', 79, 'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.4, true, true, 3),
  ('c0000000-0001-0000-0000-000000000001', 'Milk Fantasy Belgian', 'Smooth milk chocolate belgian waffle', 79, 'https://images.pexels.com/photos/2067396/pexels-photo-2067396.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.4, true, true, 4),
  ('c0000000-0001-0000-0000-000000000001', 'Dark & Milk Belgian', 'Dark and milk chocolate combo', 89, 'https://images.pexels.com/photos/1055270/pexels-photo-1055270.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.6, true, true, 5),
  ('c0000000-0001-0000-0000-000000000001', 'Dark & White Belgian', 'Dark and white chocolate combo', 89, 'https://images.pexels.com/photos/2280545/pexels-photo-2280545.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.6, true, true, 6),
  ('c0000000-0001-0000-0000-000000000001', 'Triple Chocolate Belgian', 'All three chocolates in one waffle', 109, 'https://images.pexels.com/photos/2144200/pexels-photo-2144200.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.8, true, true, 7),
  ('c0000000-0001-0000-0000-000000000001', 'Crunchy Oreo Belgian', 'Loaded with crushed Oreo cookies', 129, 'https://images.pexels.com/photos/1351238/pexels-photo-1351238.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.7, true, true, 8),
  ('c0000000-0001-0000-0000-000000000001', 'KitKat Belgian', 'Topped with KitKat chunks', 129, 'https://images.pexels.com/photos/2541310/pexels-photo-2541310.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.7, true, true, 9),
  ('c0000000-0001-0000-0000-000000000001', 'Nutella Belgian', 'Generous Nutella spread', 139, 'https://images.pexels.com/photos/3026804/pexels-photo-3026804.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.9, true, true, 10),
  ('c0000000-0001-0000-0000-000000000001', 'Snickers Belgian', 'Loaded with Snickers pieces', 149, 'https://images.pexels.com/photos/3185509/pexels-photo-3185509.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.8, true, true, 11);

-- STICK WAFFLES
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000002', 'Classic Stick', 'Classic vanilla stick waffle', 59, 'https://images.pexels.com/photos/5765/food-sweet-cookies-dessert.jpg?auto=compress&cs=tinysrgb&w=400', 5, 4.2, true, true, 1),
  ('c0000000-0001-0000-0000-000000000002', 'Dark Fantasy Stick', 'Rich dark chocolate stick waffle', 89, 'https://images.pexels.com/photos/2373520/pexels-photo-2373520.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 2),
  ('c0000000-0001-0000-0000-000000000002', 'White Fantasy Stick', 'Creamy white chocolate stick waffle', 89, 'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.4, true, true, 3),
  ('c0000000-0001-0000-0000-000000000002', 'Milk Fantasy Stick', 'Smooth milk chocolate stick waffle', 89, 'https://images.pexels.com/photos/2067396/pexels-photo-2067396.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.4, true, true, 4),
  ('c0000000-0001-0000-0000-000000000002', 'Dark & Milk Stick', 'Dark and milk chocolate combo stick', 99, 'https://images.pexels.com/photos/1055270/pexels-photo-1055270.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.6, true, true, 5),
  ('c0000000-0001-0000-0000-000000000002', 'Dark & White Stick', 'Dark and white chocolate combo stick', 99, 'https://images.pexels.com/photos/2280545/pexels-photo-2280545.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.6, true, true, 6),
  ('c0000000-0001-0000-0000-000000000002', 'Triple Chocolate Stick', 'All three chocolates stick waffle', 119, 'https://images.pexels.com/photos/2144200/pexels-photo-2144200.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.8, true, true, 7),
  ('c0000000-0001-0000-0000-000000000002', 'Crunchy Oreo Stick', 'Loaded with Oreo cookies stick', 139, 'https://images.pexels.com/photos/1351238/pexels-photo-1351238.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.7, true, true, 8),
  ('c0000000-0001-0000-0000-000000000002', 'KitKat Stick', 'KitKat chunks on stick waffle', 139, 'https://images.pexels.com/photos/2541310/pexels-photo-2541310.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.7, true, true, 9),
  ('c0000000-0001-0000-0000-000000000002', 'Nutella Stick', 'Nutella spread stick waffle', 149, 'https://images.pexels.com/photos/3026804/pexels-photo-3026804.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.9, true, true, 10),
  ('c0000000-0001-0000-0000-000000000002', 'Snickers Stick', 'Snickers loaded stick waffle', 159, 'https://images.pexels.com/photos/3185509/pexels-photo-3185509.jpeg?auto=compress&cs=tinysrgb&w=400', 7, 4.8, true, true, 11);

-- HOT DOG WAFFLE
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000003', 'Hot Dog Waffle', 'Waffle wrapped chicken sausage', 189, 'https://images.pexels.com/photos/4518843/pexels-photo-4518843.jpeg?auto=compress&cs=tinysrgb&w=400', 8, 4.6, false, true, 1);

-- CONE WAFFLES
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000004', 'Vanilla Cone Waffle', 'Waffle cone with vanilla ice cream', 59, 'https://images.pexels.com/photos/1343504/pexels-photo-1343504.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.3, true, true, 1),
  ('c0000000-0001-0000-0000-000000000004', 'Chocolate Cone Waffle', 'Waffle cone with chocolate ice cream', 69, 'https://images.pexels.com/photos/3625372/pexels-photo-3625372.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 2),
  ('c0000000-0001-0000-0000-000000000004', 'Black Currant Cone Waffle', 'Waffle cone with black currant ice cream', 89, 'https://images.pexels.com/photos/1352296/pexels-photo-1352296.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.4, true, true, 3),
  ('c0000000-0001-0000-0000-000000000004', 'Black Forest Cone Waffle', 'Waffle cone with black forest ice cream', 89, 'https://images.pexels.com/photos/1362534/pexels-photo-1362534.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 4),
  ('c0000000-0001-0000-0000-000000000004', 'Choco Brownie Cone Waffle', 'Waffle cone with choco brownie ice cream', 99, 'https://images.pexels.com/photos/2144112/pexels-photo-2144112.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.7, true, true, 5);

-- MILKSHAKES
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000005', 'Vanilla Milkshake', 'Creamy vanilla milkshake', 79, 'https://images.pexels.com/photos/3727250/pexels-photo-3727250.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.2, true, true, 1),
  ('c0000000-0001-0000-0000-000000000005', 'Chocolate Milkshake', 'Rich chocolate milkshake', 89, 'https://images.pexels.com/photos/3026810/pexels-photo-3026810.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 2),
  ('c0000000-0001-0000-0000-000000000005', 'Oreo Milkshake', 'Oreo cookie milkshake', 99, 'https://images.pexels.com/photos/3727249/pexels-photo-3727249.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.6, true, true, 3),
  ('c0000000-0001-0000-0000-000000000005', 'KitKat Milkshake', 'KitKat blended milkshake', 99, 'https://images.pexels.com/photos/2551177/pexels-photo-2551177.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 4),
  ('c0000000-0001-0000-0000-000000000005', 'Dark Fantasy Milkshake', 'Dark Fantasy cookie milkshake', 109, 'https://images.pexels.com/photos/3625372/pexels-photo-3625372.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.7, true, true, 5);

-- THICK SHAKES
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000006', 'Vanilla Thick Shake', 'Thick creamy vanilla shake', 89, 'https://images.pexels.com/photos/3727250/pexels-photo-3727250.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.3, true, true, 1),
  ('c0000000-0001-0000-0000-000000000006', 'Chocolate Thick Shake', 'Thick rich chocolate shake', 99, 'https://images.pexels.com/photos/3026810/pexels-photo-3026810.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.6, true, true, 2),
  ('c0000000-0001-0000-0000-000000000006', 'Oreo Thick Shake', 'Thick Oreo cookie shake', 109, 'https://images.pexels.com/photos/3727249/pexels-photo-3727249.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.7, true, true, 3),
  ('c0000000-0001-0000-0000-000000000006', 'KitKat Thick Shake', 'Thick KitKat blended shake', 109, 'https://images.pexels.com/photos/2551177/pexels-photo-2551177.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.6, true, true, 4),
  ('c0000000-0001-0000-0000-000000000006', 'Dark Fantasy Thick Shake', 'Thick Dark Fantasy cookie shake', 119, 'https://images.pexels.com/photos/3625372/pexels-photo-3625372.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.8, true, true, 5);

-- FRIES
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000007', 'French Fries - Regular', 'Crispy french fries (80g)', 49, 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.3, true, true, 1),
  ('c0000000-0001-0000-0000-000000000007', 'French Fries - Medium', 'Crispy french fries (110g)', 89, 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.3, true, true, 2),
  ('c0000000-0001-0000-0000-000000000007', 'French Fries - Large', 'Crispy french fries (160g)', 129, 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.3, true, true, 3),
  ('c0000000-0001-0000-0000-000000000007', 'Peri Peri Fries - Regular', 'Spicy peri peri fries (80g)', 59, 'https://images.pexels.com/photos/1893555/pexels-photo-1893555.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 4),
  ('c0000000-0001-0000-0000-000000000007', 'Peri Peri Fries - Medium', 'Spicy peri peri fries (110g)', 99, 'https://images.pexels.com/photos/1893555/pexels-photo-1893555.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 5),
  ('c0000000-0001-0000-0000-000000000007', 'Peri Peri Fries - Large', 'Spicy peri peri fries (160g)', 129, 'https://images.pexels.com/photos/1893555/pexels-photo-1893555.jpeg?auto=compress&cs=tinysrgb&w=400', 5, 4.5, true, true, 6);

-- CHICKEN MOMOS
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000008', 'Schezwan Momos - 4 pcs', 'Spicy schezwan chicken momos', 79, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 8, 4.5, false, true, 1),
  ('c0000000-0001-0000-0000-000000000008', 'Schezwan Momos - 6 pcs', 'Spicy schezwan chicken momos', 99, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 10, 4.5, false, true, 2),
  ('c0000000-0001-0000-0000-000000000008', 'Schezwan Momos - 8 pcs', 'Spicy schezwan chicken momos', 119, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 12, 4.5, false, true, 3),
  ('c0000000-0001-0000-0000-000000000008', 'Fried Momos - 4 pcs', 'Crispy fried chicken momos', 69, 'https://images.pexels.com/photos/6210876/pexels-photo-6210876.jpeg?auto=compress&cs=tinysrgb&w=400', 8, 4.4, false, true, 4),
  ('c0000000-0001-0000-0000-000000000008', 'Fried Momos - 6 pcs', 'Crispy fried chicken momos', 89, 'https://images.pexels.com/photos/6210876/pexels-photo-6210876.jpeg?auto=compress&cs=tinysrgb&w=400', 10, 4.4, false, true, 5),
  ('c0000000-0001-0000-0000-000000000008', 'Fried Momos - 8 pcs', 'Crispy fried chicken momos', 109, 'https://images.pexels.com/photos/6210876/pexels-photo-6210876.jpeg?auto=compress&cs=tinysrgb&w=400', 12, 4.4, false, true, 6),
  ('c0000000-0001-0000-0000-000000000008', 'Kurkure Momos - 4 pcs', 'Crunchy kurkure coated chicken momos', 89, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 8, 4.6, false, true, 7),
  ('c0000000-0001-0000-0000-000000000008', 'Kurkure Momos - 6 pcs', 'Crunchy kurkure coated chicken momos', 109, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 10, 4.6, false, true, 8),
  ('c0000000-0001-0000-0000-000000000008', 'Kurkure Momos - 8 pcs', 'Crunchy kurkure coated chicken momos', 129, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 12, 4.6, false, true, 9),
  ('c0000000-0001-0000-0000-000000000008', 'Momos Platter - Regular', '6 pcs (2 Schezwan + 2 Fried + 2 Kurkure)', 109, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 12, 4.7, false, true, 10),
  ('c0000000-0001-0000-0000-000000000008', 'Momos Platter - Medium', '8 pcs (2 Schezwan + 4 Fried + 2 Kurkure)', 129, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 14, 4.7, false, true, 11),
  ('c0000000-0001-0000-0000-000000000008', 'Momos Platter - Large', '10 pcs (4 Fried + 4 Kurkure + 2 Schezwan)', 149, 'https://images.pexels.com/photos/7363671/pexels-photo-7363671.jpeg?auto=compress&cs=tinysrgb&w=400', 16, 4.8, false, true, 12);

-- CHICKEN SNACKS
INSERT INTO menu_items (category_id, name, description, price, image_url, prep_time, rating, is_veg, is_available, display_order) VALUES
  ('c0000000-0001-0000-0000-000000000009', 'Chicken Nuggets', 'Crispy chicken nuggets (8 pcs)', 99, 'https://images.pexels.com/photos/6210876/pexels-photo-6210876.jpeg?auto=compress&cs=tinysrgb&w=400', 8, 4.4, false, true, 1),
  ('c0000000-0001-0000-0000-000000000009', 'Chicken Popcorn', 'Bite-sized crispy chicken popcorn', 149, 'https://images.pexels.com/photos/60616/fried-chicken-chicken-fried-crunchy-60616.jpeg?auto=compress&cs=tinysrgb&w=400', 8, 4.6, false, true, 2);

-- CUSTOMIZATION GROUPS
INSERT INTO customization_groups (id, name, selection_type, is_required, display_order) VALUES
  ('d0000000-0001-0000-0000-000000000001', 'Base', 'single', false, 1),
  ('d0000000-0001-0000-0000-000000000002', 'Topping', 'multi', false, 2),
  ('d0000000-0001-0000-0000-000000000003', 'Drizzle', 'single', false, 3);

-- CUSTOMIZATION OPTIONS
INSERT INTO customization_options (group_id, name, price, is_available, display_order) VALUES
  -- Base options
  ('d0000000-0001-0000-0000-000000000001', 'Regular (Vanilla)', 0, true, 1),
  ('d0000000-0001-0000-0000-000000000001', 'Choco (Chocolate)', 0, true, 2),
  -- Topping options
  ('d0000000-0001-0000-0000-000000000002', 'Whipped Cream', 30, true, 1),
  ('d0000000-0001-0000-0000-000000000002', 'Chocolate Chips', 40, true, 2),
  ('d0000000-0001-0000-0000-000000000002', 'Crushed Oreo', 40, true, 3),
  ('d0000000-0001-0000-0000-000000000002', 'Fresh Fruits', 50, true, 4),
  ('d0000000-0001-0000-0000-000000000002', 'Chopped Nuts', 35, true, 5),
  -- Drizzle options
  ('d0000000-0001-0000-0000-000000000003', 'Chocolate Sauce', 25, true, 1),
  ('d0000000-0001-0000-0000-000000000003', 'Caramel Sauce', 25, true, 2),
  ('d0000000-0001-0000-0000-000000000003', 'Maple Syrup', 20, true, 3);