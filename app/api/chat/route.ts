import { NextRequest } from "next/server";
import {
  buildHeaders,
  buildResultPayload,
  collectGroqAnswer,
  errorResponse,
  prepareChat,
  resolveBodyScope,
  resolveWindow,
  type ChatQuery,
  ChatQueryError,
} from "./_shared";

export async function POST(req: NextRequest) {
  const baseHeaders = buildHeaders(req);
  let body: ChatQuery;
  try {
    body = (await req.json()) as ChatQuery;
  } catch {
    return errorResponse(baseHeaders, 400, "AI-400", "Invalid JSON body");
  }

  if (!body.question || !body.question.trim()) {
    return errorResponse(baseHeaders, 400, "AI-400", "Question is required");
  }

  let scope;
  try {
    scope = await resolveBodyScope(req, body);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const window = resolveWindow(body);

  let computation;
  try {
    computation = await prepareChat(body.question, scope, window);
  } catch (err) {
    if (err instanceof ChatQueryError) {
      console.warn("[ai-chat] prepare_chat_rejected", {
        message: err.message,
        code: err.code,
        details: err.details,
      });
      return errorResponse(baseHeaders, err.status, err.code, err.message);
    }
    console.error("[ai-chat] prepare_chat_failed", err);
    return errorResponse(baseHeaders, 500, "SQL-500", "Unable to prepare query");
  }

  try {
    const { answer, model } = await collectGroqAnswer({
      question: body.question,
      plan: computation.plan,
      execution: computation.execution,
      timeRange: window,
    });

    const payload = buildResultPayload({
      answer,
      model,
      plan: computation.plan,
      computation,
      window,
    });

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...baseHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ai-chat] single-shot failed", err);
    return errorResponse(baseHeaders, 502, "AI-502", "Unable to generate answer");
  }
}

export async function OPTIONS(req: NextRequest) {
  const headers = buildHeaders(req);
  return new Response(null, { status: 204, headers });
}
