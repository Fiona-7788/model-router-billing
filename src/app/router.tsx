import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useParams,
} from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { ShieldAlert, Sparkles } from "lucide-react";
import {
  LoginPage,
  OpenXiangdaPageProvider,
  OpenXiangdaProvider,
  PublicAccessGate,
  RuntimeAuthGuard,
} from "openxiangda/runtime/react";

import { AdminShell } from "@/layouts/AdminShell";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { NotFoundPage } from "@/pages/states/NotFoundPage";
import { StatePage } from "@/shared/ui";

const servicePrefix = process.env.APP_SERVICE_PREFIX || "/service";
const DataRoutePage = lazy(() =>
  import("@/pages/defaults/DataRoutePage").then(module => ({
    default: module.DataRoutePage,
  })),
);
const FilePreviewRoutePage = lazy(() =>
  import("@/pages/defaults/FilePreviewRoutePage").then(module => ({
    default: module.FilePreviewRoutePage,
  })),
);
const FormRoutePage = lazy(() =>
  import("@/pages/defaults/FormRoutePage").then(module => ({
    default: module.FormRoutePage,
  })),
);
const LoginLogPage = lazy(() =>
  import("@/pages/admin/LoginLogPage").then(module => ({
    default: module.LoginLogPage,
  })),
);
const PublicRegisterPage = lazy(() =>
  import("@/pages/public/PublicRegisterPage").then(module => ({
    default: module.PublicRegisterPage,
  })),
);
const BillingDashboardPage = lazy(() =>
  import("@/pages/billing/BillingDashboardPage").then(module => ({
    default: module.BillingDashboardPage,
  })),
);
const CallSourcesPage = lazy(() =>
  import("@/pages/billing/CallSourcesPage").then(module => ({
    default: module.CallSourcesPage,
  })),
);

const routeElement = (element: ReactNode) => (
  <Suspense
    fallback={
      <StatePage
        description="正在加载页面组件。"
        icon={<Sparkles size={24} />}
        status="LOADING"
        title="加载中"
      />
    }
  >
    {element}
  </Suspense>
);

const publicAccessFallback = (
  <StatePage
    description="正在创建公开访问会话。"
    fullScreen
    icon={<Sparkles size={24} />}
    status="PUBLIC"
    title="正在进入公开页面"
  />
);

const publicAccessErrorFallback = (error: { message?: string }) => (
  <StatePage
    description={error.message || "公开链接不可用或已过期。"}
    fullScreen
    icon={<ShieldAlert size={24} />}
    status="PUBLIC"
    title="链接不可用"
  />
);

function RuntimeRoot() {
  const { appType = process.env.OPENXIANGDA_APP_TYPE || "" } = useParams();
  return (
    <OpenXiangdaProvider appType={appType} servicePrefix={servicePrefix}>
      <OpenXiangdaPageProvider>
        <Outlet />
      </OpenXiangdaPageProvider>
    </OpenXiangdaProvider>
  );
}

export const router = createBrowserRouter([
  {
    path: "/view/file-preview",
    element: routeElement(<FilePreviewRoutePage />),
  },
  {
    path: "/view/submit/:appType/:formUuid",
    element: <RuntimeRoot />,
    children: [{ index: true, element: routeElement(<FormRoutePage mode="submit" />) }],
  },
  {
    path: "/view/:appType",
    element: <RuntimeRoot />,
    children: [
      { index: true, element: <Navigate to="admin/billing" replace /> },
      { path: "login", element: <LoginPage /> },
      {
        path: "public/register",
        element: routeElement(
          <PublicAccessGate
            errorFallback={publicAccessErrorFallback}
            fallback={publicAccessFallback}
            policyCode="public_register"
            routeCode="public.register"
          >
            <PublicRegisterPage />
          </PublicAccessGate>,
        ),
      },
      {
        path: "admin",
        element: (
          <RuntimeAuthGuard>
            <AdminShell />
          </RuntimeAuthGuard>
        ),
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: "data/:formUuid", element: routeElement(<DataRoutePage />) },
          { path: "forms/:formUuid/new", element: routeElement(<FormRoutePage mode="submit" />) },
          { path: "forms/:formUuid/:formInstId", element: routeElement(<FormRoutePage mode="detail" />) },
          { path: "login-logs", element: routeElement(<LoginLogPage />) },
          { path: "billing", element: routeElement(<BillingDashboardPage />) },
          { path: "billing/call-sources", element: routeElement(<CallSourcesPage />) },
          { path: "process/:formUuid/:formInstId", element: routeElement(<FormRoutePage mode="process" />) },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
      { path: "file-preview", element: routeElement(<FilePreviewRoutePage />) },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
