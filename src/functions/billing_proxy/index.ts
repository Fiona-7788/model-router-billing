/**
 * Billing Proxy Function
 * 
 * 代理调用阿里云 AiContent (Model Router) 计费管理 API
 * 所有敏感凭证通过 secretRefs 安全获取，不在代码中硬编码
 * 
 * API 文档参考：
 * - https://api.aliyun.com/document/AiContent/20240611/
 * - 端点: aicontent.aliyuncs.com  版本: 20240611  签名: ROA v1 (HMAC-SHA1)
 */

import crypto from "crypto";

// 阿里云 AiContent API 配置
const API_HOST = "aicontent.aliyuncs.com";
const API_BASE = `https://${API_HOST}`;
const API_VERSION = "20240611";

/**
 * 从 secrets 获取阿里云凭证
 */
async function getAliyunCredentials(ctx: any) {
  const accessKeyId = await ctx.secrets.get("ALIYUN_ACCESS_KEY_ID");
  const accessKeySecret = await ctx.secrets.get("ALIYUN_ACCESS_KEY_SECRET");
  
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("未配置阿里云凭证，请执行:\n" +
      "  openxiangda secret create ALIYUN_ACCESS_KEY_ID --value-stdin --change <change-id> --profile yida\n" +
      "  openxiangda secret create ALIYUN_ACCESS_KEY_SECRET --value-stdin --change <change-id> --profile yida");
  }
  
  return { accessKeyId, accessKeySecret };
}

/**
 * 阿里云 ROA v1 签名 (HMAC-SHA1)
 * StringToSign = METHOD
Accept
Content-MD5
Content-Type
Date
CanonicalizedHeaders
CanonicalizedResource
 */
function signROA(
  accessKeySecret: string,
  method: string,
  path: string,
  headers: Record<string, string>,
  queryParams: Record<string, string>
): string {
  // CanonicalizedHeaders: x-acs-* 头，小写 key，按字母排序
  const acsHeaders: Record<string, string> = {};
  Object.keys(headers)
    .filter(k => k.toLowerCase().startsWith("x-acs-"))
    .forEach(k => { acsHeaders[k.toLowerCase()] = String(headers[k]).trim(); });
  const canonicalHeaders = Object.keys(acsHeaders)
    .sort()
    .map(k => `${k}:${acsHeaders[k]}`)
    .join("\n");

  // CanonicalizedResource: path + 排序后的 query string
  const sortedQKeys = Object.keys(queryParams).sort();
  const canonicalQS = sortedQKeys.map(k => `${k}=${queryParams[k]}`).join("&");
  const canonicalResource = path + (canonicalQS ? `?${canonicalQS}` : "");

  // StringToSign
  const stringToSign = [
    method,
    headers["Accept"] || "*/*",
    headers["Content-MD5"] || "",
    headers["Content-Type"] || "",
    headers["Date"] || "",
    canonicalHeaders,
    canonicalResource,
  ].join("\n");

  const hmac = crypto.createHmac("sha1", accessKeySecret);
  hmac.update(stringToSign);
  return hmac.digest("base64");
}

/**
 * 调用阿里云 AiContent (Model Router) API
 * 使用 ROA v1 签名，端点 aicontent.aliyuncs.com
 */
async function callModelRouterAPI(
  ctx: any,
  path: string,
  params: Record<string, unknown> = {},
  action: string = "ModelRouterQueryClientList"
) {
  const { accessKeyId, accessKeySecret } = await getAliyunCredentials(ctx);

  // 构建 query params (string values)
  const queryParams: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams[key] = String(value);
    }
  });

  const date = new Date().toUTCString();
  const headers: Record<string, string> = {
    "Accept": "*/*",
    "Content-Type": "application/json",
    "Date": date,
    "x-acs-action": action,
    "x-acs-version": API_VERSION,
    "x-acs-date": date,
    "x-acs-signature-method": "HMAC-SHA1",
    "x-acs-signature-version": "1.0",
    "x-acs-signature-nonce": crypto.randomUUID(),
  };

  const signature = signROA(accessKeySecret, "GET", path, headers, queryParams);
  headers["Authorization"] = `acs ${accessKeyId}:${signature}`;

  const queryString = new URLSearchParams(queryParams).toString();
  const url = `${API_BASE}${path}${queryString ? `?${queryString}` : ""}`;

  console.log(`Calling ${action}: GET ${path}`);

  try {
    const response = await fetch(url, { method: "GET", headers });
    const data = await response.json();
    if (data.success === false) {
      throw new Error(`API 错误: ${data.message || data.errMessage || "未知错误"}`);
    }
    return data;
  } catch (error: any) {
    console.error(`调用 ${action} 失败:`, error?.message);
    throw new Error(`${action} 调用失败: ${error?.message || "未知错误"}`);
  }
}

