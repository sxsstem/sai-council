"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModelConfig, Provider } from "@/types";
import { DEFAULT_MODELS, DEFAULT_BASE_URLS } from "@/types";

interface SettingsStore {
  configs: Record<Provider, ModelConfig>;
  // version 每次写入自增,确保引用 configs 的组件重渲染
  version: number;
  setConfig: (provider: Provider, cfg: Partial<ModelConfig>) => void;
}

const defaultConfigs: Record<Provider, ModelConfig> = {
  deepseek: {
    provider: "deepseek",
    apiKey: "",
    model: DEFAULT_MODELS.deepseek,
    baseUrl: DEFAULT_BASE_URLS.deepseek,
    enabled: false,
  },
  MiniMax: {
    provider: "MiniMax",
    apiKey: "",
    model: DEFAULT_MODELS.MiniMax,
    baseUrl: DEFAULT_BASE_URLS.MiniMax,
    enabled: false,
  },
  zhipu: {
    provider: "zhipu",
    apiKey: "",
    model: DEFAULT_MODELS.zhipu,
    baseUrl: DEFAULT_BASE_URLS.zhipu,
    enabled: false,
  },
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      configs: defaultConfigs,
      version: 0,
      setConfig: (provider, partial) =>
        set((s) => ({
          configs: { ...s.configs, [provider]: { ...s.configs[provider], ...partial } },
          version: s.version + 1,
        })),
    }),
    {
      name: "council-settings",
      // 关键:hydrate 后也要 bump version,触发订阅了 configs 的组件重渲染
      onRehydrateStorage: () => (state) => {
        if (state) state.version = state.version + 1;
      },
    }
  )
);

// 派生 selector:启用列表(组件直接订阅它,configs/version 任一变化都重渲染)
export function useEnabledConfigs(): ModelConfig[] {
  return useSettingsStore((s) => {
    void s.version; // 显式订阅 version
    return Object.values(s.configs).filter((c) => c.enabled && c.apiKey.trim());
  });
}