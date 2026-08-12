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
 * 分页获取全部 breakdown 数据
 * API 单次最多返回 500 条，需要分页获取
 */
async function fetchAllBreakdownRows(
  ctx: any,
  params: Record<string, unknown>
): Promise<any[]> {
  const allRows: any[] = [];
  let page = 1;
  const pageSize = 500;

  do {
    const data = await callModelRouterAPI(
      ctx,
      "/api/v1/modelRouter/open/billing/cost/breakdown",
      { ...params, pageSize, page },
      "ModelRouterQueryBillingCostBreakdown"
    );
    const rows = data?.data?.rows || [];
    allRows.push(...rows);
    const total = data?.data?.total || 0;
    if (allRows.length >= total || rows.length < pageSize) break;
    page++;
  } while (page <= 10);

  return allRows;
}

/**
 * 获取费用概览指标
 * 组合 overview API（调用次数/token）和 breakdown API（费用）
 */
async function getCostOverview(ctx: any, params: any) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = params.startTime || now - 86400 * 30;
  const endTime = params.endTime || now;

  // 并发获取 overview 指标和全部 breakdown 费用数据
  const [overviewData, allRows] = await Promise.all([
    callModelRouterAPI(ctx, "/api/v1/modelRouter/open/billing/cost/overview", {
      startTime,
      endTime,
      modelTypes: params.modelTypes,
      clientId: params.clientId,
      apiKeyId: params.apiKeyId,
      memberUserIds: params.memberUserIds,
    }, "ModelRouterQueryCostOverviewMetrics"),
    fetchAllBreakdownRows(ctx, { startTime, endTime, granularity: "daily" }),
  ]);

  // overview 返回 [{key, label, value, unit}]
  const metrics = overviewData?.data || [];
  const metricMap: Record<string, number> = {};
  for (const m of metrics) {
    if (m?.key) metricMap[m.key] = m.value ?? 0;
  }

  // 从全部 breakdown 汇总费用
  let totalCost = 0;
  for (const row of allRows) {
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
 * 按公司（parentId）分组返回（散户归到父级公司）
 */
async function getCostTrend(ctx: any, params: any) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = params.startTime || now - 86400 * 30;
  const endTime = params.endTime || now;
  const granularity = params.granularity || "daily";
  
  // 并发获取客户列表和父级映射
  const [clients, parentMap] = await Promise.all([
    getClientList(ctx),
    buildClientParentMap(ctx),
  ]);
  
  // 分批并发获取趋势数据（每批 20 个，避免过多并发请求）
  const BATCH_SIZE = 20;
  const allTrends: Array<{ clientId: string; companyName: string; points: any[] }> = [];
  
  for (let i = 0; i < clients.length; i += BATCH_SIZE) {
    const batch = clients.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (client: any) => {
        try {
          const data = await callModelRouterAPI(ctx, "/api/v1/modelRouter/open/billing/cost/trend", {
            startTime,
            endTime,
            clientId: client.id,
            granularity,
          }, "ModelRouterQueryCostTrendMetrics");
          
          const points = data?.data?.points || [];
          // 用父级公司名替代散户名
          const parentInfo = parentMap.get(String(client.id));
          const companyName = parentInfo?.parentName || client.name || `客户${client.id}`;
          return { clientId: String(client.id), companyName, points };
        } catch {
          return { clientId: String(client.id), companyName: client.name, points: [] };
        }
      })
    );
    allTrends.push(...batchResults);
  }
  
  // 按公司分组聚合趋势数据
  // 同一公司下的多个散户，同一天的 calls 累加
  // 咪咕用户散户统一归到"咪咕数媒"
  const companyDayMap = new Map<string, { date: string; company: string; cost: number }>();
  
  for (const { clientId, companyName, points } of allTrends) {
    // 确定该公司名
    const parentInfo = parentMap.get(clientId);
    const resolvedCompany = parentInfo?.parentName || 
      (companyName.includes("咪咕用户") ? "咪咕数媒" : companyName);
    
    for (const point of points) {
      const ts = point.timestamp;
      const dateStr = new Date(ts * 1000).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
      let vals = point.values;
      if (typeof vals === "string") {
        try { vals = JSON.parse(vals); } catch { vals = {}; }
      }
      const calls = vals?.total_calls || 0;
      if (calls > 0) {
        const key = `${resolvedCompany}|${dateStr}`;
        if (!companyDayMap.has(key)) {
          companyDayMap.set(key, { date: dateStr, company: resolvedCompany, cost: 0 });
        }
        companyDayMap.get(key)!.cost += calls;
      }
    }
  }
  
  return Array.from(companyDayMap.values());
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
 * 公司映射表：将 Model Router 客户名映射到享搭一级公司
 * 格式：{ ModelRouter 客户名：享搭一级公司名 }
 * 
 * 根据享搭组织架构和 Model Router 客户列表的对应关系建立
 */