/**
 * 获取用量监控 Tab 配置
 * API: GET /api/v1/modelRouter/open/billing/cost/tabs
 */
async function getBillingCostTabs(ctx: any) {
  const data = await callModelRouterAPI(ctx, "/api/v1/modelRouter/open/billing/cost/tabs", {}, "ModelRouterQueryBillingCostTabs");
  return data?.data || [];
}

/**
 * 获取费用概览指标
 * 组合 overview API（调用次数/token）和 breakdown API（费用）
 */
async function getCostOverview(ctx: any, params: any) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = params.startTime || now - 86400 * 30;
  const endTime = params.endTime || now;

  // 并发获取 overview 指标和 breakdown 费用数据
  const [overviewData, breakdownData] = await Promise.all([
    callModelRouterAPI(ctx, "/api/v1/modelRouter/open/billing/cost/overview", {
      startTime,
      endTime,
      modelTypes: params.modelTypes,
      clientId: params.clientId,
      apiKeyId: params.apiKeyId,
      memberUserIds: params.memberUserIds,
    }, "ModelRouterQueryCostOverviewMetrics"),
    callModelRouterAPI(ctx, "/api/v1/modelRouter/open/billing/cost/breakdown", {
      startTime,
      endTime,
      granularity: "daily",
      pageSize: 500,
    }, "ModelRouterQueryBillingCostBreakdown"),
  ]);

  // overview 返回 [{key, label, value, unit}]
  const metrics = overviewData?.data || [];
  const metricMap: Record<string, number> = {};
  for (const m of metrics) {
    if (m?.key) metricMap[m.key] = m.value ?? 0;
  }

  // 从 breakdown 汇总费用
  const rows = breakdownData?.data?.rows || [];
  let totalCost = 0;
  for (const row of rows) {
    totalCost += row.payableAmount || 0;
  }

  return {
    metrics,
    totalCost,
    totalCalls: metricMap.total_calls || 0,
    totalTokens: metricMap.total_tokens || 0,
    modelCount: metricMap.model_count || 0,
    avgTokens: metricMap.avg_tokens || 0,
  };
}

/**
 * 获取费用趋势指标
 * API: GET /api/v1/modelRouter/open/billing/cost/trend
 * 支持按客户分组返回（用于前端堆叠柱状图）
 */
async function getCostTrend(ctx: any, params: any) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = params.startTime || now - 86400 * 30;
  const endTime = params.endTime || now;
  const granularity = params.granularity || "daily";
  
  // 获取客户列表，用于按客户分组趋势
  const clients = await getClientList(ctx);
  
  // 并发获取每个客户的趋势数据
  const clientTrends = await Promise.all(
    clients.map(async (client: any) => {
      try {
        const data = await callModelRouterAPI(ctx, "/api/v1/modelRouter/open/billing/cost/trend", {
          startTime,
          endTime,
          clientId: client.id,
          granularity,
        }, "ModelRouterQueryCostTrendMetrics");
        
        const points = data?.data?.points || [];
        return {
          clientName: client.name || `客户${client.id}`,
          points,
        };
      } catch (error) {
        console.error(`获取客户 ${client.name} 趋势失败:`, error);
        return { clientName: client.name, points: [] };
      }
    })
  );
  
  // 转换为前端期望的格式: [{date, company, cost}]
  // 趋势 API 返回 total_calls / total_tokens / avg_tokens，无费用数据
  // 使用 total_calls 作为趋势指标
  const result: Array<{date: string; company: string; cost: number}> = [];
  
  for (const { clientName, points } of clientTrends) {
    for (const point of points) {
      const ts = point.timestamp;
      const dateStr = new Date(ts * 1000).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
      // values 可能是 JSON 字符串或对象
      let vals = point.values;
      if (typeof vals === "string") {
        try { vals = JSON.parse(vals); } catch { vals = {}; }
      }
      const calls = vals?.total_calls || 0;
      if (calls > 0) {
        result.push({ date: dateStr, company: clientName, cost: calls });
      }
    }
  }
  
  return result;
}

/**
 * 获取模型费用列表（按模型分类）
 * 注意：实际 API 可能需要根据具体文档调整
 */
async function getModelCostList(ctx: any, params: any) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = params.startTime || now - 86400 * 30;
  const endTime = params.endTime || now;
  
  const data = await callModelRouterAPI(ctx, "/api/v1/modelRouter/open/billing/cost/models", {
    startTime,
    endTime,
    modelTypes: params.modelTypes,
    clientId: params.clientId,
    apiKeyId: params.apiKeyId,
    memberUserIds: params.memberUserIds,
  }, "ModelRouterQueryCostModelList");
  return data?.data || [];
}

