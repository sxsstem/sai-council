"use client";

import { useRef, useState } from "react";
import { useFilesStore } from "@/store/files";
import { useToastStore } from "@/store/toast";
import { Upload, FileText, X, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.txt,.md,.markdown,.html,.htm";
const MAX_FILES = 10;
const MAX_SIZE = 30 * 1024 * 1024;

export function FileUploader() {
  const files = useFilesStore((s) => s.files);
  const addOptimistic = useFilesStore((s) => s.addOptimistic);
  const setResult = useFilesStore((s) => s.setResult);
  const remove = useFilesStore((s) => s.remove);
  const clear = useFilesStore((s) => s.clear);
  const pushToast = useToastStore((s) => s.push);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const arr = Array.from(fileList);
    if (files.length + arr.length > MAX_FILES) {
      pushToast({
        type: "warn",
        message: `最多 ${MAX_FILES} 个文件,当前已选 ${files.length},还能加 ${MAX_FILES - files.length}`,
      });
      return;
    }

    for (const f of arr) {
      if (f.size > MAX_SIZE) {
        pushToast({
          type: "warn",
          message: `文件 ${f.name} 超过 30MB`,
        });
        continue;
      }

      const ext = f.name.toLowerCase().split(".").pop();
      if (!["pdf", "txt", "md", "markdown", "html", "htm"].includes(ext || "")) {
        pushToast({ type: "warn", message: `不支持的类型: .${ext}` });
        continue;
      }

      const id = addOptimistic(f.name, f.size);
      uploadFile(id, f);
    }
  }

  async function uploadFile(id: string, file: File) {
    const formData = new FormData();
    formData.append("files", file);
    try {
      const resp = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await resp.json();
      if (!resp.ok) {
        setResult(id, {
          filename: file.name,
          type: "",
          sizeBytes: file.size,
          parsed: null,
          error: json.error || "上传失败",
        });
        pushToast({ type: "error", message: `${file.name} 上传失败` });
        return;
      }
      const r = json.results[0];
      setResult(id, r);
      if (r.error) {
        pushToast({ type: "error", message: `${file.name}: ${r.error}` });
      } else {
        pushToast({ type: "ok", message: `${file.name} 已上传 · ${r.parsed?.meta.wordCount || 0} 字` });
      }
    } catch (e) {
      setResult(id, {
        filename: file.name,
        type: "",
        sizeBytes: file.size,
        parsed: null,
        error: (e as Error).message,
      });
      pushToast({ type: "error", message: `${file.name} 上传失败` });
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  return (
    <div className="bg-white border border-line rounded-lg overflow-hidden">
      {/* 上传区 */}
      <div className="px-5 py-3 border-b border-line bg-zinc-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Upload size={14} className="text-ink-3" />
          <h3 className="text-sm font-semibold">参考文件</h3>
          <span className="text-xs text-ink-3">
            ({files.length}/{MAX_FILES})· 单文件 ≤30MB · PDF/TXT/MD/HTML
          </span>
        </div>
        {files.length > 0 && (
          <button onClick={() => clear()} className="text-xs text-ink-3 hover:text-warn">
            清空全部
          </button>
        )}
      </div>

      {/* 拖拽区 */}
      <div className="px-5 py-3">
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
            dragging ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"
          )}
        >
          <Upload size={20} className={cn("mx-auto mb-1", dragging ? "text-accent" : "text-ink-3")} />
          <div className="text-xs text-ink-2">
            {dragging ? "松开上传" : "点击或拖拽文件到这里"}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="px-5 pb-3 space-y-2">
          {files.map((f) => (
            <FileRow key={f.id} file={f} onRemove={() => remove(f.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileRow({ file, onRemove }: { file: any; onRemove: () => void }) {
  const sizeText = file.sizeBytes < 1024 * 1024
    ? `${(file.sizeBytes / 1024).toFixed(0)} KB`
    : `${(file.sizeBytes / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-zinc-50 rounded-md group">
      <FileText size={14} className="text-ink-3 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {file.status === "uploading" && (
            <Loader2 size={12} className="animate-spin text-accent" />
          )}
          {file.status === "error" && (
            <AlertCircle size={12} className="text-warn" />
          )}
          <div className="text-xs font-semibold text-ink truncate">{file.filename}</div>
          <div className="text-[10px] text-ink-3 ml-auto flex-shrink-0">{sizeText}</div>
        </div>
        <div className="text-[10px] text-ink-3 mt-0.5">
          {file.status === "uploading" && "上传中..."}
          {file.status === "error" && (file.error || "解析失败")}
          {file.status === "ready" && file.parsed && (
            <>
              {file.parsed.type.toUpperCase()}
              {file.parsed.meta.pages ? ` · ${file.parsed.meta.pages} 页` : ""}
              {" · "}{file.parsed.meta.wordCount} 字
            </>
          )}
        </div>
      </div>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-warn"
        aria-label="remove"
      >
        <X size={14} />
      </button>
    </div>
  );
}