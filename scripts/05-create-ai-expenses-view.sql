-- Normalized projection of expenses data for the AI chat feature
--
-- This view exposes the columns expected by the NL2SQL pipeline without
-- requiring changes to the primary `expenses` table that powers the UI.
-- It safely extracts optional metadata (like the currency stored in the
-- JSON `note` column) and falls back to sensible defaults so queries will
-- not fail when values are missing.

-- Helper to parse JSON blobs without raising errors when the payload is
-- empty or malformed.
CREATE OR REPLACE FUNCTION public.try_parse_jsonb(input text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  payload jsonb;
BEGIN
  IF input IS NULL OR btrim(input) = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    payload := input::jsonb;
    RETURN payload;
  EXCEPTION
    WHEN others THEN
      RETURN NULL;
  END;
END;
$$;

-- Expose the ai_expenses view that the chat pipeline queries.
CREATE OR REPLACE VIEW public.ai_expenses AS
WITH normalized AS (
  SELECT
    e.id,
    e.trip_id,
    NULL::uuid AS user_id,
    e.date::date AS date,
    e.amount::numeric AS amount,
    COALESCE(NULLIF(e.category, ''), 'Other') AS category,
    COALESCE(NULLIF(e.title, ''), 'General expense') AS merchant,
    NULLIF(e.description, '') AS description,
    try_parse_jsonb(e.note) AS note_json,
    e.created_at
  FROM public.expenses AS e
)
SELECT
  id,
  trip_id,
  user_id,
  date,
  amount,
  COALESCE(NULLIF(note_json #>> '{source,currency}', ''), 'ILS') AS currency,
  category,
  merchant,
  description AS notes,
  created_at
FROM normalized;

COMMENT ON VIEW public.ai_expenses IS 'Derived expense rows for AI chat (amount, currency, merchant, notes).';
