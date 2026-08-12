import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  RefreshCw,
  Shield,
  X,
} from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import {
  PermissionBoundary,
  useAppMenus,
  useRuntimeAuth,
  useRuntimeBootstrap,
  type PermissionBoundaryFallbackState,
} from "openxiangda/runtime/react";

import {
  buildStarterAdminNavigation,
  filterNavigationByMenuCodes,
  type StarterNavigationGroup,
} from "@/app/navigation";
import { starterBrand } from "@/app/starter-content";
import {
  PrimaryButton,
  SecondaryButton,
  StatePage,
  cn,
} from "@/shared/ui";

type PlatformMenuLike = {
  children?: PlatformMenuLike[];
  code?: string | null;
  formUuid?: string | null;
  isHidden?: boolean | null;
  resourceCode?: string | null;
  routeCode?: string | null;
  type?: string | null;
};

type AdminPageMeta = {
  breadcrumbs?: string[];
  title?: string;
};

type NavigationState = {
  activePath?: string;
  breadcrumbs: string[];
  title: string;
};

const AdminPageMetaContext = createContext<((meta: AdminPageMeta | null) => void) | null>(null);
const noopSetAdminPageMeta = () => undefined;

export function useAdminPageMetaController() {
  return useContext(AdminPageMetaContext) ?? noopSetAdminPageMeta;
}

