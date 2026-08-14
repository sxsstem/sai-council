import { NextRequest, NextResponse } from "next/server";
import { testConnection } from "@/lib/llm/client";
import type { ModelConfig } from "@/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const cfg = (await req.json()) as ModelConfig;
  if (!cfg.apiKey || !cfg.provider) {
    return NextResponse.json({ ok: false, error: "缺少必要字段" }, { status: 400 });
  }

  const result = await testConnection(cfg);
  return NextResponse.json(result);
}