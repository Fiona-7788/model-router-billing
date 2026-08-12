import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { motion, useReducedMotion } from "framer-motion";
import type { ComponentType, ReactNode } from "react";

export type MacTone =
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "slate";

export interface MacAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

const toneClasses: Record<MacTone, { soft: string; text: string; dot: string; ring: string }> = {
  amber: {
    dot: "bg-amber-500",
    ring: "ring-amber-200",
    soft: "bg-amber-50 text-amber-700",
    text: "text-amber-700",
  },
  blue: {
    dot: "bg-blue-500",
    ring: "ring-blue-200",
    soft: "bg-blue-50 text-blue-700",
    text: "text-blue-700",
  },
  emerald: {
    dot: "bg-emerald-500",
    ring: "ring-emerald-200",
    soft: "bg-emerald-50 text-emerald-700",
    text: "text-emerald-700",
  },
  rose: {
    dot: "bg-rose-500",
    ring: "ring-rose-200",
    soft: "bg-rose-50 text-rose-700",
    text: "text-rose-700",
  },
  slate: {
    dot: "bg-slate-500",
    ring: "ring-slate-200",
    soft: "bg-slate-100 text-slate-700",
    text: "text-slate-700",
  },
  violet: {
    dot: "bg-violet-500",
    ring: "ring-violet-200",
    soft: "bg-violet-50 text-violet-700",
    text: "text-violet-700",
  },
};

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function useEntranceMotion() {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return {};
  return {
    animate: { opacity: 1, y: 0 },
    initial: { opacity: 0, y: 10 },
    transition: { duration: 0.32, ease: "easeOut" as const },
  };
}

function MacChartEmpty({ height }: { height: number }) {
  return (
    <div
      className="grid place-items-center rounded-lg bg-slate-50 text-sm text-slate-400"
      style={{ height }}
    >
      暂无图表数据
    </div>
  );
}

