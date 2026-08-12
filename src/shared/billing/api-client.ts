/**
 * Model Router 账单 API 客户端
 *
 * 通过 App Function (billing_proxy) 代理调用阿里云 Model Router 计费管理 API。
 * 当 API 调用失败时使用 mock 数据作为 fallback。
 */

import dayjs from "dayjs";
import type {
  BillingAction,
  BillingDashboardParams,
  CallSourceRecord,
  CallSourcesParams,
  Company,
  CompanyCostSummary,
  CostOverviewMetrics,
  CostTrendPoint,
  ModelCostItem,
  PaginatedResponse,
} from "./types";

/* ------------------------------------------------------------------ */
/*  Mock data generators                                               */
/* ------------------------------------------------------------------ */

const COMPANIES: Company[] = [
  { id: "c1", name: "奕阳教育" },
  { id: "c2", name: "南京仰格" },
  { id: "c3", name: "贵州图辑" },
  { id: "c4", name: "杭州麦达" },
  { id: "c5", name: "生芽教育" },
  { id: "c6", name: "咪咕数媒" },
];

/** 公司配色（与 Model Router 控制台一致） */
export const COMPANY_COLORS: Record<string, string> = {
  奕阳教育: "#3b82f6",
  南京仰格: "#22c55e",
  贵州图辑: "#f97316",
  杭州麦达: "#eab308",
  生芽教育: "#a855f7",
  咪咕数媒: "#14b8a6",
};

/** 动态配色池，用于未在 COMPANY_COLORS 中的公司 */
const COLOR_PALETTE = [
  "#3b82f6", "#22c55e", "#f97316", "#eab308", "#a855f7", "#14b8a6",
  "#ef4444", "#06b6d4", "#84cc16", "#f43f5e", "#8b5cf6", "#10b981",
];
const dynamicColorMap = new Map<string, string>();
let colorIndex = 0;

/** 获取公司对应的颜色（支持动态公司名） */
export function getCompanyColor(name: string): string {
  if (COMPANY_COLORS[name]) return COMPANY_COLORS[name];
  if (dynamicColorMap.has(name)) return dynamicColorMap.get(name)!;
  const color = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
  dynamicColorMap.set(name, color);
  colorIndex++;
  return color;
}

