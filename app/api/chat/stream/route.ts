import { NextRequest } from "next/server";
import {
  buildHeaders,
  buildMeta,
  buildResultPayload,
  errorResponse,
  flush,
  prepareChat,
  resolveStreamingScope,
  resolveWindow,
  streamGroqAnswer,
  writeEvent,
  type Scope,
  type ChatQuery,
  ChatQueryError,
} from "../_shared";

const PING_INTERVAL_MS = 15_000;

async function sendError(
  send: (event: string, data: unknown) => Promise<void>,
  code: string,
  message: string,
) {
  await send("error", { code, message });
}

async function handle(req: NextRequest, input: ChatQuery) {
  const headers = buildHeaders(req, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  if (!input.question || !input.question.trim()) {
    return errorResponse(headers, 400, "AI-400", "Question is required");
  }

  let scope: Scope;
  try {
    scope = await resolveStreamingScope(req, input);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const window = resolveWindow(input);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = async (event: string, data: unknown) => {
        await writeEvent(controller, event, data);
        await flush();
      };

      const pingTimer = setInterval(() => {
        send("ping", {} as const).catch((err) => {
          console.warn("[ai-chat] ping failed", err);
        });
      }, PING_INTERVAL_MS);

      (async () => {
        try {
          await send("meta", buildMeta(scope, window));

          let computation;
          try {
            computation = await prepareChat(input.question, scope, window);
          } catch (err) {
            if (err instanceof ChatQueryError) {
              console.warn("[ai-chat] computation_rejected", {
                message: err.message,
                code: err.code,
                details: err.details,
              });
              await sendError(send, err.code, err.message);
            } else {
              console.error("[ai-chat] computation_failed", err);
              await sendError(send, "SQL-500", "Failed to prepare query");
            }
            clearInterval(pingTimer);
            controller.close();
            return;
          }

          try {
            const { answer, model } = await streamGroqAnswer({
              question: input.question,
              plan: computation.plan,
              execution: computation.execution,
              timeRange: window,
              send: async (event, data) => {
                await send(event, data);
              },
            });

            await send(
              "result",
              buildResultPayload({
                answer,
                model,
                plan: computation.plan,
                computation,
                window,
              }),
            );
          } catch (err) {
            console.error("[ai-chat] streaming_failed", err);
            await sendError(send, "AI-502", "Unable to generate answer");
          }
        } catch (err) {
          console.error("[ai-chat] stream crashed", err);
          try {
            await send("error", { code: "AI-500", message: "Stream aborted" });
          } catch (nested) {
            console.error("[ai-chat] error event failed", nested);
          }
        } finally {
          clearInterval(pingTimer);
          controller.close();
        }
      })();
    },
    cancel(reason) {
      console.warn("[ai-chat] stream cancelled", reason);
    },
  });

  return new Response(stream, { status: 200, headers });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;
  return handle(req, {
    question: params.get("q") ?? "",
    since: params.get("since"),
    until: params.get("until"),
    tz: params.get("tz"),
    token: params.get("token"),
    tripId: params.get("tripId"),
    userId: params.get("userId"),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatQuery;
    return handle(req, body);
  } catch {
    const headers = buildHeaders(req);
    return errorResponse(headers, 400, "AI-400", "Invalid JSON body");
  }
}

export async function OPTIONS(req: NextRequest) {
  const headers = buildHeaders(req);
  return new Response(null, { status: 204, headers });
}