export function MacPageHeader({
  actions,
  description,
  eyebrow,
  meta,
  title,
}: {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/[0.85] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#4f46e5,#06b6d4,#22c55e,#f59e0b)]" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          ) : null}
          {meta ? <div className="mt-4 flex flex-wrap gap-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function MacPanel({
  children,
  className,
  title,
  description,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/70 bg-white/[0.88] p-5 shadow-[0_18px_55px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/5 backdrop-blur",
        className,
      )}
    >
      {title || description || action ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-slate-950">{title}</h2> : null}
            {description ? (
              <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function MacMetricCard({
  caption,
  icon: Icon,
  label,
  tone = "blue",
  value,
}: {
  caption?: ReactNode;
  icon?: ComponentType<{ size?: string | number; className?: string }>;
  label: ReactNode;
  tone?: MacTone;
  value: ReactNode;
}) {
  const classes = toneClasses[tone];
  return (
    <div className="group rounded-2xl border border-white/70 bg-white/[0.82] p-4 shadow-[0_16px_45px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.09)]">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("grid h-10 w-10 place-items-center rounded-xl", classes.soft)}>
          {Icon ? <Icon size={20} /> : <span className={cn("h-2.5 w-2.5 rounded-full", classes.dot)} />}
        </div>
        <span className={cn("h-2 w-2 rounded-full ring-4", classes.dot, classes.ring)} />
      </div>
      <div className="mt-4 text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
      {caption ? <div className="mt-3 text-xs leading-5 text-slate-500">{caption}</div> : null}
    </div>
  );
}

export function MacDashboardMetricCard({
  caption,
  delta,
  icon: Icon,
  label,
  tone = "blue",
  value,
}: {
  caption?: ReactNode;
  delta?: ReactNode;
  icon?: ComponentType<{
    className?: string;
    size?: string | number;
    strokeWidth?: string | number;
  }>;
  label: ReactNode;
  tone?: MacTone;
  value: ReactNode;
}) {
  const classes = toneClasses[tone];
  const motionProps = useEntranceMotion();
  return (
    <motion.div
      {...motionProps}
      className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start gap-3">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", classes.soft)}>
          {Icon ? <Icon size={21} strokeWidth={2.2} /> : <span className={cn("h-2.5 w-2.5 rounded-full", classes.dot)} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-5 text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold leading-8 text-slate-950">{value}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {caption ? <span>{caption}</span> : null}
            {delta ? <span className={classes.text}>{delta}</span> : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function MacChartPanel({
  action,
  children,
  className,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  title: ReactNode;
}) {
  const motionProps = useEntranceMotion();
  return (
    <motion.section
      {...motionProps}
      className={cn(
        "min-w-0 rounded-xl border border-slate-200/70 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.045)]",
        className,
      )}
    >
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <h2 className="truncate text-sm font-semibold text-slate-950">{title}</h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </motion.section>
  );
}

export type MacTrendSeries = {
  color: string;
  data: number[];
  name: string;
};

export function MacTrendLineChart({
  height = 286,
  labels,
  series,
}: {
  height?: number;
  labels: string[];
  series: MacTrendSeries[];
}) {
  if (!labels.length || !series.length) return <MacChartEmpty height={height} />;

  const option: EChartsOption = {
    color: series.map(item => item.color),
    grid: { bottom: 34, left: 44, right: 18, top: 34 },
    legend: {
      icon: "circle",
      itemHeight: 7,
      itemWidth: 7,
      left: 0,
      textStyle: { color: "#64748b", fontSize: 12 },
      top: 0,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.92)",
      borderColor: "transparent",
      textStyle: { color: "#fff" },
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: labels,
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
      axisLabel: { color: "#64748b", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#64748b", fontSize: 11 },
      splitLine: { lineStyle: { color: "#eef2f7" } },
    },
    series: series.map(item => ({
      name: item.name,
      type: "line",
      smooth: true,
      symbol: "circle",
      symbolSize: 7,
      data: item.data,
      lineStyle: { width: 3 },
      areaStyle: { opacity: 0.08 },
    })),
  };

  return (
    <ReactECharts
      lazyUpdate
      notMerge
      option={option}
      style={{ height, width: "100%" }}
    />
  );
}

export type MacDonutItem = {
  color: string;
  label: string;
  value: number;
};

export function MacDonutChart({
  centerLabel,
  centerValue,
  height = 220,
  items,
}: {
  centerLabel: string;
  centerValue: string;
  height?: number;
  items: MacDonutItem[];
}) {
  if (!items.length) return <MacChartEmpty height={height} />;

  const option: EChartsOption = {
    color: items.map(item => item.color),
    graphic: [
      {
        type: "text",
        left: "center",
        top: "42%",
        style: {
          fill: "#0f172a",
          fontSize: 24,
          fontWeight: 700,
          text: centerValue,
          align: "center",
        },
      },
      {
        type: "text",
        left: "center",
        top: "55%",
        style: {
          fill: "#64748b",
          fontSize: 12,
          text: centerLabel,
          align: "center",
        },
      },
    ],
    series: [
      {
        type: "pie",
        radius: ["62%", "82%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        data: items.map(item => ({ name: item.label, value: item.value })),
      },
    ],
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(15, 23, 42, 0.92)",
      borderColor: "transparent",
      textStyle: { color: "#fff" },
    },
  };

  return (
    <ReactECharts
      lazyUpdate
      notMerge
      option={option}
      style={{ height, width: "100%" }}
    />
  );
}

export function MacTodoItem({
  icon,
  meta,
  time,
  title,
  tone = "blue",
}: {
  icon?: ReactNode;
  meta?: ReactNode;
  time?: ReactNode;
  title: ReactNode;
  tone?: MacTone;
}) {
  const classes = toneClasses[tone];
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-50">
      <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", classes.soft)}>
        {icon || <span className={cn("h-2 w-2 rounded-full", classes.dot)} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-950">{title}</div>
        {meta ? <div className="mt-0.5 truncate text-xs text-slate-500">{meta}</div> : null}
      </div>
      {time ? <div className="shrink-0 text-xs text-slate-500">{time}</div> : null}
    </div>
  );
}

export function MacActivityItem({
  icon,
  subtitle,
  time,
  title,
  tone = "blue",
}: {
  icon?: ReactNode;
  subtitle?: ReactNode;
  time?: ReactNode;
  title: ReactNode;
  tone?: MacTone;
}) {
  const classes = toneClasses[tone];
  return (
    <div className="flex min-w-0 items-start gap-3 py-2">
      <div className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", classes.soft)}>
        {icon || <span className={cn("h-2 w-2 rounded-full", classes.dot)} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-950">{title}</div>
        {subtitle ? <div className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</div> : null}
      </div>
      {time ? <div className="shrink-0 text-xs text-slate-500">{time}</div> : null}
    </div>
  );
}

export function MacEnvironmentRow({
  label,
  status,
  value,
}: {
  label: ReactNode;
  status?: "success" | "warning" | "default";
  value: ReactNode;
}) {
  const statusClass =
    status === "success"
      ? "text-emerald-600"
      : status === "warning"
        ? "text-amber-600"
        : "text-slate-600";
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <div className="truncate text-sm text-slate-500">{label}</div>
      <div className={cn("shrink-0 truncate text-right text-sm font-semibold", statusClass)}>{value}</div>
    </div>
  );
}

export function MacStatusPill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: MacTone;
}) {
  const classes = toneClasses[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", classes.soft)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", classes.dot)} />
      {children}
    </span>
  );
}

export function MacStatePage({
  actions,
  description,
  fullScreen = false,
  icon,
  status,
  title,
}: {
  actions?: ReactNode;
  description?: ReactNode;
  fullScreen?: boolean;
  icon?: ReactNode;
  status?: ReactNode;
  title: ReactNode;
}) {
  return (
    <main
      className={cn(
        "grid place-items-center bg-slate-100/80 px-5",
        fullScreen ? "min-h-screen" : "min-h-[460px]",
      )}
    >
      <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/70 bg-white/90 p-7 text-center shadow-[0_24px_80px_rgba(15,23,42,0.10)] ring-1 ring-slate-900/5 backdrop-blur">
        {status ? <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{status}</div> : null}
        <div className="mx-auto mt-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300/60">
          {icon || "OX"}
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">{title}</h1>
        {description ? (
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
        {actions ? <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{actions}</div> : null}
      </section>
    </main>
  );
}

export function MacPrimaryButton({
  children,
  className,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-lg shadow-slate-300/60 transition hover:bg-slate-800",
        className,
      )}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

export function MacSecondaryButton({
  children,
  className,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50",
        className,
      )}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

export function MacListItem({
  children,
  icon,
  tone = "blue",
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: MacTone;
}) {
  const classes = toneClasses[tone];
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-200/70 bg-white/[0.72] p-3">
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", classes.soft)}>
        {icon || <span className={cn("h-2 w-2 rounded-full", classes.dot)} />}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function MacDiagnosticPanel({
  data,
  title = "详细信息",
}: {
  data: unknown;
  title?: string;
}) {
  return (
    <details className="group rounded-2xl border border-slate-200/80 bg-white/70 p-4">
      <summary className="cursor-pointer select-none text-sm font-semibold text-slate-700">
        {title}
        <span className="ml-2 text-xs font-normal text-slate-400">展开查看完整内容</span>
      </summary>
      <pre className="ox-scrollbar mt-4 max-h-96 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

export function MacTrendBars({
  values,
  tone = "blue",
}: {
  values: number[];
  tone?: MacTone;
}) {
  const color =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : tone === "rose"
          ? "bg-rose-500"
          : tone === "violet"
            ? "bg-violet-500"
            : "bg-blue-500";
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-32 items-end gap-2 rounded-2xl bg-slate-100/70 p-4">
      {values.map((value, index) => (
        <div
          className={cn("min-w-0 flex-1 rounded-t-lg opacity-80", color)}
          key={`${value}-${index}`}
          style={{ height: `${Math.max(12, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