export function AdminShell() {
  const { appType = "" } = useParams();
  const location = useLocation();
  const bootstrap = useRuntimeBootstrap();
  const menus = useAppMenus();
  const auth = useRuntimeAuth();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pageMeta, setPageMeta] = useState<AdminPageMeta | null>(null);

  const userName = String(
    bootstrap.data?.user?.name ||
      bootstrap.data?.user?.nickName ||
      bootstrap.data?.user?.id ||
      "当前用户",
  );
  const userAvatar = String(
    bootstrap.data?.user?.avatar ||
      bootstrap.data?.user?.avatarUrl ||
      bootstrap.data?.user?.photoUrl ||
      "",
  );
  const userRole = String(
    bootstrap.data?.user?.roleName ||
      bootstrap.data?.user?.title ||
      bootstrap.data?.user?.position ||
      bootstrap.data?.user?.departmentName ||
      "平台用户",
  );

  const menuCodes = useMemo(() => collectMenuCodes(menus.data), [menus.data]);
  const groups = useMemo<StarterNavigationGroup[]>(
    () =>
      filterNavigationByMenuCodes(
        buildStarterAdminNavigation({
          appType,
        }),
        menuCodes,
      ),
    [appType, menuCodes],
  );
  const navigationState = useMemo(
    () => resolveNavigationState(groups, location.pathname, location.search, appType),
    [appType, groups, location.pathname, location.search],
  );
  const headerTitle = pageMeta?.title || navigationState.title || starterBrand.fallbackName;
  const breadcrumbs =
    pageMeta?.breadcrumbs && pageMeta.breadcrumbs.length > 0
      ? pageMeta.breadcrumbs
      : navigationState.breadcrumbs;

  const handleLogout = async () => {
    setLoggingOut(true);
    await auth.logoutAndRedirect({ replace: true });
  };

  const sidebar = (compact = false) => (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white">
      <div className={cn("flex h-[68px] shrink-0 items-center gap-3", compact ? "justify-center px-3" : "px-5")}>
        <Link
          aria-label={starterBrand.name}
          className="grid h-9 w-9 shrink-0 place-items-center text-blue-600"
          to={`/view/${appType}/admin`}
        >
          <OpenXiangdaMark />
        </Link>
        <div className={cn("min-w-0", compact && "hidden")}>
          <Link className="block truncate text-[15px] font-semibold leading-5 text-slate-950" to={`/view/${appType}/admin`}>
            {starterBrand.name}
          </Link>
          <div className="mt-0.5 truncate text-xs leading-4 text-slate-500">{starterBrand.subtitle}</div>
        </div>
      </div>

      <nav className={cn("ox-scrollbar min-h-0 flex-1 overflow-y-auto py-3", compact ? "px-2" : "space-y-2 px-2.5")}>
        {groups.map(group => {
          const collapsed = collapsedGroups[group.title];
          const groupActive = group.items.some(item => navigationState.activePath === item.path);
          const GroupIcon = group.icon;
          return (
            <section className="min-w-0" key={group.title}>
              <button
                aria-label={group.title}
                aria-expanded={!collapsed}
                className={cn(
                  "flex h-9 w-full items-center rounded-xl text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950",
                  compact ? "justify-center px-0" : "justify-between gap-2 px-2.5",
                  groupActive && "bg-slate-50 text-slate-950",
                )}
                onClick={() => setCollapsedGroups(prev => ({ ...prev, [group.title]: !collapsed }))}
                type="button"
              >
                <span className={cn("flex min-w-0 items-center gap-2", compact && "justify-center")}>
                  <GroupIcon
                    className={cn(groupActive ? "text-blue-600" : "text-slate-500")}
                    size={15}
                    strokeWidth={2}
                  />
                  <span className={cn("truncate", compact && "sr-only")}>{group.title}</span>
                </span>
                {compact ? (
                  null
                ) : (
                  <ChevronDown
                    className={cn(
                      "shrink-0 text-slate-500 transition-transform duration-200 ease-out motion-reduce:transition-none",
                      collapsed && "-rotate-90",
                    )}
                    size={15}
                    strokeWidth={2}
                  />
                )}
              </button>
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
                  collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
                )}
              >
                <div className={cn("min-h-0 overflow-hidden", collapsed && "pointer-events-none")}>
                  <div className={cn("mt-1 space-y-0.5", compact && "mt-1")}>
                    {group.items.map(item => {
                      const active = navigationState.activePath === item.path;
                      return (
                        <Link
                          aria-label={item.name}
                          className={cn(
                            "group relative flex h-9 items-center rounded-xl text-sm transition",
                            compact ? "justify-center px-0" : "gap-2.5 pl-7 pr-3",
                            active
                              ? "bg-[#eef6ff] text-[#1677ff]"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                          )}
                          key={`${group.title}-${item.name}-${item.path}`}
                          onClick={() => setMobileOpen(false)}
                          to={item.path}
                        >
                          <span
                            className={cn(
                              "absolute -left-2.5 top-1 h-7 w-1 rounded-r-full transition",
                              active ? "bg-[#1677ff]" : "bg-transparent",
                              compact && "-left-2",
                            )}
                          />
                          <span
                            className={cn(
                              "grid h-5 w-5 shrink-0 place-items-center transition",
                              active ? "text-[#1677ff]" : "text-slate-500 group-hover:text-slate-700",
                            )}
                          >
                            <item.icon size={16} strokeWidth={2} />
                          </span>
                          <span className={cn("min-w-0 flex-1 truncate font-medium", compact && "sr-only")}>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </nav>
      <div className="shrink-0 px-3 py-4">
        <button
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-lg text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950",
            compact ? "justify-center px-0" : "px-2.5",
          )}
          onClick={() => setSidebarCollapsed(value => !value)}
          type="button"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-600 ring-1 ring-slate-200">
            {compact ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </span>
          <span className={cn("truncate", compact && "sr-only")}>{compact ? "展开侧边栏" : "收起侧边栏"}</span>
        </button>
      </div>
    </aside>
  );

  return (
    <PermissionBoundary
      fallback={state => <AdminPermissionState state={state} />}
      loadingFallback={<AdminLoadingState />}
      menuCode="admin_dashboard"
      path={`/view/${appType}/admin`}
      routeCode="admin.dashboard"
    >
      <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#edf4ff_0%,#f8fafc_42%,#f1f5f9_100%)] text-slate-950">
        <div className={cn("fixed inset-y-0 left-0 z-30 hidden lg:block", sidebarCollapsed ? "w-[76px]" : "w-60")}>
          {sidebar(sidebarCollapsed)}
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              aria-label="关闭导航遮罩"
              className="absolute inset-0 bg-slate-950/35"
              onClick={() => setMobileOpen(false)}
              type="button"
            />
            <div className="relative h-full w-[min(22rem,88vw)]">
              <button
                aria-label="关闭导航"
                className="absolute right-3 top-3 z-50 grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 shadow-sm ring-1 ring-slate-200"
                onClick={() => setMobileOpen(false)}
                type="button"
              >
                <X size={19} />
              </button>
              {sidebar(false)}
            </div>
          </div>
        ) : null}

        <main className={cn("min-w-0 transition-[padding] duration-200", sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-60")}>
          <header className="sticky top-0 z-20 border-b border-white/70 bg-white/[0.8] backdrop-blur-xl">
            <div className="flex h-20 min-w-0 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  aria-label="打开导航"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 lg:hidden"
                  onClick={() => setMobileOpen(true)}
                  type="button"
                >
                  <Menu size={20} />
                </button>
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-slate-500">
                    {breadcrumbs.join(" / ")}
                  </div>
                  <div className="mt-1 truncate text-lg font-semibold text-slate-950">{headerTitle}</div>
                </div>
              </div>

              <div className="flex shrink-0 items-center">
                <div className="relative">
                  <button
                    className="flex h-12 items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition hover:bg-white/80"
                    onClick={() => setUserMenuOpen(open => !open)}
                    type="button"
                  >
                    <UserAvatar name={userName} src={userAvatar} />
                    <span className="hidden min-w-0 sm:block">
                      <span className="block max-w-28 truncate text-sm font-semibold leading-5 text-slate-950">{userName}</span>
                      <span className="block max-w-28 truncate text-xs leading-4 text-slate-500">{userRole}</span>
                    </span>
                    <ChevronDown className="text-slate-500" size={16} />
                  </button>
                  {userMenuOpen ? (
                    <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
                      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                        <UserAvatar name={userName} src={userAvatar} size="lg" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-950">{userName}</div>
                          <div className="mt-0.5 truncate text-xs text-slate-500">{userRole}</div>
                        </div>
                      </div>
                      <button
                        className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50"
                        onClick={() => {
                          setUserMenuOpen(false);
                          void bootstrap.reload();
                        }}
                        type="button"
                      >
                        <RefreshCw size={17} />
                        刷新数据
                      </button>
                      <button
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                        disabled={loggingOut}
                        onClick={() => void handleLogout()}
                        type="button"
                      >
                        <LogOut size={17} />
                        {loggingOut ? "正在退出" : "退出登录"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <AdminPageMetaContext.Provider value={setPageMeta}>
            <div className="ox-admin-content mx-auto min-w-0 max-w-[1440px] px-4 py-5 sm:px-6">
              <Outlet />
            </div>
          </AdminPageMetaContext.Provider>
        </main>
      </div>
    </PermissionBoundary>
  );
}

function UserAvatar({
  name,
  size = "md",
  src,
}: {
  name: string;
  size?: "md" | "lg";
  src?: string;
}) {
  const className = cn(
    "shrink-0 overflow-hidden rounded-full bg-[linear-gradient(135deg,#2563eb_0%,#38bdf8_100%)] text-white shadow-sm ring-2 ring-white",
    size === "lg" ? "h-11 w-11" : "h-9 w-9",
  );

  if (src) {
    return (
      <img
        alt=""
        className={cn(className, "object-cover")}
        referrerPolicy="no-referrer"
        src={src}
      />
    );
  }

  return (
    <span className={cn(className, "grid place-items-center text-sm font-semibold")}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function OpenXiangdaMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-8 w-8"
      fill="none"
      viewBox="0 0 36 36"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M18 3.5 32.5 31H26L18 15.7 10 31H3.5L18 3.5Z"
        fill="currentColor"
      />
      <path d="M18 20.2 23.4 31H12.6L18 20.2Z" fill="white" />
      <path
        d="M18 9.5 8.2 31H3.5L18 3.5l14.5 27.5h-4.7L18 9.5Z"
        fill="currentColor"
        opacity="0.86"
      />
    </svg>
  );
}

function AdminPermissionState({ state }: { state: PermissionBoundaryFallbackState }) {
  const auth = useRuntimeAuth();

  useEffect(() => {
    if (state.errorType === "unauthenticated") {
      void auth.redirectToLogin({ replace: true });
    }
  }, [auth, state.errorType]);

  if (state.errorType === "unauthenticated") {
    return (
      <StatePage
        actions={
          <PrimaryButton onClick={() => void auth.redirectToLogin({ replace: true })}>
            立即登录
          </PrimaryButton>
        }
        description="当前浏览器没有有效登录态，正在为你跳转到登录页。"
        fullScreen
        icon={<LogOut size={24} />}
        status="401"
        title="需要登录"
      />
    );
  }

  return (
    <StatePage
      actions={
        <>
          <SecondaryButton onClick={() => window.history.back()}>返回上一页</SecondaryButton>
          <PrimaryButton onClick={() => void auth.redirectToLogin({ replace: true })}>
            切换账号
          </PrimaryButton>
        </>
      }
      description={state.message || "请切换到有权限的账号，或联系管理员开通后台访问权限。"}
      fullScreen
      icon={<Shield size={24} />}
      status="403"
      title="无权访问管理后台"
    />
  );
}

function AdminLoadingState() {
  return (
    <StatePage
      description="正在读取应用、用户和页面权限信息。"
      fullScreen
      icon={<Shield size={24} />}
      status="LOADING"
      title="正在进入应用"
    />
  );
}

function collectMenuCodes(items: PlatformMenuLike[]): Set<string> {
  const codes = new Set<string>();
  const visit = (item: PlatformMenuLike) => {
    if (item.isHidden) return;
    for (const value of [item.code, item.resourceCode, item.routeCode]) {
      if (value) codes.add(String(value));
    }
    for (const child of item.children || []) visit(child);
  };
  for (const item of items) visit(item);
  return codes;
}

function isMenuActive(pathname: string, search: string, target: string) {
  const normalize = (value: string) =>
    value
      .replace(/[?#].*$/, "")
      .replace(/\/+$/, "")
      .replace(/\/{2,}/g, "/");
  if (target.includes("?")) return `${pathname}${search}` === target;
  return normalize(pathname) === normalize(target);
}

function resolveNavigationState(
  groups: StarterNavigationGroup[],
  pathname: string,
  search: string,
  appType: string,
): NavigationState {
  const fallback: NavigationState = {
    breadcrumbs: ["首页"],
    title: starterBrand.fallbackName,
  };
  const entries = groups.flatMap(group => group.items.map(item => ({ group, item })));
  const exact = entries.find(({ item }) => isMenuActive(pathname, search, item.path));
  if (exact) {
    return {
      activePath: exact.item.path,
      breadcrumbs: ["首页", exact.group.title, exact.item.name],
      title: exact.item.name,
    };
  }

  const route = parseAdminRoute(pathname, appType);
  if (!route) return fallback;

  const related = findRelatedNavigationEntry(entries, route);
  if (related) {
    const title =
      route.kind === "form-detail" || route.kind === "process-detail"
        ? `${related.item.name}详情`
        : related.item.name;
    return {
      activePath: related.item.path,
      breadcrumbs: ["首页", related.group.title, related.item.name],
      title,
    };
  }

  if (route.kind === "data") {
    return { breadcrumbs: ["首页", "数据管理"], title: "业务数据" };
  }
  if (route.kind === "form-new") {
    return { breadcrumbs: ["首页", "业务办理"], title: "发起申请" };
  }
  if (route.kind === "form-detail") {
    return { breadcrumbs: ["首页", "业务记录"], title: "记录详情" };
  }
  return { breadcrumbs: ["首页", "流程办理"], title: "流程详情" };
}

function parseAdminRoute(pathname: string, appType: string) {
  const escapedAppType = appType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefix = new RegExp(`^/view/${escapedAppType}/admin/`);
  if (!prefix.test(pathname)) return null;
  const rest = pathname.replace(prefix, "");
  const [kind, formUuid, tail] = rest.split("/");
  if (kind === "data" && formUuid) return { formUuid, kind: "data" as const };
  if (kind === "forms" && formUuid && tail === "new") return { formUuid, kind: "form-new" as const };
  if (kind === "forms" && formUuid) return { formUuid, kind: "form-detail" as const };
  if (kind === "process" && formUuid) return { formUuid, kind: "process-detail" as const };
  return null;
}

function findRelatedNavigationEntry(
  entries: Array<{ group: StarterNavigationGroup; item: StarterNavigationGroup["items"][number] }>,
  route: NonNullable<ReturnType<typeof parseAdminRoute>>,
) {
  const formPathNeedle = `/forms/${route.formUuid}/new`;
  const dataPathNeedle = `/data/${route.formUuid}`;
  if (route.kind === "data") return entries.find(({ item }) => item.path.includes(dataPathNeedle));
  if (route.kind === "form-new") return entries.find(({ item }) => item.path.includes(formPathNeedle));
  return (
    entries.find(({ item }) => item.path.includes(dataPathNeedle)) ||
    entries.find(({ item }) => item.path.includes(formPathNeedle))
  );
}
