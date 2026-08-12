import { defineAppWorkspaceConfig } from "openxiangda/build";

export default defineAppWorkspaceConfig({
  appType: process.env.APP_TYPE || process.env.OPENXIANGDA_APP_TYPE || "APP_XXXXXXXXXXXXXXXX",
  appName: process.env.APP_NAME || "OpenXiangda React SPA",
  runtimeMode: "react-spa",
  platformUrl:
    process.env.APP_PLATFORM_URL ||
    process.env.OPENXIANGDA_BASE_URL ||
    "https://yida.wisejob.cn/service",
  servicePrefix: process.env.APP_SERVICE_PREFIX || "/service",
  appKey: process.env.APP_KEY || "",
  appSecret: process.env.APP_SECRET || "",
  userId: process.env.APP_USER_ID || "",
  version: process.env.APP_VERSION || "0.1.0",
  buildId: process.env.APP_BUILD_ID || "",
  oss: {
    region: process.env.APP_OSS_REGION || "oss-cn-hangzhou",
    bucket: process.env.APP_OSS_BUCKET || "sy-app-workspace-dev",
    accessKeyId: process.env.APP_OSS_ACCESS_KEY_ID || "",
    accessKeySecret: process.env.APP_OSS_ACCESS_KEY_SECRET || "",
    pathPrefix: process.env.APP_OSS_PATH_PREFIX || "app-workspace",
  },
  defaults: {
    protocolVersion: process.env.APP_PAGE_PROTOCOL_VERSION || "1.0",
    frameworkVersion: process.env.APP_FRAMEWORK_VERSION || "18.3.1",
    cssIsolation: "none",
    formMenuParentId: process.env.APP_FORM_MENU_PARENT_ID || "",
    formMenuIcon: process.env.APP_FORM_MENU_ICON || "",
    pageMenuParentId: process.env.APP_PAGE_MENU_PARENT_ID || "",
    pageMenuIcon: process.env.APP_PAGE_MENU_ICON || "",
  },
  compatibility: {
    apiContracts:
      process.env.OPENXIANGDA_API_CONTRACTS === "legacy" ? "legacy" : "strict",
    legacyFallbacks: process.env.OPENXIANGDA_LEGACY_FALLBACKS === "true",
    requestTrace: process.env.OPENXIANGDA_REQUEST_TRACE === "true",
  },
  governance: {
    sdd: {
      enabled: process.env.OPENXIANGDA_SDD_ENABLED === "false" ? false : true,
      strictHighRisk:
        process.env.OPENXIANGDA_SDD_STRICT_HIGH_RISK === "false" ? false : true,
      strictDocumentation: false,
      path: process.env.OPENXIANGDA_SDD_PATH || "openspec",
      schemaVersion: "openxiangda-sdd-v2",
    },
  },
});
