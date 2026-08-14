import { NextRequest } from "next/server";
import type { CouncilEvent, ModelConfig } from "@/types";
import { runCouncil } from "@/lib/council/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { query, configs } = body as { query: string; configs: ModelConfig[] };

  if (!query || !Array.isArray(configs)) {
    return new Response("Invalid request", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: CouncilEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller 已关闭
        }
      };

      try {
        await runCouncil(query, configs, emit);
      } catch (e) {
        emit({ stage: "error", type: "fatal", error: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}