const COMPANY_MAPPING: Record<string, string> = {
  // 奕阳教育及其子部门
  "产教学中心": "奕阳教育",
  "赛事部": "奕阳教育",
  "业务部": "奕阳教育",
  "白名单赛事": "奕阳教育",
  "履约与支持": "奕阳教育",
  
  // 咪咕数媒（已在 resolveCompany 中处理）
  // 其他公司如果有子部门，在这里添加映射
};

/**
 * 判断 clientName 是否是散户（咪咕用户等个人级别用户）
 * 散户应该归到父级公司名下，不单独显示
 */
function isIndividualClient(name: string): boolean {
  if (!name) return false;
  return name.includes("咪咕用户");
}

/**
 * 根据 clientId 和 clientName 确定所属公司
 * 优先级：
 * 1. 名称模式匹配（咪咕用户 → 咪咕数媒）
 * 2. 公司映射表（子部门 → 一级公司）
 * 3. parentMap（叶子节点 → 父级公司）
 * 4. 本身就是公司级节点
 */
function resolveCompany(
  clientId: string,
  clientName: string,
  parentMap: Map<string, { parentId: string; parentName: string }>
): { companyId: string; companyName: string } {
  // 1. 名称模式匹配：咪咕用户 → 咪咕数媒（最高优先级）
  if (isIndividualClient(clientName)) {
    return { companyId: "migu", companyName: "咪咕数媒" };
  }
  
  // 2. 公司映射表：子部门 → 一级公司
  if (COMPANY_MAPPING[clientName]) {
    const mappedName = COMPANY_MAPPING[clientName];
    // 使用一级公司名作为 companyId（确保相同公司合并）
    return { companyId: mappedName, companyName: mappedName };
  }
  
  // 3. 查 parentMap（叶子节点归到父级公司）
  const parentInfo = parentMap.get(clientId);
  if (parentInfo) {
    // 如果父级是咪咕数媒，也统一用 "migu" 作为 companyId
    if (parentInfo.parentName === "咪咕数媒") {
      return { companyId: "migu", companyName: "咪咕数媒" };
    }
    return { companyId: parentInfo.parentId, companyName: parentInfo.parentName };
  }
  
  // 4. 本身就是公司级节点（如南京仰格、贵州图辑等）
  return { companyId: clientId, companyName: clientName || `客户${clientId}` };
}

/**
 * 构建 clientId → parentId 映射，并推断父级公司名称
 * API 只返回叶子节点(L3/L4)，父级节点(L1/L2)不在返回列表中
 * 通过子节点名称模式推断父级公司名
 */
async function buildClientParentMap(ctx: any): Promise<Map<string, { parentId: string; parentName: string }>> {
  const clients = await getClientList(ctx);
  const map = new Map<string, { parentId: string; parentName: string }>();

  // 按 parentId 分组，统计子节点名称模式
  const parentChildren = new Map<string, string[]>();
  for (const c of clients) {
    const pid = String(c.parentId);
    if (!parentChildren.has(pid)) parentChildren.set(pid, []);
    parentChildren.get(pid)!.push(c.name || "");
  }

  // 推断父级名称
  for (const [pid, names] of parentChildren) {
    // 如果子节点名称包含 "咪咕用户"，说明是咪咕数媒的散户
    let parentName: string;
    if (names.some(n => n.includes("咪咕用户"))) {
      parentName = "咪咕数媒";
    } else {
      // 使用第一个非散户子节点名称，或回退到 "部门{parentId}"
      const nonMigu = names.find(n => !n.includes("咪咕用户"));
      parentName = nonMigu || `部门${pid}`;
    }

    for (const c of clients) {
      if (String(c.parentId) === pid) {
        map.set(String(c.id), { parentId: pid, parentName });
      }
    }
  }

  return map;
}

