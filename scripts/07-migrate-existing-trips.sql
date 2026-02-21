-- 07-migrate-existing-trips.sql
-- Migration strategy for existing trips

-- All existing trips without a created_by remain publicly accessible (created_by IS NULL).
-- The RLS policies in 06-add-user-auth.sql already handle this:
--   - Trips with created_by IS NULL can be read/updated/deleted by any authenticated user.
--   - Once a user "claims" a trip, it gets a created_by and proper ownership.

-- Claim function: allows a logged-in user to claim an unclaimed trip
CREATE OR REPLACE FUNCTION claim_trip(p_trip_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only claim if trip has no owner
  UPDATE trips
  SET created_by = auth.uid()
  WHERE id = p_trip_id AND created_by IS NULL;

  -- Add as owner in trip_members if not already there
  INSERT INTO trip_members (trip_id, user_id, role)
  VALUES (p_trip_id, auth.uid(), 'owner')
  ON CONFLICT (trip_id, user_id) DO UPDATE SET role = 'owner';
END;
$$;
