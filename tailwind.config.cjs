const path = require("node:path");
const openxiangdaPresetModule = require("openxiangda/tailwind-preset");
const openxiangdaPreset =
  openxiangdaPresetModule.default ?? openxiangdaPresetModule;

function resolveOpenXiangdaContent() {
  try {
    const packagePath = require.resolve("openxiangda");
    const distDir = path.dirname(packagePath);
    return [path.join(distDir, "..", "**/*.{js,mjs,cjs}")];
  } catch {
    return [];
  }
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", ...resolveOpenXiangdaContent()],
  blocklist: ["[-:T]", "[-:TZ.]"],
  presets: [openxiangdaPreset],
  theme: {
    extend: {
      colors: {
        graphite: "#1f2937",
      },
      borderRadius: {
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem",
      },
    },
  },
  corePlugins: {
    preflight: true,
  },
  plugins: [],
};
