import { useCallback, useEffect, useMemo, useState } from "react";
import { DatePicker, Select, Spin, Table, Tag, Button, Segmented } from "antd";
import type { ColumnsType } from "antd/es/table";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Download,
} from "lucide-react";
import dayjs, { Dayjs } from "dayjs";
import * as XLSX from "xlsx";

import { billingApi, COMPANY_COLORS, getCompanyColor } from "@/shared/billing/api-client";
import type {
  Company,
  CompanyCostSummary,
  CostOverviewMetrics,
  CostTrendPoint,
  ModelCostItem,
} from "@/shared/billing/types";
import { cn } from "@/shared/ui";

echarts.use([BarChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

const MODEL_CATEGORIES = ["全部类别", "大语言模型", "视觉模型", "全模态模型", "语音模型", "向量模型"];

type Granularity = "daily" | "weekly" | "monthly";

function formatCurrency(value: number): string {
  if (value >= 10000) return `¥${(value / 10000).toFixed(2)}万`;
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value: number): string {
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
  if (value >= 1e4) return `${(value / 1e4).toFixed(1)}万`;
  return value.toLocaleString("zh-CN");
}

/* ------------------------------------------------------------------ */
/*  Metric Card                                                        */
/* ------------------------------------------------------------------ */

function MetricCard({
  icon,
  label,
  value,
  sub,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  trend?: number;
}) {
  const isPositive = trend !== undefined && trend > 0;
  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
          {icon}
        </div>
        <span className="text-sm font-medium text-slate-500">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {trend !== undefined ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              isPositive ? "text-rose-500" : "text-emerald-500",
            )}
          >
            <TrendIcon size={14} />
            {Math.abs(trend * 100).toFixed(1)}%
          </span>
        ) : null}
        {sub ? <span className="text-slate-400">{sub}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  聚合辅助：将日粒度数据按周/月汇总                                   */
/* ------------------------------------------------------------------ */

function aggregateTrendData(
  data: CostTrendPoint[],
  granularity: Granularity,
): CostTrendPoint[] {
  if (granularity === "daily") return data;

  const aggMap = new Map<string, { periodKey: string; company: string; cost: number }>();

  for (const point of data) {
    const year = dayjs().year();
    const fullDate = dayjs(`${year}-${point.date}`, "YYYY-MM-DD");
    if (!fullDate.isValid()) continue;

    // periodKey 是可排序的字符串，同时作为 chart 的 x 轴值
    const periodKey = granularity === "weekly"
      ? fullDate.startOf("week").format("YYYY-MM-DD")   // 周一日期
      : fullDate.format("YYYY-MM");                      // 年月

    const mapKey = `${point.company}|${periodKey}`;
    const existing = aggMap.get(mapKey);
    if (existing) {
      existing.cost += point.cost;
    } else {
      aggMap.set(mapKey, { periodKey, company: point.company, cost: point.cost });
    }
  }

  return Array.from(aggMap.values()).map((v) => ({
    date: v.periodKey,  // 可排序的 key 作为 date
    company: v.company,
    cost: v.cost,
  }));
}

/** 将聚合 key 格式化为显示标签 */
function formatPeriodLabel(dateStr: string, granularity: Granularity): string {
  if (granularity === "weekly") {
    // "2026-08-11" → "08/11周"
    const d = dayjs(dateStr);
    return d.isValid() ? `${d.format("MM/DD")}周` : dateStr;
  }
  if (granularity === "monthly") {
    // "2026-08" → "2026-08"
    return dateStr;
  }
  return dateStr;
}

/* ------------------------------------------------------------------ */
/*  Stacked Bar Chart                                                  */
/* ------------------------------------------------------------------ */

function CostBarChart({ data, granularity }: { data: CostTrendPoint[]; granularity: Granularity }) {
  const aggregated = useMemo(() => aggregateTrendData(data, granularity), [data, granularity]);

  const option = useMemo(() => {
    const dateSet = new Set(aggregated.map((d) => d.date));
    const dates = Array.from(dateSet).sort();
    const companyNames = Array.from(new Set(aggregated.map((d) => d.company)));

    // 将排序后的日期 key 转换为显示标签
    const displayLabels = dates.map((d) => formatPeriodLabel(d, granularity));

    const series = companyNames.map((name) => ({
      name,
      type: "bar" as const,
      stack: "total",
      emphasis: { focus: "series" as const },
      itemStyle: { color: getCompanyColor(name) },
      data: dates.map((date) => {
        const point = aggregated.find((d) => d.date === date && d.company === name);
        return point ? Math.round(point.cost) : 0;
      }),
    }));

    return {
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        formatter: (params: Array<{ seriesName: string; value: number; marker: string; axisValue?: string; dataIndex?: number }>) => {
          const idx = params[0]?.dataIndex ?? 0;
          const label = displayLabels[idx] || params[0]?.axisValue || "";
          let html = `<b>${label}</b><br/>`;
          let total = 0;
          for (const p of params) {
            if (p.value > 0) {
              html += `${p.marker} ${p.seriesName}: ¥${p.value}<br/>`;
              total += p.value;
            }
          }
          html += `<b>合计: ¥${total}</b>`;
          return html;
        },
      },
      legend: {
        data: companyNames,
        top: 0,
        textStyle: { fontSize: 12 },
      },
      grid: {
        left: 12,
        right: 12,
        bottom: 8,
        top: 40,
        containLabel: true,
      },
      xAxis: {
        type: "category" as const,
        data: displayLabels,
        axisLabel: { fontSize: 11, color: "#64748b" },
        axisLine: { lineStyle: { color: "#e2e8f0" } },
      },
      yAxis: {
        type: "value" as const,
        axisLabel: {
          fontSize: 11,
          color: "#64748b",
          formatter: (v: number) => String(v),
        },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
      },
      series,
    };
  }, [aggregated, granularity]);

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      style={{ height: 400, width: "100%" }}
      notMerge
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export function BillingDashboardPage() {
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [category, setCategory] = useState<string>("全部类别");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [overview, setOverview] = useState<CostOverviewMetrics | null>(null);
  const [trend, setTrend] = useState<CostTrendPoint[]>([]);
  const [modelCosts, setModelCosts] = useState<ModelCostItem[]>([]);
  const [summary, setSummary] = useState<CompanyCostSummary[]>([]);
  const [loading, setLoading] = useState(false);

  // 聚合粒度
  const [granularity, setGranularity] = useState<Granularity>("daily");

  // 日期范围：默认最近 30 天（仅在按日聚合时显示）
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, "day"), dayjs()]);
  const [quickRange, setQuickRange] = useState<string>("last30");

  const startDate = dateRange[0].format("YYYY-MM-DD");
  const endDate = dateRange[1].format("YYYY-MM-DD");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        startDate,
        endDate,
        companyId,
        modelCategory: category === "全部类别" ? undefined : category,
      };
      const [ov, tr, mc, sm] = await Promise.all([
        billingApi.getCostOverview(params),
        billingApi.getCostTrend(params),
        billingApi.getModelCostList(params),
        billingApi.getCompanyCostSummary(params),
      ]);
      setOverview(ov || { totalCost: 0, currentPeriodCost: 0, lastPeriodCost: 0, costChangeRate: 0, totalCalls: 0, totalTokens: 0 });
      setTrend(Array.isArray(tr) ? tr : []);
      setModelCosts(Array.isArray(mc) ? mc : []);
      setSummary(Array.isArray(sm) ? sm : []);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, companyId, category]);

  useEffect(() => {
    billingApi.getCompanies().then(setCompanies);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // 导出 Excel — 导出今日概况数据
  const handleExport = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // 模型费用明细 sheet
    const modelData = modelCosts.map((m) => ({
      "模型": m.model,
      "类别": m.modelCategory,
      "调用次数": m.totalCalls,
      "输入 Token": m.totalInputTokens,
      "输出 Token": m.totalOutputTokens,
      "费用": m.totalCost,
    }));
    const modelWs = XLSX.utils.json_to_sheet(modelData);
    XLSX.utils.book_append_sheet(wb, modelWs, "模型费用明细");

    // 公司费用汇总 sheet
    const companyData = summary.map((s) => ({
      "公司": s.companyName,
      "总费用": s.totalCost,
      "模型数": (s.modelBreakdown || []).length,
    }));
    const companyWs = XLSX.utils.json_to_sheet(companyData);
    XLSX.utils.book_append_sheet(wb, companyWs, "公司费用汇总");

    const today = dayjs().format("YYYY-MM-DD");
    XLSX.writeFile(wb, `今日用量概况_${today}.xlsx`);
  }, [modelCosts, summary]);

  const modelColumns: ColumnsType<ModelCostItem> = [
    {
      title: "模型",
      dataIndex: "model",
      key: "model",
      render: (v: string) => <span className="font-medium text-slate-900">{v}</span>,
    },
    {
      title: "类别",
      dataIndex: "modelCategory",
      key: "modelCategory",
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: "调用次数",
      dataIndex: "totalCalls",
      key: "totalCalls",
      align: "right",
      render: (v: number) => formatNumber(v),
      sorter: (a, b) => a.totalCalls - b.totalCalls,
    },
    {
      title: "输入 Token",
      dataIndex: "totalInputTokens",
      key: "totalInputTokens",
      align: "right",
      render: (v: number) => formatNumber(v),
    },
    {
      title: "输出 Token",
      dataIndex: "totalOutputTokens",
      key: "totalOutputTokens",
      align: "right",
      render: (v: number) => formatNumber(v),
    },
    {
      title: "费用",
      dataIndex: "totalCost",
      key: "totalCost",
      align: "right",
      render: (v: number) => <span className="font-semibold text-slate-900">{formatCurrency(v)}</span>,
      sorter: (a, b) => a.totalCost - b.totalCost,
      defaultSortOrder: "descend",
    },
  ];

  const granularityLabel = granularity === "daily" ? "按日" : granularity === "weekly" ? "按周" : "按月";

  return (
    <Spin spinning={loading}>
      <div className="min-w-0 space-y-5">
        {/* ── 顶部控制栏：聚合方式 + 筛选 ── */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Segmented
              value={granularity}
              onChange={(v) => setGranularity(v as Granularity)}
              options={[
                { label: "按日", value: "daily" },
                { label: "按周", value: "weekly" },
                { label: "按月", value: "monthly" },
              ]}
            />
          </div>

          {/* 按日聚合时显示日期范围选择 */}
          {granularity === "daily" && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">日期</span>
              <Select
                style={{ width: 120 }}
                value={quickRange}
                onChange={(v) => {
                  setQuickRange(v);
                  if (v === "last7") {
                    setDateRange([dayjs().subtract(6, "day"), dayjs()]);
                  } else if (v === "last30") {
                    setDateRange([dayjs().subtract(29, "day"), dayjs()]);
                  } else if (v === "last90") {
                    setDateRange([dayjs().subtract(89, "day"), dayjs()]);
                  }
                }}
                options={[
                  { label: "最近 7 天", value: "last7" },
                  { label: "最近 30 天", value: "last30" },
                  { label: "最近 90 天", value: "last90" },
                  { label: "自定义", value: "custom" },
                ]}
              />
              {quickRange === "custom" && (
                <DatePicker.RangePicker
                  value={dateRange}
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      setDateRange([dates[0], dates[1]]);
                    }
                  }}
                  style={{ width: 240 }}
                />
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">公司</span>
            <Select
              allowClear
              placeholder="全部公司"
              style={{ width: 160 }}
              value={companyId}
              onChange={setCompanyId}
              options={[
                { label: "全部公司", value: undefined },
                ...companies.map((c) => ({ label: c.name, value: c.name })),
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">模型类别</span>
            <Select
              style={{ width: 140 }}
              value={category}
              onChange={setCategory}
              options={MODEL_CATEGORIES.map((c) => ({ label: c, value: c }))}
            />
          </div>
        </div>

        {/* ── 费用趋势图 ── */}
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-base font-semibold text-slate-900">
            客户{granularityLabel}消耗趋势
          </h3>
          {trend.length > 0 ? <CostBarChart data={trend} granularity={granularity} /> : null}
        </section>

        {/* ── 今日用量概况 ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">今日用量概况</h3>
            <Button
              type="primary"
              icon={<Download size={16} />}
              onClick={handleExport}
              disabled={!modelCosts.length && !summary.length}
            >
              导出 Excel
            </Button>
          </div>

          {overview ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={<DollarSign size={20} />}
                label="当日总费用"
                value={formatCurrency(overview.totalCost)}
                trend={overview.costChangeRate}
                sub="较昨日"
              />
              <MetricCard
                icon={<BarChart3 size={20} />}
                label="当日调用次数"
                value={formatNumber(overview.totalCalls)}
              />
              <MetricCard
                icon={<Layers size={20} />}
                label="当日 Token 消耗"
                value={formatNumber(overview.totalTokens)}
              />
              <MetricCard
                icon={<TrendingUp size={20} />}
                label="活跃公司数"
                value={String(new Set(trend.map((t) => t.company)).size)}
                sub={`共 ${companies.length} 家`}
              />
            </div>
          ) : null}
        </section>

        {/* ── 公司费用排名 + 模型费用明细 ── */}
        <section className="grid gap-4 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-900">公司费用排名</h3>
            <div className="space-y-3">
              {summary
                .sort((a, b) => b.totalCost - a.totalCost)
                .map((s, i) => {
                  const maxCost = summary[0]?.totalCost || 1;
                  const pct = (s.totalCost / maxCost) * 100;
                  const color = getCompanyColor(s.companyName);
                  return (
                    <div key={s.companyId}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                            {i + 1}
                          </span>
                          <span className="font-medium text-slate-800">{s.companyName}</span>
                        </span>
                        <span className="font-semibold text-slate-900">{formatCurrency(s.totalCost)}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-900">模型费用明细</h3>
            <Table<ModelCostItem>
              columns={modelColumns}
              dataSource={modelCosts}
              pagination={false}
              rowKey="model"
              size="middle"
              scroll={{ y: 360 }}
            />
          </div>
        </section>
      </div>
    </Spin>
  );
}