/**
 * 获取公司级客户列表（散户归到父级公司）
 */
async function getCompanyList(ctx: any) {
  const parentMap = await buildClientParentMap(ctx);
  
  // 从 parentMap 提取唯一的公司列表
  const companySet = new Map<string, { id: string; name: string }>();
  for (const [, info] of parentMap) {
    if (!companySet.has(info.parentId)) {
      companySet.set(info.parentId, { id: info.parentId, name: info.parentName });
    }
  }
  
  // 同时添加不在 parentMap 中的公司级节点（从 breakdown 数据中获取）
  const now = Math.floor(Date.now() / 1000);
  try {
    const allBdRows = await fetchAllBreakdownRows(ctx, {
      startTime: now - 86400 * 30,
      endTime: now,
      granularity: "daily",
    });
    
    for (const row of allBdRows) {
      const clientId = String(row.clientId);
      const clientName = row.clientName || "";
      // 检查是否已经在 parentMap 中（散户已归到父级公司）
      const parentInfo = parentMap.get(clientId);
      if (parentInfo) continue; // 已在 parentMap 中，跳过
      // 咪咕用户散户归到"咪咕数媒"
      if (clientName.includes("咪咕用户")) {
        if (!companySet.has("migu")) {
          companySet.set("migu", { id: "migu", name: "咪咕数媒" });
        }
        continue;
      }
      // 公司级节点
      if (!companySet.has(clientId)) {
        companySet.set(clientId, { id: clientId, name: clientName || `客户${clientId}` });
      }
    }
  } catch {
    // 如果 breakdown 调用失败，只用 parentMap 中的公司
  }
  
  return Array.from(companySet.values());
}

/**
 * 获取部门/公司费用汇总
 * 通过 breakdown 数据按公司（parentId）分组汇总
 * 散户（如咪咕用户）归到父级公司名下
 */
async function getCompanyCostSummary(ctx: any, params: any) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = params.startTime || now - 86400 * 30;
  const endTime = params.endTime || now;
  
  // 并发获取全部 breakdown 数据和客户-父级映射
  const [allRows, parentMap] = await Promise.all([
    fetchAllBreakdownRows(ctx, { startTime, endTime, granularity: "daily" }),
    buildClientParentMap(ctx),
  ]);
  
  // 按公司分组汇总
  // 散户（咪咕用户-xxx）归到"咪咕数媒"
  // 其他有 parentId 的叶子节点归到父级公司
  // 公司级条目保持独立
  const companyMap = new Map<string, { companyId: string; companyName: string; totalCost: number; totalCalls: number; totalTokens: number }>();
  
  for (const row of allRows) {
    const clientId = String(row.clientId || "unknown");
    const clientName = row.clientName || "";
    const { companyId, companyName } = resolveCompany(clientId, clientName, parentMap);
    
    if (!companyMap.has(companyId)) {
      companyMap.set(companyId, { companyId, companyName, totalCost: 0, totalCalls: 0, totalTokens: 0 });
    }
    const entry = companyMap.get(companyId)!;
    entry.totalCost += row.payableAmount || 0;
    
    // values 可能是 JSON 字符串
    let vals = row.values;
    if (typeof vals === "string") {
      try { vals = JSON.parse(vals); } catch { vals = {}; }
    }
    entry.totalCalls += vals?.total_calls || 0;
    entry.totalTokens += (vals?.input_tokens || 0) + (vals?.output_tokens || 0);
  }
  
  console.log(`公司汇总: ${allRows.length} 条 breakdown → ${companyMap.size} 家公司`);
  return Array.from(companyMap.values());
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
        // 返回公司级列表（散户归到父级公司）
        result = await getCompanyList(ctx);
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
