-- Add locations and participants tables, update expenses table structure
-- Add locations table
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add participants table  
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update expenses table structure
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS title VARCHAR(255),
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id),
ADD COLUMN IF NOT EXISTS payers UUID[],
ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS note TEXT;

-- Update existing expenses to have title from description
UPDATE public.expenses SET title = description WHERE title IS NULL;

-- Make title required
ALTER TABLE public.expenses ALTER COLUMN title SET NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_locations_trip_id ON public.locations(trip_id);
CREATE INDEX IF NOT EXISTS idx_participants_trip_id ON public.participants(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_location_id ON public.expenses(location_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);

-- Enable RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for locations
CREATE POLICY "Allow all operations on locations" ON public.locations FOR ALL USING (true);

-- RLS policies for participants  
CREATE POLICY "Allow all operations on participants" ON public.participants FOR ALL USING (true);

-- Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;

-- Update triggers for timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_participants_updated_at BEFORE UPDATE ON public.participants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
