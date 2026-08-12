import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const resolveProxyTarget = (value?: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  try {
    return new URL(normalized).origin;
  } catch {
    return "";
  }
};

const toPort = (value?: string) => {
  const port = Number(value || 5174);
  return Number.isFinite(port) && port > 0 ? port : 5174;
};

const localSdkRoot = fileURLToPath(
  new URL("../../packages/sdk/src", import.meta.url),
);
const localSdkAliases = existsSync(localSdkRoot)
  ? [
      {
        find: "openxiangda/runtime/react",
        replacement: fileURLToPath(
          new URL(
            "../../packages/sdk/src/runtime/react/index.ts",
            import.meta.url,
          ),
        ),
      },
      {
        find: "openxiangda/runtime",
        replacement: fileURLToPath(
          new URL("../../packages/sdk/src/runtime/index.ts", import.meta.url),
        ),
      },
      {
        find: "openxiangda",
        replacement: fileURLToPath(
          new URL("../../packages/sdk/src/components/index.ts", import.meta.url),
        ),
      },
    ]
  : [];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serviceTarget = resolveProxyTarget(
    env.OPENXIANGDA_BASE_URL || env.APP_PLATFORM_URL,
  );
  const servicePrefix = env.APP_SERVICE_PREFIX || "/service";
  const appType = env.OPENXIANGDA_APP_TYPE || env.APP_TYPE || "";
  const buildId = env.OPENXIANGDA_BUILD_ID || "";
  const runtimeAssetBase =
    env.OPENXIANGDA_RUNTIME_ASSET_BASE ||
    (appType && buildId
      ? `${servicePrefix.replace(/\/+$/, "")}/openxiangda-api/v1/apps/${encodeURIComponent(appType)}/runtime/releases/by-build/${encodeURIComponent(buildId)}/files/`
      : "/");

  return {
    base: runtimeAssetBase,
    define: {
      "process.env.OPENXIANGDA_APP_TYPE": JSON.stringify(appType),
      "process.env.APP_TYPE": JSON.stringify(appType),
      "process.env.OPENXIANGDA_BASE_URL": JSON.stringify(
        env.OPENXIANGDA_BASE_URL || env.APP_PLATFORM_URL || "",
      ),
      "process.env.APP_SERVICE_PREFIX": JSON.stringify(servicePrefix),
    },
    plugins: [react()],
    resolve: {
      alias: [
        ...localSdkAliases,
        {
          find: "@",
          replacement: fileURLToPath(new URL("./src", import.meta.url)),
        },
      ],
      dedupe: ["react", "react-dom"],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("/node_modules/")) return undefined;
            const openXiangdaChunk = getOpenXiangdaChunk(id);
            if (openXiangdaChunk) return openXiangdaChunk;
            const packageName = getPackageName(id);
            if (!packageName) return undefined;
            if (reactPackages.has(packageName)) return "vendor-react";
            if (
              packageName === "antd" ||
              packageName.startsWith("@ant-design/") ||
              packageName.startsWith("rc-") ||
              packageName.startsWith("@rc-component/")
            ) {
              return "vendor-antd";
            }
            if (packageName === "echarts" || packageName === "echarts-for-react") return "vendor-echarts";
            if (packageName === "zrender") return "vendor-zrender";
            if (tiptapPackages.has(packageName) || packageName.startsWith("prosemirror-")) return "vendor-editor";
            if (visualPackages.has(packageName)) return "vendor-visual";
            return undefined;
          },
        },
      },
    },
    server: {
      host: env.OPENXIANGDA_DEV_HOST || "127.0.0.1",
      port: toPort(env.OPENXIANGDA_DEV_PORT),
      proxy: serviceTarget
        ? {
            [servicePrefix]: {
              target: serviceTarget,
              changeOrigin: true,
              secure: false,
              cookieDomainRewrite: "",
              cookiePathRewrite: "/",
              headers: {
                "x-openxiangda-dev-proxy": "1",
              },
            },
          }
        : undefined,
    },
  };
});

function getPackageName(id: string) {
  const marker = "/node_modules/";
  const index = id.lastIndexOf(marker);
  if (index === -1) return "";
  const path = id.slice(index + marker.length);
  if (path.startsWith(".pnpm/")) {
    const [, packagePart] = path.split("/node_modules/");
    return packagePart ? normalizePackageName(packagePart) : "";
  }
  return normalizePackageName(path);
}

function normalizePackageName(path: string) {
  const parts = path.split("/");
  if (!parts[0]) return "";
  if (parts[0].startsWith("@")) return `${parts[0]}/${parts[1] || ""}`;
  return parts[0];
}

function getOpenXiangdaChunk(id: string) {
  if (!id.includes("/node_modules/openxiangda/")) return "";
  if (id.includes("/packages/sdk/dist/runtime/react.")) return "vendor-openxiangda-runtime-react";
  if (id.includes("/packages/sdk/dist/runtime/index.")) return "vendor-openxiangda-runtime";
  if (id.includes("/packages/sdk/dist/components/index.")) return "vendor-openxiangda-components";
  return "vendor-openxiangda";
}

const reactPackages = new Set([
  "react",
  "react-dom",
  "react-is",
  "react-router",
  "react-router-dom",
  "scheduler",
  "use-sync-external-store",
]);

const tiptapPackages = new Set([
  "@tiptap/core",
  "@tiptap/extension-blockquote",
  "@tiptap/extension-bold",
  "@tiptap/extension-bullet-list",
  "@tiptap/extension-code",
  "@tiptap/extension-code-block",
  "@tiptap/extension-document",
  "@tiptap/extension-dropcursor",
  "@tiptap/extension-gapcursor",
  "@tiptap/extension-hard-break",
  "@tiptap/extension-heading",
  "@tiptap/extension-history",
  "@tiptap/extension-horizontal-rule",
  "@tiptap/extension-image",
  "@tiptap/extension-italic",
  "@tiptap/extension-link",
  "@tiptap/extension-list-item",
  "@tiptap/extension-ordered-list",
  "@tiptap/extension-paragraph",
  "@tiptap/extension-placeholder",
  "@tiptap/extension-strike",
  "@tiptap/extension-table",
  "@tiptap/extension-table-cell",
  "@tiptap/extension-table-header",
  "@tiptap/extension-table-row",
  "@tiptap/extension-task-item",
  "@tiptap/extension-task-list",
  "@tiptap/extension-text",
  "@tiptap/extension-underline",
  "@tiptap/extensions",
  "@tiptap/pm",
  "@tiptap/react",
  "@tiptap/starter-kit",
]);

const visualPackages = new Set([
  "framer-motion",
  "lucide-react",
]);
