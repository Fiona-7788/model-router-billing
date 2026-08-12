import { FileText, LogIn, Shield, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StandardFormPage } from "openxiangda";
import { normalizeRuntimeFormSchema } from "openxiangda/runtime";
import { useOpenXiangda, useRuntimeAuth } from "openxiangda/runtime/react";

import { useAdminPageMetaController } from "@/layouts/AdminShell";
import {
  PrimaryButton,
  StatePage,
} from "@/shared/ui";
import {
  defaultPageOverrides,
  resolveDefaultPageOverride,
  type DefaultPageKind,
} from "@/runtime/default-page-overrides";

type Mode = "submit" | "detail" | "process";

type PageError = {
  message: string;
  status?: number;
  type: "unauthenticated" | "forbidden" | "unknown";
};

export function FormRoutePage({ mode }: { mode: Mode }) {
  const { appType = "", formUuid = "", formInstId = "" } = useParams();
  const navigate = useNavigate();
  const runtime = useOpenXiangda();
  const setAdminPageMeta = useAdminPageMetaController();
  const [schema, setSchema] = useState<any>(null);
  const [error, setError] = useState<PageError | null>(null);

  useEffect(() => {
    if (runtime.error && !runtime.data) {
      setError({
        message: runtime.error.message,
        status: runtime.error.status,
        type: runtime.error.type === "unauthenticated" || runtime.error.type === "forbidden" ? runtime.error.type : "unknown",
      });
      return;
    }
    let disposed = false;
    const load = async () => {
      try {
        const response = await runtime.fetchImpl(
          `${runtime.servicePrefix}/openxiangda-api/v1/apps/${encodeURIComponent(appType)}/forms/${encodeURIComponent(formUuid)}`,
          { credentials: "include", headers: { accept: "application/json" } },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.code >= 400) {
          throw createPageError(response.status, payload?.code, payload?.message || "表单 schema 加载失败");
        }
        const normalizedSchema = normalizeRuntimeFormSchema(payload, { appType, formUuid });
        if (!normalizedSchema) {
          throw createPageError(undefined, undefined, "表单 schema 格式暂不支持或没有可渲染字段");
        }
        if (!disposed) {
          setSchema(normalizedSchema);
          setError(null);
        }
      } catch (err) {
        if (!disposed) {
          setError(normalizePageError(err));
        }
      }
    };
    void load();
    return () => {
      disposed = true;
    };
  }, [appType, formUuid, runtime.data, runtime.error, runtime.fetchImpl, runtime.servicePrefix]);

  const formType = String(schema?.template?.formType || schema?.formMeta?.formType || "").toLowerCase();
  const isProcessForm = mode === "process" || formType === "process" || formType === "flow";
  const pageMode = mode === "process" ? "process" : mode === "detail" ? "detail" : "submit";
  const overrideKind: DefaultPageKind =
    pageMode === "process"
      ? "process-detail"
      : pageMode === "detail"
        ? isProcessForm
          ? "process-detail"
          : "form-detail"
        : isProcessForm
          ? "process-submit"
          : "form-submit";
  const pageCopy = useMemo(() => resolvePageCopy(overrideKind, mode), [mode, overrideKind]);
  const pageTitle = useMemo(
    () => resolvePageTitle(schema, pageCopy.title, overrideKind),
    [overrideKind, pageCopy.title, schema],
  );
  const runtimeApi = useMemo(
    () => ({
      baseUrl: runtime.servicePrefix,
      fetchImpl: runtime.fetchImpl,
      getAuthHeaders: runtime.getAuthHeaders,
    }),
    [runtime.fetchImpl, runtime.getAuthHeaders, runtime.servicePrefix],
  );

  useEffect(() => {
    if (!schema) return undefined;
    setAdminPageMeta({ title: pageTitle });
    return () => setAdminPageMeta(null);
  }, [pageTitle, schema, setAdminPageMeta]);

  if (error) return <DefaultErrorState error={error} />;
  if (!schema) return <DefaultLoadingState description="正在读取页面配置和当前用户权限。" title="正在加载" />;

  const Override = resolveDefaultPageOverride(defaultPageOverrides, overrideKind, formUuid);
  const defaultNode = (
    <StandardFormPage
      appType={appType}
      formInstanceId={formInstId}
      formUuid={formUuid}
      mode={pageMode}
      onSubmitSuccess={id =>
        navigate(
          isProcessForm
            ? `/view/${appType}/admin/process/${formUuid}/${id}`
            : `/view/${appType}/admin/forms/${formUuid}/${id}`,
        )
      }
      api={runtimeApi}
      schema={schema}
    />
  );

  return (
    <div className="ox-default-form-route min-w-0">
      {Override ? (
        <Override
          appType={appType}
          defaultNode={defaultNode}
          formInstId={formInstId}
          formUuid={formUuid}
          kind={overrideKind}
          schema={schema}
        />
      ) : (
        defaultNode
      )}
    </div>
  );
}

