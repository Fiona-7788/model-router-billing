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
 * 
 * 只返回属于以下部门的客户数据：
 * - 默认部门下的所有客户（奕阳教育、南京仰格、贵州图辑、麦达、正元、生芽教育及其子部门）
 * - 咪咕正式下的所有客户（咪咕用户-xxx-模型）
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
 * 允许的一级公司列表（默认部门下 + 咪咕正式）
 * 只有这些公司的数据会出现在汇总、趋势和列表中
 */
const ALLOWED_COMPANIES = new Set([
  "奕阳教育",
  "南京仰格",
  "贵州图辑",
  "麦达",
  "正元",
  "生芽教育",
  "咪咕数媒",
]);

/**
 * modelType → modelCategory 映射
 * 前端类别：大语言模型、视觉模型、语音模型、图像生成
 */
const MODEL_TYPE_TO_CATEGORY: Record<string, string> = {
  Chat: "大语言模型",
  ChatMultimodal: "大语言模型",
  Embedding: "大语言模型",
  ASR: "语音模型",
  TTS: "语音模型",
  ImageGeneration: "图像生成",
  VideoGeneration: "视觉模型",
};

/**
 * 将 modelType 转换为 modelCategory
 */
function getModelCategory(modelType: string): string {
  return MODEL_TYPE_TO_CATEGORY[modelType] || "其他";
}

/**
 * 过滤 breakdown 数据，只保留默认部门和咪咕正式的数据
 * 如果指定了 companyId，则只保留该公司的数据
 * 如果指定了 modelCategory，则只保留该类别的模型数据
 */
function filterByAllowedDepartments(
  rows: any[],
  parentMap: Map<string, { parentId: string; parentName: string }>,
  companyId?: string,
  modelCategory?: string
): any[] {
  return rows.filter(row => {
    const clientId = String(row.clientId || "");
    const clientName = row.clientName || "";
    const { companyId: resolvedCompanyId, companyName } = resolveCompany(clientId, clientName, parentMap);
    
    // 1. 检查是否在允许的公司列表中
    if (!ALLOWED_COMPANIES.has(companyName)) return false;
    
    // 2. 如果指定了 companyId，进一步过滤
    if (companyId && resolvedCompanyId !== companyId && companyName !== companyId) {
      return false;
    }
    
    // 3. 如果指定了 modelCategory，按模型类别过滤
    if (modelCategory && modelCategory !== "全部类别") {
      const rowCategory = getModelCategory(row.modelType || "");
      if (rowCategory !== modelCategory) return false;
    }
    
    return true;
  });
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
  const [overviewData, allRows, parentMap] = await Promise.all([
    callModelRouterAPI(ctx, "/api/v1/modelRouter/open/billing/cost/overview", {
      startTime,
      endTime,
      modelTypes: params.modelTypes,
      clientId: params.clientId,
      apiKeyId: params.apiKeyId,
      memberUserIds: params.memberUserIds,
    }, "ModelRouterQueryCostOverviewMetrics"),
    fetchAllBreakdownRows(ctx, { startTime, endTime, granularity: "daily" }),
    buildClientParentMap(ctx),
  ]);

  // overview 返回 [{key, label, value, unit}]
  const metrics = overviewData?.data || [];
  const metricMap: Record<string, number> = {};
  for (const m of metrics) {
    if (m?.key) metricMap[m.key] = m.value ?? 0;
  }

  // 过滤后汇总费用（只统计默认部门和咪咕正式，如果指定了 companyId/modelCategory 则进一步过滤）
  const filteredRows = filterByAllowedDepartments(allRows, parentMap, params.companyId, params.modelCategory);
  let totalCost = 0;
  for (const row of filteredRows) {
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
 * 改用 breakdown API（包含所有公司的每日数据），不再逐个调用 trend API
 */
async function getCostTrend(ctx: any, params: any) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = params.startTime || now - 86400 * 30;
  const endTime = params.endTime || now;
  
  // 并发获取 breakdown 数据和 parentMap
  const [allRows, parentMap] = await Promise.all([
    fetchAllBreakdownRows(ctx, { startTime, endTime, granularity: "daily" }),
    buildClientParentMap(ctx),
  ]);
  
  // 过滤：只保留允许的公司（如果指定了 companyId/modelCategory 则进一步过滤）
  const filteredRows = filterByAllowedDepartments(allRows, parentMap, params.companyId, params.modelCategory);
  
  // 按公司+日期分组汇总
  const companyDayMap = new Map<string, { date: string; company: string; cost: number }>();
  
  for (const row of filteredRows) {
    const clientId = String(row.clientId || "");
    const clientName = row.clientName || "";
    const { companyName: resolvedCompany } = resolveCompany(clientId, clientName, parentMap);
    
    // 从 summaryTime 或 row.date 获取日期
    const ts = row.summaryTime || row.timestamp;
    const dateStr = ts
      ? new Date(ts * 1000).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })
      : "";
    if (!dateStr) continue;
    
    const key = `${resolvedCompany}|${dateStr}`;
    if (!companyDayMap.has(key)) {
      companyDayMap.set(key, { date: dateStr, company: resolvedCompany, cost: 0 });
    }
    companyDayMap.get(key)!.cost += row.payableAmount || 0;
  }
  
  console.log(`趋势数据: ${filteredRows.length} 条 breakdown → ${companyDayMap.size} 条趋势点`);
  return Array.from(companyDayMap.values());
}

