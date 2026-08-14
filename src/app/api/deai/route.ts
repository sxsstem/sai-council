import { NextRequest } from "next/server";
import type { DeAIEvent, ModelConfig } from "@/types";
import { runDeAI } from "@/lib/council/deai_pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { text, configs } = body as { text: string; configs: ModelConfig[] };

  if (!text || !Array.isArray(configs)) {
    return new Response("Invalid request", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: DeAIEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {}
      };
      try {
        await runDeAI(text, configs, emit);
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