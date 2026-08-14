import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#18181b", 2: "#52525b", 3: "#a1a1aa" },
        line: { DEFAULT: "#e4e4e7", strong: "#d4d4d8" },
        accent: { DEFAULT: "#2563eb", soft: "#eff6ff" },
        deepseek: { DEFAULT: "#1d4ed8", soft: "#eff6ff" },
        MiniMax: { DEFAULT: "#7c3aed", soft: "#f5f3ff" },
        zhipu: { DEFAULT: "#0d9488", soft: "#f0fdfa" },
        ok: { DEFAULT: "#15803d", soft: "#f0fdf4" },
        warn: { DEFAULT: "#b91c1c", soft: "#fef2f2" },
      },
    },
  },
  plugins: [],
};
export default config;