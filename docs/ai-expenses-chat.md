# AI Expenses Chat

This feature enables natural-language questions over the expenses database using a validated NL → SQL → Postgres execution pipeline with Groq for orchestration.

## Environment

Set the following environment variables before running the app:

```
GROQ_API_KEY=<your groq key>
GROQ_MODEL=llama-3.1-70b-versatile
# One of these must point at the Postgres instance that hosts the expenses tables
DATABASE_URL=postgres://...
# or SUPABASE_DB_URL=postgres://...
DEFAULT_TIMEZONE=Asia/Seoul
JWT_SECRET=<shared jwt secret>
AI_CHAT_AUTH_MODE=anonymous          # backend mode: anonymous (default) | jwt
NEXT_PUBLIC_AI_CHAT_AUTH_MODE=anonymous  # frontend mode: anonymous (default) | jwt
```

The modes control whether the chat expects JWT-based authentication or allows anonymous usage scoped by `tripId`/`userId`. Both sides must agree on the same mode.

## Database projection

Run `scripts/05-create-ai-expenses-view.sql` against your Supabase database (or local Postgres) after applying the base schema. This script creates the `ai_expenses` view that the chat pipeline queries. The view normalizes existing expense rows, extracts the transaction currency from the JSON `note` column when present, and provides safe fallbacks so the SQL layer always sees the columns it expects (`amount`, `currency`, `merchant`, `notes`, etc.).

## Modes

### Anonymous (default)

* Backend env: `AI_CHAT_AUTH_MODE=anonymous`
* Frontend env: `NEXT_PUBLIC_AI_CHAT_AUTH_MODE=anonymous`

Requests to `/api/ai/expenses/chat/stream` **do not** require an `Authorization` header or token. Instead, include the active trip ID (or user ID as a fallback) in the query string:

```bash
curl -N "http://localhost:3000/api/ai/expenses/chat/stream?q=highest%20expense%20this%20month&tripId=<TRIP_UUID>&since=2024-08-01&until=2024-08-31&tz=Asia/Seoul"
```

Every query is automatically constrained by the provided `tripId` and the validated date range.

### JWT mode

* Backend env: `AI_CHAT_AUTH_MODE=jwt`
* Frontend env: `NEXT_PUBLIC_AI_CHAT_AUTH_MODE=jwt`

Obtain a 5-minute token before opening the SSE stream. You can exchange a user ID for a token via `/api/ai/expenses/chat/token`, or request a guest-scoped token via `/api/ai/expenses/guest-token`:

```bash
# User-scoped token
TOKEN=$(curl -s -X POST http://localhost:3000/api/ai/expenses/chat/token \
  -H "Content-Type: application/json" \
  -d '{"userId":"<USER_UUID>"}' | jq -r .token)

# Guest token, optionally tied to a trip
GUEST=$(curl -s -X POST http://localhost:3000/api/ai/expenses/guest-token \
  -H "Content-Type: application/json" \
  -d '{"tripId":"<TRIP_UUID>"}' | jq -r .token)

curl -N "http://localhost:3000/api/ai/expenses/chat/stream?q=highest%20expense%20this%20month&tz=Asia/Seoul&token=${TOKEN}" | jq .
# or use the guest token (still include tripId when available)
curl -N "http://localhost:3000/api/ai/expenses/chat/stream?q=highest%20expense%20this%20month&tripId=<TRIP_UUID>&tz=Asia/Seoul&token=${GUEST}" | jq .
```

Tokens embed the relevant `trip_id`/`user_id` claims and must accompany the stream request as `?token=...`.

## Running locally

Backend:

```bash
pnpm dev
```

The SSE endpoint emits `event: token` chunks for incremental text and a final `event: result` JSON payload containing the executed SQL, aggregates, and preview rows.

