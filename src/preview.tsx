import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN.js";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn.js";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes, Link, useLocation } from "react-router-dom";

import { BillingDashboardPage } from "@/pages/billing/BillingDashboardPage";
import { CallSourcesPage } from "@/pages/billing/CallSourcesPage";
import "antd-mobile/bundle/style.css";
import "@/styles/index.css";

dayjs.locale("zh-cn");

function PreviewNav() {
  const { pathname } = useLocation();
  const linkClass = (path: string) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition ${
      pathname === path
        ? "bg-blue-600 text-white shadow"
        : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 2L2 20h20L12 2z" />
            </svg>
          </div>
          <span className="text-base font-bold text-slate-900">Model Router 账单管理</span>
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">预览模式</span>
        </div>
        <nav className="flex gap-1">
          <Link className={linkClass("/preview/billing")} to="/preview/billing">
            账单看板
          </Link>
          <Link className={linkClass("/preview/call-sources")} to="/preview/call-sources">
            调取来源
          </Link>
        </nav>
      </div>
    </div>
  );
}

function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#edf4ff_0%,#f8fafc_42%,#f1f5f9_100%)]">
      <PreviewNav />
      <div className="mx-auto max-w-[1440px] px-6 py-5">{children}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/preview/billing"
            element={
              <PreviewShell>
                <BillingDashboardPage />
              </PreviewShell>
            }
          />
          <Route
            path="/preview/call-sources"
            element={
              <PreviewShell>
                <CallSourcesPage />
              </PreviewShell>
            }
          />
          <Route
            index
            element={
              <PreviewShell>
                <BillingDashboardPage />
              </PreviewShell>
            }
          />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
);
