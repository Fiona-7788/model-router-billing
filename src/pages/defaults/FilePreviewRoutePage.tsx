import { LockKeyhole, ShieldCheck } from "lucide-react";
import { BuiltinRouteRenderer, type BrowserRuntimeRouteResolution } from "openxiangda/runtime";
import { useParams } from "react-router-dom";

import {
  defaultPageOverrides,
  resolveDefaultPageOverride,
} from "@/runtime/default-page-overrides";
import {
  PrimaryButton,
  StatePage,
} from "@/shared/ui";

const servicePrefix = process.env.APP_SERVICE_PREFIX || "/service";

export function FilePreviewRoutePage() {
  const params = useParams();
  const ticket = new URLSearchParams(window.location.search).get("ticket") || "";
  const runtimeEntry = (window as any).__OPENXIANGDA_RUNTIME_ENTRY__;
  const appType = params.appType || runtimeEntry?.appType || process.env.OPENXIANGDA_APP_TYPE || process.env.APP_TYPE || "";
  const Override = resolveDefaultPageOverride(defaultPageOverrides, "file-preview");
  const route: BrowserRuntimeRouteResolution = {
    appType,
    kind: "file-preview",
    mode: "builtin-route",
    params: { ticket },
    path: window.location.pathname,
    query: { ticket },
    runtime: {
      renderer: "openxiangda-builtin",
      surface: "file-preview",
    },
    search: window.location.search,
  };

  const defaultNode = ticket ? (
    <BuiltinRouteRenderer appType={appType} route={route} servicePrefix={servicePrefix} />
  ) : (
    <StatePage
      actions={
        <PrimaryButton onClick={() => window.history.back()}>
          <ShieldCheck size={17} />
          返回上一页
        </PrimaryButton>
      }
      description="当前链接已失效或缺少必要的访问凭证。请从业务页面重新打开文件。"
      fullScreen
      icon={<LockKeyhole size={24} />}
      status="INVALID"
      title="文件链接不可用"
    />
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] p-5">
      <div className="mx-auto max-w-6xl">
        {Override ? (
          <Override appType={appType} defaultNode={defaultNode} kind="file-preview" />
        ) : (
          defaultNode
        )}
      </div>
    </main>
  );
}
