import { NextRequest, NextResponse } from "next/server";
import { readdir, unlink, stat } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const runtime = "nodejs";

const UPLOAD_DIR = "/tmp/council-uploads";
const MAX_AGE_MS = 60 * 60 * 1000; // 1 小时

/**
 * 清理过期的临时上传文件
 * GET /api/cleanup 调用即可,会清理 1 小时前上传的文件
 */
export async function GET() {
  if (!existsSync(UPLOAD_DIR)) {
    return NextResponse.json({ removed: 0, message: "目录不存在" });
  }
  const now = Date.now();
  let removed = 0;
  const errors: string[] = [];

  try {
    const files = await readdir(UPLOAD_DIR);
    for (const f of files) {
      const filepath = path.join(UPLOAD_DIR, f);
      try {
        const s = await stat(filepath);
        if (now - s.mtimeMs > MAX_AGE_MS) {
          await unlink(filepath);
          removed++;
        }
      } catch (e) {
        errors.push(`${f}: ${(e as Error).message}`);
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ removed, errors });
}