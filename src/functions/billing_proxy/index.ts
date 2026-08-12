/**
 * Billing Proxy Function
 * 
 * 代理调用阿里云 Model Router 计费管理 API
 * 所有敏感凭证通过 secretRefs 安全获取，不在代码中硬编码
 * 
 * API 文档参考：
 * - https://help.aliyun.com/document_detail/3030523.html (ModelRouterBillingCostTabs)
 * - https://help.aliyun.com/document_detail/3030531.html (ModelRouterQueryCostOverviewMetrics)
 */

import crypto from "crypto";

// 阿里云 Model Router API 配置
const MODEL_ROUTER_API_BASE = "https://model-router-console.edu-aliyun.com/api/v1";

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
 * 构建阿里云 API 签名（HMAC-SHA1）
 * 参考阿里云 OpenAPI 签名规范
 */
function generateSignature(
  accessKeySecret: string,
  method: string,
  path: string,
  params: Record<string, string>
): string {
  // 使用 Web Crypto API (Node.js 18+ 全局可用)
  const sortedKeys = Object.keys(params).sort();
  const canonicalizedQueryString = sortedKeys
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");

  const stringToSign = `${method}&${encodeURIComponent(path)}&${encodeURIComponent(canonicalizedQueryString)}`;

  const hmac = crypto.createHmac("sha1", accessKeySecret + "&");
  hmac.update(stringToSign);
  return hmac.digest("base64");
}


/**
 * 调用阿里云 Model Router API
 */
async function callModelRouterAPI(
  ctx: any,
  path: string,
  params: Record<string, unknown> = {},
  method: "GET" | "POST" = "GET"
) {
  const { accessKeyId, accessKeySecret } = await getAliyunCredentials(ctx);
  
  // 构建查询字符串
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.set(key, String(value));
    }
  });
  
  const queryString = queryParams.toString();
  const url = `${MODEL_ROUTER_API_BASE}${path}${queryString ? "?" + queryString : ""}`;
  
  // 构建签名参数
  const signParams: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Timestamp: new Date().toISOString(),
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
  };
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      signParams[key] = String(value);
    }
  });
  
  const signature = generateSignature(accessKeySecret, method, path, signParams);
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `ACS ${accessKeyId}:${signature}`,
  };
  
  console.log(`Calling Model Router API: ${method} ${url}`);
  
  try {
    const response = await fetch(url, {
      method,
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("API response status:", response.status);
    return data;
  } catch (error: any) {
    console.error("调用 Model Router API 失败:", {
      url,
      error: error?.message,
    });
    throw new Error(`API 调用失败: ${error?.message || "未知错误"}`);
  }
}

/**
 * 获取用量监控 Tab 配置
 * API: GET /api/v1/modelRouter/open/billing/cost/tabs
 */
async function getBillingCostTabs(ctx: any) {
  const data = await callModelRouterAPI(ctx, "/modelRouter/open/billing/cost/tabs");
  return data?.data || [];
}

/**
 * 获取费用概览指标
 * API: GET /api/v1/modelRouter/open/billing/cost/overview
 */
async function getCostOverview(ctx: any, params: any) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = params.startTime || now - 86400 * 30; // 默认最近30天
  const endTime = params.endTime || now;
  
  const data = await callModelRouterAPI(ctx, "/modelRouter/open/billing/cost/overview", {
    startTime,
    endTime,
    modelTypes: params.modelTypes,
    clientId: params.clientId,
    apiKeyId: params.apiKeyId,
    memberUserIds: params.memberUserIds,
  });
  return data?.data || [];
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
        const data = await callModelRouterAPI(ctx, "/modelRouter/open/billing/cost/trend", {
          startTime,
          endTime,
          clientId: client.id,
          granularity,
        });
        
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
  const result: Array<{date: string; company: string; cost: number}> = [];
  
  for (const { clientName, points } of clientTrends) {
    for (const point of points) {
      const ts = point.timestamp;
      const dateStr = new Date(ts * 1000).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
      const cost = point.values?.total_amount || 0;
      if (cost > 0) {
        result.push({ date: dateStr, company: clientName, cost });
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
  
  const data = await callModelRouterAPI(ctx, "/modelRouter/open/billing/cost/models", {
    startTime,
    endTime,
    modelTypes: params.modelTypes,
    clientId: params.clientId,
    apiKeyId: params.apiKeyId,
    memberUserIds: params.memberUserIds,
  });
  return data?.data || [];
}

/**
 * 获取客户（公司/部门）列表
 * API: GET /api/v1/modelRouter/open/clients
 */
async function getClientList(ctx: any) {
  const allClients: any[] = [];
  let nextToken: string | undefined;
  
  do {
    const params: Record<string, unknown> = { pageSize: 100 };
    if (nextToken) params.nextToken = nextToken;
    
    const data = await callModelRouterAPI(ctx, "/modelRouter/open/clients", params);
    const list = data?.data?.list || data?.data || [];
    allClients.push(...list);
    nextToken = data?.data?.nextToken;
  } while (nextToken);
  
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
  
  // 获取所有客户
  const clients = await getClientList(ctx);
  
  // 并发获取每个客户的费用概览
  const results = await Promise.all(
    clients.map(async (client: any) => {
      try {
        const overviewData = await callModelRouterAPI(ctx, "/modelRouter/open/billing/cost/overview", {
          startTime,
          endTime,
          clientId: client.id,
        });
        
        // overview 返回 [{key, label, value, unit}] 数组
        const metrics = overviewData?.data || [];
        const metricMap: Record<string, number> = {};
        for (const m of metrics) {
          metricMap[m.key] = m.value ?? 0;
        }
        
        return {
          companyId: String(client.id),
          companyName: client.name || `客户${client.id}`,
          totalCost: metricMap.total_amount || 0,
          totalCalls: metricMap.total_calls || 0,
          totalTokens: (metricMap.total_input_tokens || 0) + (metricMap.total_output_tokens || 0),
          modelBreakdown: [],
        };
      } catch (error) {
        console.error(`获取客户 ${client.name} 费用失败:`, error);
        return {
          companyId: String(client.id),
          companyName: client.name || `客户${client.id}`,
          totalCost: 0,
          totalCalls: 0,
          totalTokens: 0,
          modelBreakdown: [],
        };
      }
    })
  );
  
  return results;
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
    clientId: params.clientId,
    apiKeyId: params.apiKeyId,
    memberUserIds: params.memberUserIds,
    maxResults: params.pageSize || 20,
    nextToken: params.nextToken,
  };
  
  const data = await callModelRouterAPI(ctx, "/modelRouter/open/billing/cost/breakdown", breakdownParams);
  
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