function DefaultLoadingState({ description, title }: { description: string; title: string }) {
  return (
    <StatePage
      description={description}
      icon={<FileText size={24} />}
      status="LOADING"
      title={title}
    />
  );
}

function DefaultErrorState({ error }: { error: PageError }) {
  const auth = useRuntimeAuth();

  useEffect(() => {
    if (error.type === "unauthenticated") {
      void auth.redirectToLogin({ replace: true });
    }
  }, [auth, error.type]);

  if (error.type === "unauthenticated") {
    return (
      <StatePage
        actions={<PrimaryButton onClick={() => void auth.redirectToLogin({ replace: true })}>去登录</PrimaryButton>}
        description="当前没有有效登录态，正在跳转到登录页。"
        icon={<LogIn size={24} />}
        status="401"
        title="需要登录"
      />
    );
  }

  return (
    <StatePage
      description={error.message || "请确认当前用户是否拥有表单、流程或数据访问权限。"}
      icon={error.type === "forbidden" ? <Shield size={24} /> : <Workflow size={24} />}
      status={error.type === "forbidden" ? "403" : String(error.status || "ERROR")}
      title={error.type === "forbidden" ? "无权访问当前页面" : "页面加载失败"}
    />
  );
}

function resolvePageCopy(kind: DefaultPageKind, mode: Mode) {
  if (kind === "process-submit") {
    return {
      description: "填写并提交流程申请，提交后可继续查看办理进度。",
      title: "发起流程",
    };
  }
  if (kind === "process-detail" || mode === "process") {
    return {
      description: "查看流程内容、办理进度和可执行操作。",
      title: "流程详情",
    };
  }
  if (kind === "form-detail") {
    return {
      description: "查看业务记录详情和相关信息。",
      title: "表单详情",
    };
  }
  return {
    description: "填写并提交业务申请，提交成功后可查看记录详情。",
    title: "发起申请",
  };
}

function resolvePageTitle(schema: any, fallback: string, kind: DefaultPageKind) {
  const title = String(schema?.formMeta?.title || schema?.title || schema?.template?.title || "").trim();
  if (!title) return fallback;
  if (kind === "form-detail" || kind === "process-detail") return `${title}详情`;
  return title;
}

function createPageError(status: number | undefined, code: number | string | undefined, message: string): PageError {
  const normalizedCode = typeof code === "string" ? Number(code) : code;
  if (status === 401 || normalizedCode === 401) return { message, status, type: "unauthenticated" };
  if (status === 403 || normalizedCode === 403) return { message, status, type: "forbidden" };
  return { message, status, type: "unknown" };
}

function normalizePageError(error: unknown): PageError {
  if (error && typeof error === "object" && "type" in error) return error as PageError;
  return {
    message: error instanceof Error ? error.message : String(error),
    type: "unknown",
  };
}
