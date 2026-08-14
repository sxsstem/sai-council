import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { parseFile } from "@/lib/files/parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB
const MAX_FILES = 10;
const UPLOAD_DIR = "/tmp/council-uploads";

interface UploadResponse {
  id: string;
  filename: string;
  type: string;
  sizeBytes: number;
  parsed: Awaited<ReturnType<typeof parseFile>> | null;
  error?: string;
}

export async function POST(req: NextRequest) {
  // 确保临时目录存在
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "无效的表单数据" }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "未提供文件" }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `最多 ${MAX_FILES} 个文件,你上传了 ${files.length}` }, { status: 400 });
  }

  // 校验每个文件大小 + 类型
  for (const f of files) {
    if (f.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `文件 ${f.name} 超过 30MB(实际 ${(f.size / 1024 / 1024).toFixed(1)}MB)` },
        { status: 400 }
      );
    }
  }

  // 处理每个文件
  const results: UploadResponse[] = [];

  for (const file of files) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const safeName = `${id}__${file.name.replace(/[^\w一-龥.-]/g, "_")}`;
    const filepath = path.join(UPLOAD_DIR, safeName);

    try {
      // 写盘
      const bytes = Buffer.from(await file.arrayBuffer());
      await writeFile(filepath, bytes);

      // 解析
      let parsed = null;
      try {
        parsed = await parseFile(filepath, file.name);
      } catch (e) {
        results.push({
          id,
          filename: file.name,
          type: file.type || "unknown",
          sizeBytes: file.size,
          parsed: null,
          error: (e as Error).message,
        });
        continue;
      }

      results.push({
        id,
        filename: file.name,
        type: file.type || parsed.type,
        sizeBytes: file.size,
        parsed,
      });
    } catch (e) {
      results.push({
        id,
        filename: file.name,
        type: file.type || "unknown",
        sizeBytes: file.size,
        parsed: null,
        error: (e as Error).message,
      });
    }
  }

  return NextResponse.json({ results });
}

// 删除文件
export async function DELETE(req: NextRequest) {
  const { ids } = (await req.json()) as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "未提供 ids" }, { status: 400 });
  }

  const fs = await import("fs/promises");
  let removed = 0;
  for (const id of ids) {
    try {
      const files = await fs.readdir(UPLOAD_DIR);
      for (const f of files) {
        if (f.startsWith(id + "__")) {
          await fs.unlink(path.join(UPLOAD_DIR, f));
          removed++;
        }
      }
    } catch {}
  }

  return NextResponse.json({ removed });
}