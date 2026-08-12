/**
 * Model Router 账单 API 客户端
 *
 * 当前使用模拟数据。接入真实 API 后，所有请求将通过 App Function (billing-proxy) 代理
 * 调用阿里云 Model Router 的计费管理接口。
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
      if (result.success === false) {
        throw new Error(result.error || 'Function 调用失败');
      }
      
      // function 返回格式: { success: true, data: ... }
      return (result.data ?? result.output?.data ?? result) as T;
    }
    
    // 使用 SDK 调用
    const appType = sdk.appType || 'APP_DC40389CBE164B18AFAF';
    const res = await sdk.request({
      url: `/service/openxiangda-api/v1/apps/${appType}/functions/billing_proxy/invoke`,
      method: 'POST',
      data: { input: { action, params } },
    });
    
    const result = res.data ?? res;
    if (result.success === false) {
      throw new Error(result.error || 'Function 调用失败');
    }
    
    return (result.data ?? result) as T;
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
  // 注意：getCompanies 已移除，因为阿里云 Model Router API 不提供公司列表接口
  // 如需公司/部门列表，请从其他数据源获取

  getCostOverview: (params: BillingDashboardParams) =>
    invokeBilling<CostOverviewMetrics>("costOverview", params as unknown as Record<string, unknown>),

  getCostTrend: (params: BillingDashboardParams) =>
    invokeBilling<CostTrendPoint[]>("costTrend", params as unknown as Record<string, unknown>),

  getModelCostList: (params: BillingDashboardParams) =>
    invokeBilling<ModelCostItem[]>("modelCostList", params as unknown as Record<string, unknown>),

  getCompanyCostSummary: (params: BillingDashboardParams) =>
    invokeBilling<CompanyCostSummary[]>("companyCostSummary", params as unknown as Record<string, unknown>),

  getCallSources: (params: CallSourcesParams) =>
    invokeBilling<PaginatedResponse<CallSourceRecord>>("callSources", params as unknown as Record<string, unknown>),
};