const MODELS: { name: string; category: string }[] = [
  { name: "qwen-max", category: "大语言模型" },
  { name: "qwen-plus", category: "大语言模型" },
  { name: "qwen-turbo", category: "大语言模型" },
  { name: "qwen-vl-max", category: "视觉模型" },
  { name: "qwen-audio-turbo", category: "语音模型" },
  { name: "wanx-v1", category: "图像生成" },
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function mockCostOverview(_params: BillingDashboardParams): CostOverviewMetrics {
  const rand = seededRandom(42);
  const totalCost = 128650.32;
  const lastCost = 115200.0;
  return {
    totalCost,
    currentPeriodCost: totalCost,
    lastPeriodCost: lastCost,
    costChangeRate: (totalCost - lastCost) / lastCost,
    totalCalls: Math.round(rand() * 500000 + 200000),
    totalTokens: Math.round(rand() * 8e9 + 3e9),
  };
}

function mockCostTrend(_params: BillingDashboardParams): CostTrendPoint[] {
  // 生成 30 天的数据，模拟截图中的 07/12 ~ 08/09 区间
  const points: CostTrendPoint[] = [];
  const startDate = dayjs().subtract(30, "day");

  for (let i = 0; i < 30; i++) {
    const date = startDate.add(i, "day");
    const rand = seededRandom(i * 7 + 3);
    // 各公司的基准费用（模拟截图中的量级）
    const baseCosts = [120, 200, 30, 50, 15, 100];
    for (let ci = 0; ci < COMPANIES.length; ci++) {
      // 部分天数为 0（模拟某些天没有调用）
      const hasData = rand() > 0.15;
      if (!hasData) continue;
      points.push({
        date: date.format("MM/DD"),
        company: COMPANIES[ci].name,
        cost: Math.round(baseCosts[ci] * (0.5 + rand() * 1.5) * 10) / 10,
      });
    }
  }
  return points;
}

function mockModelCostList(params: BillingDashboardParams): ModelCostItem[] {
  const rand = seededRandom(dayjs(params.date).date() + 7);
  return MODELS.map(m => {
    const calls = Math.round(rand() * 80000 + 5000);
    const inputTokens = Math.round(calls * (rand() * 800 + 200));
    const outputTokens = Math.round(calls * (rand() * 400 + 100));
    return {
      model: m.name,
      modelCategory: m.category,
      totalCost: Math.round((inputTokens * 0.003 + outputTokens * 0.006) * 100) / 100,
      totalCalls: calls,
      totalInputTokens: inputTokens,
      totalOutputTokens: outputTokens,
    };
  });
}

function mockCompanyCostSummary(params: BillingDashboardParams): CompanyCostSummary[] {
  const rand = seededRandom(dayjs(params.date).date() + 13);
  return COMPANIES.map(c => {
    const models = MODELS.map(m => {
      const calls = Math.round(rand() * 20000 + 1000);
      return {
        model: m.name,
        modelCategory: m.category,
        totalCost: Math.round(calls * (rand() * 0.5 + 0.1) * 100) / 100,
        totalCalls: calls,
        totalInputTokens: Math.round(calls * (rand() * 500 + 100)),
        totalOutputTokens: Math.round(calls * (rand() * 200 + 50)),
      };
    });
    return {
      companyId: c.id,
      companyName: c.name,
      totalCost: models.reduce((s, m) => s + m.totalCost, 0),
      modelBreakdown: models,
    };
  });
}

function mockCallSources(params: CallSourcesParams): PaginatedResponse<CallSourceRecord> {
  const rand = seededRandom(dayjs(params.date).date() + 31);
  const records: CallSourceRecord[] = [];

  for (const company of COMPANIES) {
    for (const model of MODELS) {
      const calls = Math.round(rand() * 15000 + 500);
      const inputTokens = Math.round(calls * (rand() * 600 + 100));
      const outputTokens = Math.round(calls * (rand() * 300 + 50));
      records.push({
        id: `${company.id}-${model.name}`,
        company: company.name,
        model: model.name,
        modelCategory: model.category,
        calls,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost: Math.round((inputTokens * 0.003 + outputTokens * 0.006) * 100) / 100,
        date: params.date,
        apiKeyId: `ak-${company.id.slice(-2)}-${model.name.slice(0, 4)}`,
      });
    }
  }

  const filtered = params.companyId
    ? records.filter(r => r.company === COMPANIES.find(c => c.id === params.companyId)?.name)
    : records;
  const filteredByModel = params.model
    ? filtered.filter(r => r.model === params.model)
    : filtered;

  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const start = (page - 1) * pageSize;
  return {
    items: filteredByModel.slice(start, start + pageSize),
    total: filteredByModel.length,
    page,
    pageSize,
  };
}

/* ------------------------------------------------------------------ */
/*  API response mappers                                                */
/* ------------------------------------------------------------------ */

/** 将 function 返回的 overview 数据转换为 CostOverviewMetrics */
function mapOverviewResponse(raw: any): CostOverviewMetrics {
  if (!raw) return { totalCost: 0, currentPeriodCost: 0, lastPeriodCost: 0, costChangeRate: 0, totalCalls: 0, totalTokens: 0 };
  const totalCost = raw.totalCost ?? 0;
  const totalCalls = raw.totalCalls ?? 0;
  const totalTokens = raw.totalTokens ?? 0;
  // 如果 API 返回 metrics 数组格式（兼容旧逻辑）
  if (Array.isArray(raw.metrics)) {
    const m: Record<string, number> = {};
    for (const item of raw.metrics) {
      if (item?.key) m[item.key] = item.value ?? 0;
    }
    return {
      totalCost,
      currentPeriodCost: totalCost,
      lastPeriodCost: 0,
      costChangeRate: 0,
      totalCalls: totalCalls || m.total_calls || 0,
      totalTokens: totalTokens || m.total_tokens || 0,
    };
  }
  return {
    totalCost,
    currentPeriodCost: totalCost,
    lastPeriodCost: 0,
    costChangeRate: 0,
    totalCalls,
    totalTokens,
  };
}

/** 将 API 返回的模型费用行转换为 ModelCostItem */
function mapModelCostRow(row: any): ModelCostItem {
  let values: Record<string, number> = {};
  if (typeof row.values === "string") {
    try { values = JSON.parse(row.values); } catch { values = {}; }
  } else if (row.values && typeof row.values === "object") {
    values = row.values;
  }
  // 计算费用: input_price_cost + output_price_cost + thinking_output_price_cost + cached_input_price_cost 等
  const cost = values.total_amount ?? values.totalAmount ??
    (values.input_price_cost || 0) + (values.output_price_cost || 0) +
    (values.thinking_output_price_cost || 0) + (values.cached_input_price_cost || 0) +
    (values.cache_creation_input_price_cost || 0) + (values.web_search_cost || 0) +
    (values.code_interpreter_cost || 0);
  return {
    model: row.modelName || row.modelCode || row.model || "未知模型",
    modelCategory: row.modelType || row.modelCategory || "未知类别",
    totalCost: cost,
    totalCalls: values.total_calls ?? values.totalCalls ?? 0,
    totalInputTokens: values.input_tokens ?? values.total_input_tokens ?? 0,
    totalOutputTokens: values.output_tokens ?? values.total_output_tokens ?? 0,
  };
}

/** 将 API 返回的计费明细行转换为 CallSourceRecord */
function mapBreakdownRow(row: any, index: number): CallSourceRecord {
  // values 可能是 JSON 字符串
  let values: Record<string, number> = {};
  if (typeof row.values === "string") {
    try { values = JSON.parse(row.values); } catch { values = {}; }
  } else if (row.values && typeof row.values === "object") {
    values = row.values;
  }
  const inputTokens = values.input_tokens ?? 0;
  const outputTokens = values.output_tokens ?? 0;
  return {
    id: row.id || row.apiKeyId || `row-${index}`,
    company: row.clientName || row.company || "未知",
    model: row.modelName || row.modelCode || row.model || "未知",
    modelCategory: row.modelType || row.modelCategory || "未知",
    calls: values.total_calls ?? row.total_calls ?? 0,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cost: row.payableAmount ?? row.total_amount ?? row.cost ?? 0,
    date: row.summaryTime ? new Date(row.summaryTime * 1000).toISOString().slice(0, 10) : "",
    apiKeyId: row.apiKeyName || row.apiKeyId ? String(row.apiKeyId) : undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * 调用 billing_proxy App Function 获取真实阿里云 Model Router 数据。
 */
async function invokeBilling<T>(action: BillingAction, params: Record<string, unknown>): Promise<T> {
  try {
    // 尝试多种方式获取 SDK
    let sdk: any = null;
    
    // 方式 1: window.openXiangda (legacy runtime)
    if ((window as any).openXiangda) {
      sdk = (window as any).openXiangda;
    }
    // 方式 2: window.__OPENXIANGDA_SDK__ (React SPA runtime)
    else if ((window as any).__OPENXIANGDA_SDK__) {
      sdk = (window as any).__OPENXIANGDA_SDK__;
    }
    // 方式 3: 通过 /service 代理直接调用（React SPA runtime 同域代理）
    else {
      // 使用相对路径通过 Vite 代理调用
      const appType = (window as any).__APP_TYPE__ || 'APP_DC40389CBE164B18AFAF';
      const res = await fetch(`/service/openxiangda-api/v1/apps/${appType}/functions/billing_proxy/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // 携带 HttpOnly Cookie 认证
        body: JSON.stringify({ input: { action, params } }),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      
      // Function invoke API 返回格式:
      // { code: 200, data: { invocationId, result: {success, data}, output: {success, data} } }
      // 实际业务数据在 output.data 或 data.output.data
      const fnOutput = result.output ?? result.data?.output ?? result.data?.result ?? result;
      
      if (fnOutput.success === false) {
        throw new Error(fnOutput.error || 'Function 调用失败');
      }
      
      return (fnOutput.data ?? fnOutput) as T;
    }
    
    // 使用 SDK 调用
    const appType = sdk.appType || 'APP_DC40389CBE164B18AFAF';
    const res = await sdk.request({
      url: `/service/openxiangda-api/v1/apps/${appType}/functions/billing_proxy/invoke`,
      method: 'POST',
      data: { input: { action, params } },
    });
    
    const result = res.data ?? res;
    const fnOutput = result.output ?? result.result ?? result;
    if (fnOutput.success === false) {
      throw new Error(fnOutput.error || 'Function 调用失败');
    }
    
    return (fnOutput.data ?? fnOutput) as T;
  } catch (error) {
    console.error('调用 billing_proxy 失败:', error);
    console.warn('使用 mock 数据作为 fallback');
    return getMockData(action, params);
  }
}

/**
 * Mock 数据 fallback（当 API 不可用时使用）
 */
function getMockData<T>(action: BillingAction, params: Record<string, unknown>): T {
  switch (action) {
    case "clientList":
    case "companies":
      return COMPANIES as unknown as T;
    case "billingCostTabs":
      return [] as unknown as T;
    case "costOverview":
      return mockCostOverview(params as unknown as BillingDashboardParams) as unknown as T;
    case "costTrend":
      return mockCostTrend(params as unknown as BillingDashboardParams) as unknown as T;
    case "modelCostList":
      return mockModelCostList(params as unknown as BillingDashboardParams) as unknown as T;
    case "companyCostSummary":
      return mockCompanyCostSummary(params as unknown as BillingDashboardParams) as unknown as T;
    case "callSources":
      return mockCallSources(params as unknown as CallSourcesParams) as unknown as T;
    default:
      throw new Error(`Unknown billing action: ${action}`);
  }
}

export const billingApi = {
  /** 获取客户（公司）列表 — 从真实 API 获取 */
  getCompanies: () =>
    invokeBilling<any[]>("clientList", {}).then(clients => {
      const list = Array.isArray(clients) ? clients : [];
      return list.map((c: any) => ({ id: String(c.id), name: c.name || `客户${c.id}` }));
    }).then(companies => {
      // 如果 API 返回空列表，使用 fallback
      return companies.length > 0 ? companies : COMPANIES;
    }).catch(() => {
      // fallback 到硬编码列表
      return COMPANIES;
    }),

  getCostOverview: (params: BillingDashboardParams) =>
    invokeBilling<any>("costOverview", params as unknown as Record<string, unknown>).then(mapOverviewResponse),

  getCostTrend: (params: BillingDashboardParams) =>
    invokeBilling<CostTrendPoint[]>("costTrend", params as unknown as Record<string, unknown>),

  getModelCostList: (params: BillingDashboardParams) =>
    invokeBilling<any>("modelCostList", params as unknown as Record<string, unknown>).then(raw => {
      // API 返回 {columns, rows, idField, nameField} 或直接数组
      const rows = raw?.rows || raw || [];
      return (Array.isArray(rows) ? rows : []).map(mapModelCostRow);
    }),

  getCompanyCostSummary: (params: BillingDashboardParams) =>
    invokeBilling<CompanyCostSummary[]>("companyCostSummary", params as unknown as Record<string, unknown>),

  getCallSources: (params: CallSourcesParams) =>
    invokeBilling<any>("callSources", params as unknown as Record<string, unknown>).then(raw => ({
      items: (raw?.items || []).map((r: any, i: number) => mapBreakdownRow(r, i)),
      total: raw?.total || 0,
      page: params.page || 1,
      pageSize: params.pageSize || 20,
    })),
};
