"use client";

import { useState } from "react";
import { useSettingsStore } from "@/store/settings";
import { PROVIDER_META, Provider, DEFAULT_MODELS, DEFAULT_BASE_URLS } from "@/types";
import { cn } from "@/lib/utils";

const PROVIDERS: Provider[] = ["deepseek", "MiniMax", "zhipu"];

export default function SettingsPage() {
  const configs = useSettingsStore((s) => s.configs);
  const setConfig = useSettingsStore((s) => s.setConfig);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string; ms: number } | undefined>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  async function handleTest(p: Provider) {
    const cfg = configs[p];
    if (!cfg.apiKey.trim()) {
      setTestResults((s) => ({ ...s, [p]: { ok: false, error: "未填写 API Key", ms: 0 } }));
      return;
    }
    setTesting((s) => ({ ...s, [p]: true }));
    try {
      const resp = await fetch("/api/test-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const result = await resp.json();
      setTestResults((s) => ({ ...s, [p]: result }));
      if (result.ok) {
        setConfig(p, { enabled: true });
      }
    } catch (e) {
      setTestResults((s) => ({ ...s, [p]: { ok: false, error: (e as Error).message, ms: 0 } }));
    } finally {
      setTesting((s) => ({ ...s, [p]: false }));
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <header className="mb-6">
          <a href="/" className="text-xs text-accent hover:underline">← 返回主页</a>
          <h1 className="text-2xl font-bold mt-2">模型配置</h1>
          <p className="text-sm text-ink-2 mt-1">
            填写国内三家大模型的 API Key,即可启用。至少启用 2 家才能跑合议。
            <br />
            <span className="text-ink-3">API Key 存放在浏览器 localStorage,不上传服务器。</span>
          </p>
        </header>

        <div className="space-y-4">
          {PROVIDERS.map((p) => {
            const cfg = configs[p];
            const meta = PROVIDER_META[p];
            const result = testResults[p];
            const isTesting = testing[p];

            return (
              <div key={p} className="bg-white border border-line rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full" style={{ background: meta.color }} />
                  <h2 className="text-base font-semibold">{meta.name}</h2>
                  <span className="text-xs text-ink-3 ml-2">
                    {DEFAULT_BASE_URLS[p]}
                  </span>
                </div>

                <div className="space-y-3">
                  <Field label="API Key">
                    <input
                      type="password"
                      value={cfg.apiKey}
                      onChange={(e) => setConfig(p, { apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 text-sm border border-line rounded focus:outline-none focus:border-accent font-mono"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="模型">
                      <input
                        type="text"
                        value={cfg.model}
                        onChange={(e) => setConfig(p, { model: e.target.value })}
                        placeholder={DEFAULT_MODELS[p]}
                        className="w-full px-3 py-2 text-sm border border-line rounded focus:outline-none focus:border-accent font-mono"
                      />
                    </Field>

                    <Field label="Base URL(可选)">
                      <input
                        type="text"
                        value={cfg.baseUrl || ""}
                        onChange={(e) => setConfig(p, { baseUrl: e.target.value })}
                        placeholder={DEFAULT_BASE_URLS[p]}
                        className="w-full px-3 py-2 text-sm border border-line rounded focus:outline-none focus:border-accent font-mono"
                      />
                    </Field>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={(e) => setConfig(p, { enabled: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span>启用此模型参与合议</span>
                    </label>

                    <div className="flex items-center gap-3">
                      {result && (
                        <span className={cn(
                          "text-xs",
                          result.ok ? "text-ok" : "text-warn"
                        )}>
                          {result.ok ? `✓ 通 (${result.ms}ms)` : `✗ ${result.error?.slice(0, 60)}`}
                        </span>
                      )}
                      <button
                        onClick={() => handleTest(p)}
                        disabled={isTesting}
                        className={cn(
                          "px-3 py-1.5 text-xs font-semibold rounded border transition-colors",
                          isTesting ? "border-line text-ink-3" : "border-line-strong hover:bg-zinc-50"
                        )}
                      >
                        {isTesting ? "测试中..." : "测试连接"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 bg-accent-soft border border-accent/20 rounded-lg p-4">
          <div className="text-sm font-semibold mb-2">说明</div>
          <ul className="text-xs text-ink-2 space-y-1 pl-4 list-disc">
            <li>三家厂商均支持 OpenAI 兼容协议,客户端代码统一处理</li>
            <li>分类阶段会用第一家启用的模型;质询阶段会用各家主模型(也可在 prompt 中切换到 mini/flash 降本)</li>
            <li>本 demo 用 mock 检索;真实使用请把 <code className="bg-white px-1 rounded">src/lib/retrieval/index.ts</code> 里的 MockRetrieval 替换为 BochaRetrieval</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-2 block mb-1">{label}</label>
      {children}
    </div>
  );
}