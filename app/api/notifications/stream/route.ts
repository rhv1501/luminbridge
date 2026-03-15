import { badRequest, toInt } from "@/lib/api";
import { createUserEventStream } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = toInt(url.searchParams.get("userId"));
  if (!userId) return badRequest("userId required");

  const stream = createUserEventStream(userId, req.signal);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
