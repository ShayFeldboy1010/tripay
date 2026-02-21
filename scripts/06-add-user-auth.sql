-- 06-add-user-auth.sql
-- Adds user authentication support to TripPay

-- 1. Add created_by column to trips (nullable for existing trips)
ALTER TABLE trips ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 2. Create trip_members junction table
CREATE TABLE IF NOT EXISTS trip_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

-- 3. Enable RLS on trip_members
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_trips_created_by ON trips(created_by);
CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members(user_id);

-- 5. Enable realtime for trip_members
ALTER PUBLICATION supabase_realtime ADD TABLE trip_members;

-- 6. RLS Policies for trips
-- Drop existing open policies
DROP POLICY IF EXISTS "Allow all operations on trips" ON trips;
DROP POLICY IF EXISTS "Enable read for all users" ON trips;
DROP POLICY IF EXISTS "Enable insert for all users" ON trips;
DROP POLICY IF EXISTS "Enable update for all users" ON trips;
DROP POLICY IF EXISTS "Enable delete for all users" ON trips;

-- Authenticated users can create trips
CREATE POLICY "Authenticated users can create trips"
  ON trips FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trip members can read trips
CREATE POLICY "Trip members can read trips"
  ON trips FOR SELECT
  USING (
    created_by = auth.uid()
    OR id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())
    OR created_by IS NULL  -- Legacy trips remain publicly accessible
  );

-- Owner can update trips
CREATE POLICY "Trip owner or member can update trips"
  ON trips FOR UPDATE
  USING (
    created_by = auth.uid()
    OR id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())
    OR created_by IS NULL
  );

-- Only owner can delete trips
CREATE POLICY "Trip owner can delete trips"
  ON trips FOR DELETE
  USING (
    created_by = auth.uid()
    OR created_by IS NULL
  );

-- 7. RLS Policies for trip_members
CREATE POLICY "Members can view trip members"
  ON trip_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can join trips"
  ON trip_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave trips"
  ON trip_members FOR DELETE
  USING (user_id = auth.uid());

-- 8. RLS Policies for expenses (update to use trip membership)
DROP POLICY IF EXISTS "Allow all operations on expenses" ON expenses;
DROP POLICY IF EXISTS "Enable read for all users" ON expenses;
DROP POLICY IF EXISTS "Enable insert for all users" ON expenses;
DROP POLICY IF EXISTS "Enable update for all users" ON expenses;
DROP POLICY IF EXISTS "Enable delete for all users" ON expenses;

CREATE POLICY "Trip members can read expenses"
  ON expenses FOR SELECT
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE created_by = auth.uid() OR created_by IS NULL
      UNION
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can create expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips WHERE created_by = auth.uid() OR created_by IS NULL
      UNION
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update expenses"
  ON expenses FOR UPDATE
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE created_by = auth.uid() OR created_by IS NULL
      UNION
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can delete expenses"
  ON expenses FOR DELETE
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE created_by = auth.uid() OR created_by IS NULL
      UNION
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

-- 9. RLS Policies for participants
DROP POLICY IF EXISTS "Allow all operations on participants" ON participants;
DROP POLICY IF EXISTS "Enable read for all users" ON participants;
DROP POLICY IF EXISTS "Enable insert for all users" ON participants;
DROP POLICY IF EXISTS "Enable update for all users" ON participants;
DROP POLICY IF EXISTS "Enable delete for all users" ON participants;

CREATE POLICY "Trip members can read participants"
  ON participants FOR SELECT
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE created_by = auth.uid() OR created_by IS NULL
      UNION
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can manage participants"
  ON participants FOR INSERT
  TO authenticated
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips WHERE created_by = auth.uid() OR created_by IS NULL
      UNION
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update participants"
  ON participants FOR UPDATE
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE created_by = auth.uid() OR created_by IS NULL
      UNION
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can delete participants"
  ON participants FOR DELETE
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE created_by = auth.uid() OR created_by IS NULL
      UNION
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

-- 10. RLS Policies for locations
DROP POLICY IF EXISTS "Allow all operations on locations" ON locations;
DROP POLICY IF EXISTS "Enable read for all users" ON locations;
DROP POLICY IF EXISTS "Enable insert for all users" ON locations;
DROP POLICY IF EXISTS "Enable update for all users" ON locations;
DROP POLICY IF EXISTS "Enable delete for all users" ON locations;

CREATE POLICY "Trip members can read locations"
  ON locations FOR SELECT
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE created_by = auth.uid() OR created_by IS NULL
      UNION
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can manage locations"
  ON locations FOR INSERT
  TO authenticated
  WITH CHECK (
    trip_id IN (
      SELECT id FROM trips WHERE created_by = auth.uid() OR created_by IS NULL
      UNION
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update locations"
  ON locations FOR UPDATE
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE created_by = auth.uid() OR created_by IS NULL
      UNION
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can delete locations"
  ON locations FOR DELETE
  USING (
    trip_id IN (
      SELECT id FROM trips WHERE created_by = auth.uid() OR created_by IS NULL
      UNION
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );
