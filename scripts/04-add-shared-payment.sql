-- Add is_shared_payment column to expenses and ensure numeric amount type
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_shared_payment BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure amount column uses numeric for precision
ALTER TABLE public.expenses
  ALTER COLUMN amount TYPE NUMERIC USING amount::numeric;

-- Basic RLS policy placeholder allowing all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'Allow all operations on expenses'
  ) THEN
    CREATE POLICY "Allow all operations on expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
