/**
 * Model Router 账单相关类型定义
 */

/** 公司/客户信息 */
export interface Company {
  id: string;
  name: string;
  children?: Company[];
}

/** 费用概览指标 */
export interface CostOverviewMetrics {
  totalCost: number;
  currentPeriodCost: number;
  lastPeriodCost: number;
  costChangeRate: number;
  totalCalls: number;
  totalTokens: number;
}

/** 费用趋势数据点 */
export interface CostTrendPoint {
  date: string;
  company: string;
  cost: number;
}

/** 模型用量 */
export interface ModelCostItem {
  model: string;
  modelCategory: string;
  totalCost: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

/** 公司维度费用汇总 */
export interface CompanyCostSummary {
  companyId: string;
  companyName: string;
  totalCost: number;
  modelBreakdown: ModelCostItem[];
}

/** 调取来源明细记录 */
export interface CallSourceRecord {
  id: string;
  company: string;
  model: string;
  modelCategory: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  date: string;
  apiKeyId?: string;
}

/** 账单看板查询参数 */
export interface BillingDashboardParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  companyId?: string;
  modelCategory?: string;
}

/** 调取来源查询参数 */
export interface CallSourcesParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  companyId?: string;
  model?: string;
  page?: number;
  pageSize?: number;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** App Function 请求动作 */
export type BillingAction =
  | "companies"
  | "clientList"
  | "billingCostTabs"
  | "costOverview"
  | "costTrend"
  | "modelCostList"
  | "companyCostSummary"
  | "callSources";
