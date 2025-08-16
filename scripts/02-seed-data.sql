-- Insert sample trip for testing
INSERT INTO trips (id, name, description) VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'Sample Trip', 'A sample trip for testing the app')
ON CONFLICT (id) DO NOTHING;

-- Insert sample expenses for testing
INSERT INTO expenses (trip_id, description, amount, category, paid_by) VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'Hotel booking', 150.00, 'Accommodation', 'Alice'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Dinner at restaurant', 85.50, 'Food', 'Bob'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Gas for car', 45.00, 'Transportation', 'Alice'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Groceries', 32.75, 'Food', 'Charlie')
ON CONFLICT DO NOTHING;