/**
 * 获取客户（公司/部门）列表
 * API: GET /api/v1/modelRouter/open/clients
 * 使用 page-based 分页（pageSize 最大 100）
 */
async function getClientList(ctx: any) {
  const allClients: any[] = [];
  let page = 1;
  const pageSize = 100;

  do {
    const data = await callModelRouterAPI(ctx, "/api/v1/modelRouter/open/clients", { page, pageSize }, "ModelRouterQueryClientList");
    const list = data?.data?.list || [];
    allClients.push(...list);
    const total = data?.data?.total || 0;
    if (allClients.length >= total || list.length < pageSize) break;
    page++;
  } while (page <= 10); // 安全上限

  return allClients;
}

/**
 * 获取部门/公司费用汇总
 * 通过获取客户列表 + 每个客户的费用概览来构建
 */
async function getCompanyCostSummary(ctx: any, params: any) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = params.startTime || now - 86400 * 30;
  const endTime = params.endTime || now;
  
  // 获取 breakdown 数据，按客户汇总费用
  const data = await callModelRouterAPI(ctx, "/api/v1/modelRouter/open/billing/cost/breakdown", {
    startTime,
    endTime,
    granularity: "daily",
    pageSize: 500,
  }, "ModelRouterQueryBillingCostBreakdown");
  
  const rows = data?.data?.rows || [];
  
  // 按客户分组汇总
  const clientMap = new Map<string, { companyId: string; companyName: string; totalCost: number; totalCalls: number; totalTokens: number }>();
  
  for (const row of rows) {
    const clientId = String(row.clientId || "unknown");
    const clientName = row.clientName || `客户${clientId}`;
    
    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, { companyId: clientId, companyName: clientName, totalCost: 0, totalCalls: 0, totalTokens: 0 });
    }
    const entry = clientMap.get(clientId)!;
    entry.totalCost += row.payableAmount || 0;
    
    // values 可能是 JSON 字符串
    let vals = row.values;
    if (typeof vals === "string") {
      try { vals = JSON.parse(vals); } catch { vals = {}; }
    }
    entry.totalCalls += vals?.total_calls || 0;
    entry.totalTokens += (vals?.input_tokens || 0) + (vals?.output_tokens || 0);
  }
  
  return Array.from(clientMap.values());
}

/**
 * 获取调取来源明细（计费明细）
 * API: GET /api/v1/modelRouter/open/billing/cost/breakdown
 */
async function getCallSources(ctx: any, params: any) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = params.startTime || now - 86400 * 30;
  const endTime = params.endTime || now;
  
  const breakdownParams: Record<string, unknown> = {
    startTime,
    endTime,
    granularity: params.granularity || "daily",
    clientId: params.clientId,
    apiKeyId: params.apiKeyId,
    memberUserIds: params.memberUserIds,
    pageSize: params.pageSize || 20,
    page: params.page || 1,
  };
  
  const data = await callModelRouterAPI(ctx, "/api/v1/modelRouter/open/billing/cost/breakdown", breakdownParams, "ModelRouterQueryBillingCostBreakdown");
  
  // breakdown 可能返回分页数据
  const items = data?.data?.list || data?.data?.rows || data?.data || [];
  return {
    items: Array.isArray(items) ? items : [],
    total: data?.data?.total || items.length || 0,
    nextToken: data?.data?.nextToken,
  };
}

/**
 * Function 入口
 */
export default async function(ctx: any) {
  const input = ctx.input || {};
  const action = input.action;
  const params = input.params || {};
  
  if (!action) {
    throw new Error("缺少 action 参数");
  }
  
  try {
    let result;
    
    switch (action) {
      case "billingCostTabs":
        result = await getBillingCostTabs(ctx);
        break;
      case "costOverview":
        result = await getCostOverview(ctx, params);
        break;
      case "costTrend":
        result = await getCostTrend(ctx, params);
        break;
      case "modelCostList":
        result = await getModelCostList(ctx, params);
        break;
      case "companyCostSummary":
        result = await getCompanyCostSummary(ctx, params);
        break;
      case "callSources":
        result = await getCallSources(ctx, params);
        break;
      case "clientList":
        result = await getClientList(ctx);
        break;
      default:
        throw new Error(`未知的 action: ${action}。支持的 actions: billingCostTabs, costOverview, costTrend, modelCostList, companyCostSummary, callSources, clientList`);
    }
    
    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    console.error("Billing proxy error:", error);
    return {
      success: false,
      error: error?.message || "未知错误",
    };
  }
}
