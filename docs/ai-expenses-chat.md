# AI Expenses Chat

This feature enables natural-language questions over the expenses database using a validated NL → SQL → Postgres execution pipeline with Groq for orchestration.

## Environment

Set the following environment variables before running the app:

```
GROQ_API_KEY=<your groq key>
GROQ_MODEL=llama-3.1-70b-versatile
DATABASE_URL=postgres://...
DEFAULT_TIMEZONE=Asia/Seoul
JWT_SECRET=<shared jwt secret>
```

## Running locally

Backend:

```bash
pnpm dev
```

The SSE endpoint is available at `/api/ai/expenses/chat/stream`. Issue a short-lived token via `/api/ai/expenses/chat/token` and include it as a query parameter:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/ai/expenses/chat/token -H "Content-Type: application/json" -d '{"userId":"<USER_ID>"}' | jq -r .token)
curl -N "http://localhost:3000/api/ai/expenses/chat/stream?q=highest%20expense%20this%20month&tz=Asia/Seoul&token=${TOKEN}"
```

The stream emits `event: token` chunks for incremental text and a final `event: result` JSON payload containing the executed SQL, aggregates, and preview rows.

