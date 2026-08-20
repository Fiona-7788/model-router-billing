import type { ComponentType, SVGProps } from "react";
import { BriefcaseBusiness, Database, DollarSign, FileSearch, Home, ShieldCheck } from "lucide-react";

export type StarterNavigationItem = {
  code?: string;
  hint?: string;
  icon: ComponentType<
    SVGProps<SVGSVGElement> & { size?: string | number; strokeWidth?: string | number }
  >;
  name: string;
  path: string;
  routeCode?: string;
};

export type StarterNavigationGroup = {
  icon: ComponentType<
    SVGProps<SVGSVGElement> & { size?: string | number; strokeWidth?: string | number }
  >;
  title: string;
  items: StarterNavigationItem[];
};

export type BuildStarterNavigationOptions = {
  appType: string;
};

export const viewPath = (appType: string, path: string) =>
  `/view/${appType}/${path}`.replace(/\/{2,}/g, "/");

export function buildStarterAdminNavigation({
  appType,
}: BuildStarterNavigationOptions): StarterNavigationGroup[] {
  return [
    {
      icon: DollarSign,
      title: "Model Router 账单",
      items: [
        {
          code: "billing_dashboard",
          icon: DollarSign,
          name: "账单看板",
          path: viewPath(appType, "admin/billing"),
          routeCode: "billing.dashboard",
        },
        {
          code: "billing_call_sources",
          icon: FileSearch,
          name: "调取来源",
          path: viewPath(appType, "admin/billing/call-sources"),
          routeCode: "billing.call_sources",
        },
        {
          code: "form_management",
          icon: Database,
          name: "表单管理",
          path: viewPath(appType, "admin/form-management"),
          routeCode: "admin.form_management",
        },
      ],
    },
    {
      icon: BriefcaseBusiness,
      title: "应用工作台",
      items: [
        {
          code: "admin_dashboard",
          icon: Home,
          name: "工作台",
          path: viewPath(appType, "admin"),
          routeCode: "admin.dashboard",
        },
        {
          code: "admin_login_logs",
          icon: ShieldCheck,
          name: "登录日志",
          path: viewPath(appType, "admin/login-logs"),
          routeCode: "admin.login_logs",
        },
      ],
    },
  ];
}

export function filterNavigationByMenuCodes(
  groups: StarterNavigationGroup[],
  menuCodes: Set<string>,
) {
  if (!menuCodes.size) return groups;
  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(
        item =>
          (!item.code && !item.routeCode) ||
          Boolean(item.code && menuCodes.has(item.code)) ||
          Boolean(item.routeCode && menuCodes.has(item.routeCode)),
      ),
    }))
    .filter(group => group.items.length > 0);
}
