-- Add location column to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS location TEXT;

-- Create settings table for managing payers
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  payers TEXT[] DEFAULT ARRAY['Me', 'Partner'],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on settings table
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policy for settings (allow all operations since we're using Trip ID for access control)
CREATE POLICY "Allow all operations on settings" ON settings FOR ALL USING (true);

-- Enable real-time for settings
ALTER PUBLICATION supabase_realtime ADD TABLE settings;

-- Update existing expenses to have default location if missing
UPDATE expenses SET location = 'Unknown Location' WHERE location IS NULL OR location = '';

-- Make location required going forward
ALTER TABLE expenses ALTER COLUMN location SET NOT NULL;

-- Update trigger for expenses updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