/**
 * 获取模型费用列表（按模型分类）
 * 从 breakdown 数据中获取 modelType，映射到 modelCategory
 */
async function getModelCostList(ctx: any, params: any) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = params.startTime || now - 86400 * 30;
  const endTime = params.endTime || now;
  
  // 并发获取模型列表和 breakdown 数据（用于获取 modelType 映射）
  const [modelData, allRows, parentMap] = await Promise.all([
    callModelRouterAPI(ctx, "/api/v1/modelRouter/open/billing/cost/models", {
      startTime,
      endTime,
      modelTypes: params.modelTypes,
      clientId: params.clientId,
      apiKeyId: params.apiKeyId,
      memberUserIds: params.memberUserIds,
    }, "ModelRouterQueryCostModelList"),
    fetchAllBreakdownRows(ctx, { startTime, endTime, granularity: "daily" }),
    buildClientParentMap(ctx),
  ]);
  
  // 从 breakdown 数据构建 modelName → modelType 映射
  const modelTypeMap = new Map<string, string>();
  for (const row of allRows) {
    const name = row.modelName || row.modelCode;
    if (name && row.modelType && !modelTypeMap.has(name)) {
      modelTypeMap.set(name, row.modelType);
    }
  }
  
  // 处理模型列表数据
  const raw = modelData?.data;
  const rows = raw?.rows || raw || [];
  const items = (Array.isArray(rows) ? rows : []).map((row: any) => {
    let values: Record<string, number> = {};
    if (typeof row.values === "string") {
      try { values = JSON.parse(row.values); } catch { values = {}; }
    } else if (row.values && typeof row.values === "object") {
      values = row.values;
    }
    const modelName = row.modelName || row.modelCode || row.model || "未知模型";
    const modelType = modelTypeMap.get(modelName) || "";
    const modelCategory = getModelCategory(modelType);
    
    const cost = values.total_amount ?? values.totalAmount ??
      (values.input_price_cost || 0) + (values.output_price_cost || 0) +
      (values.thinking_output_price_cost || 0) + (values.cached_input_price_cost || 0);
    
    return {
      model: modelName,
      modelType,
      modelCategory,
      totalCost: cost,
      totalCalls: values.total_calls ?? values.totalCalls ?? 0,
      totalInputTokens: values.input_tokens ?? values.total_input_tokens ?? 0,
      totalOutputTokens: values.output_tokens ?? values.total_output_tokens ?? 0,
    };
  });
  
  // 如果指定了 modelCategory，过滤模型列表
  if (params.modelCategory && params.modelCategory !== "全部类别") {
    return items.filter((item: any) => item.modelCategory === params.modelCategory);
  }
  
  return items;
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
 * 公司映射表：将 Model Router 客户名映射到一级公司
 * 数据来源：Model Router 控制台 (model-router-console.edu-aliyun.com/customers)
 * 
 * 层级结构：
 * - 奕阳教育 → 产教学中心, 赛事部, 业务部, 白名单赛事, 履约与支持, 财务部
 * - 麦达 → 研发部 → 裘天庆, 姜毅楠, 陶珺怡, 赵硕炎, 王洱千, 陈微, 张柳青,
 *          蒋威, 许永豪, 宗明君, 姜俊, 谢良明, 施德智, 编目系统, 智能选书, 傅茜茜等
 * - 生芽教育 → 浙大琴房, 休复学
 * - 南京仰格, 贵州图辑, 正元 → 无子部门
 * - 咪咕正式 → 咪咕用户-xxx-模型（已在 resolveCompany 中通过名称模式匹配处理）
 */
