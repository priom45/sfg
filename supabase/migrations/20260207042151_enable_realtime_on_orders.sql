/*
  # Enable Realtime on orders table

  1. Changes
    - Add orders table to Supabase Realtime publication
    - This allows customers to get live status updates
*/

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
