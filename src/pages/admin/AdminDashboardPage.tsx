import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { dashboardContent } from "@/app/starter-content";
import {
  ActivityItem,
  ChartPanel,
  DashboardMetricCard,
  DonutChart,
  EnvironmentRow,
  TodoItem,
  TrendLineChart,
  type AppTone,
  type DonutItem,
  type TrendSeries,
} from "@/shared/ui";

type DashboardIconKey = "chart" | "clipboard" | "file" | "refresh" | "shield" | "server";

const metricIcons = {
  chart: BarChart3,
  clipboard: ClipboardList,
  file: FileText,
  refresh: RefreshCw,
  server: Server,
  shield: ShieldCheck,
} satisfies Record<DashboardIconKey, typeof BarChart3>;

const itemIcons = {
  amber: Clock3,
  blue: CheckCircle2,
  emerald: ShieldCheck,
  rose: Sparkles,
  slate: Server,
  violet: ClipboardList,
} satisfies Record<AppTone, typeof CheckCircle2>;

export function AdminDashboardPage() {
  return (
    <div className="min-w-0 space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardContent.metrics.map(metric => {
          const Icon = metricIcons[(metric.icon as DashboardIconKey) || "chart"] ?? BarChart3;
          return (
            <DashboardMetricCard
              caption={metric.caption}
              delta={metric.delta}
              icon={Icon}
              key={metric.key}
              label={metric.label}
              tone={metric.tone as AppTone}
              value={metric.value}
            />
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <ChartPanel
          action={<span className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500">近 7 天</span>}
          title={dashboardContent.trend.title}
        >
          <TrendLineChart
            labels={[...dashboardContent.trend.labels]}
            series={dashboardContent.trend.series.map(item => ({ ...item })) as TrendSeries[]}
          />
        </ChartPanel>

        <ChartPanel
          action={<span className="text-xs font-medium text-blue-600">{dashboardContent.todos.actionText}</span>}
          title={dashboardContent.todos.title}
        >
          <div className="space-y-1">
            {dashboardContent.todos.items.map(item => {
              const tone = item.tone as AppTone;
              const Icon = itemIcons[tone] ?? ClipboardList;
              return (
                <TodoItem
                  icon={<Icon size={15} strokeWidth={2.2} />}
                  key={item.key}
                  meta={item.meta}
                  time={item.time}
                  title={item.title}
                  tone={tone}
                />
              );
            })}
          </div>
        </ChartPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1fr)_minmax(300px,0.9fr)]">
        <ChartPanel title={dashboardContent.aiReview.title}>
          <div className="grid gap-3 md:grid-cols-[minmax(180px,0.85fr)_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[minmax(180px,0.85fr)_minmax(0,1fr)]">
            <DonutChart
              centerLabel={dashboardContent.aiReview.centerLabel}
              centerValue={dashboardContent.aiReview.centerValue}
              items={dashboardContent.aiReview.items.map(({ color, label, value }) => ({
                color,
                label,
                value,
              })) as DonutItem[]}
            />
            <div className="flex flex-col justify-center space-y-2">
              {dashboardContent.aiReview.items.map(item => (
                <div className="flex items-center justify-between gap-3 text-sm" key={item.label}>
                  <span className="flex min-w-0 items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="shrink-0 font-medium text-slate-900">
                    {item.value}
                    <span className="ml-2 text-xs font-normal text-slate-500">{item.percent}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ChartPanel>

        <ChartPanel
          action={<span className="text-xs font-medium text-blue-600">{dashboardContent.activities.actionText}</span>}
          title={dashboardContent.activities.title}
        >
          <div className="space-y-1">
            {dashboardContent.activities.items.map(item => {
              const tone = item.tone as AppTone;
              const Icon = itemIcons[tone] ?? Sparkles;
              return (
                <ActivityItem
                  icon={<Icon size={15} strokeWidth={2.2} />}
                  key={item.key}
                  subtitle={item.subtitle}
                  time={item.time}
                  title={item.title}
                  tone={tone}
                />
              );
            })}
          </div>
        </ChartPanel>

        <ChartPanel
          action={<span className="text-xs font-medium text-blue-600">{dashboardContent.environment.actionText}</span>}
          title={dashboardContent.environment.title}
        >
          <div className="rounded-xl border border-slate-100 px-3">
            {dashboardContent.environment.rows.map(row => (
              <EnvironmentRow
                key={row.key}
                label={row.label}
                status={row.status as "default" | "success" | "warning" | undefined}
                value={row.value}
              />
            ))}
          </div>
        </ChartPanel>
      </section>
    </div>
  );
}