const COMPANY_MAPPING: Record<string, string> = {
  // 奕阳教育（包括自身和子部门）
  "奕阳教育": "奕阳教育",
  "产教学中心": "奕阳教育",
  "赛事部": "奕阳教育",
  "业务部": "奕阳教育",
  "白名单赛事": "奕阳教育",
  "履约与支持": "奕阳教育",
  "财务部": "奕阳教育",
  
  // 南京仰格（包括自身）
  "南京仰格": "南京仰格",
  
  // 贵州图辑（包括自身）
  "贵州图辑": "贵州图辑",
  
  // 麦达（包括自身和研发部下的所有成员和系统）
  "麦达": "麦达",
  "研发部": "麦达",
  "研发部1-1": "麦达",
  "裘天庆": "麦达",
  "姜毅楠": "麦达",
  "陶珺怡": "麦达",
  "赵硕炎": "麦达",
  "王洱千": "麦达",
  "陈微": "麦达",
  "张柳青": "麦达",
  "蒋威": "麦达",
  "许永豪": "麦达",
  "宗明君": "麦达",
  "姜俊": "麦达",
  "谢良明": "麦达",
  "施德智": "麦达",
  "编目系统": "麦达",
  "智能选书": "麦达",
  "傅茜茜": "麦达",
  
  // 生芽教育（包括自身）
  "生芽教育": "生芽教育",
  "浙大琴房": "生芽教育",
  "休复学": "生芽教育",
  
  // 正元
  "正元": "正元",
  
  // 咪咕数媒
  "咪咕数媒": "咪咕数媒",
  "咪咕正式": "咪咕数媒",
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
  const [parentMap, allBdRows] = await Promise.all([
    buildClientParentMap(ctx),
    (async () => {
      const now = Math.floor(Date.now() / 1000);
      return fetchAllBreakdownRows(ctx, {
        startTime: now - 86400 * 30,
        endTime: now,
        granularity: "daily",
      });
    })(),
  ]);
  
  // 只返回允许的公司
  const companySet = new Map<string, { id: string; name: string }>();
  for (const row of allBdRows) {
    const clientId = String(row.clientId);
    const clientName = row.clientName || "";
    const { companyId, companyName } = resolveCompany(clientId, clientName, parentMap);
    if (!ALLOWED_COMPANIES.has(companyName)) continue;
    if (!companySet.has(companyId)) {
      companySet.set(companyId, { id: companyId, name: companyName });
    }
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
  
  // 过滤：只保留默认部门和咪咕正式的数据（如果指定了 companyId/modelCategory 则进一步过滤）
  const filteredRows = filterByAllowedDepartments(allRows, parentMap, params.companyId, params.modelCategory);
  console.log(`breakdown 过滤: ${allRows.length} 条 → ${filteredRows.length} 条`);
  
  // 按公司分组汇总（使用过滤后的数据）
  const companyMap = new Map<string, { companyId: string; companyName: string; totalCost: number; totalCalls: number; totalTokens: number }>();
  
  for (const row of filteredRows) {
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
  
  console.log(`公司汇总: ${filteredRows.length} 条 breakdown → ${companyMap.size} 家公司`);
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
