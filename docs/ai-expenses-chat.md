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

The SSE endpoint is available at `/api/ai/expenses/chat`. Example cURL using a JWT:

```bash
curl -N "http://localhost:3000/api/ai/expenses/chat?question=highest%20expense%20this%20month&timezone=Asia/Seoul" \
  -H "Authorization: Bearer <TEST_JWT>"
```

The stream emits `event: token` chunks for incremental text and a final `event: result` JSON payload containing the executed SQL, aggregates, and preview rows.

