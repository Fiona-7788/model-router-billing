import { useState } from "react";
import { Database, ExternalLink, RefreshCw, Stethoscope } from "lucide-react";

const APP_TYPE = "APP_DC40389CBE164B18AFAF";
const ARCHIVE_FORM_UUID = "FORM_4305FA38D1C64C2EB9D45704C314F490";
const FUNCTION_URL = `/service/openxiangda-api/v1/apps/${APP_TYPE}/functions/billing_proxy/invoke`;

export function FormManagementPage() {
  const [status, setStatus] = useState<"idle" | "checking" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [diagResult, setDiagResult] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  // 平台原生表单设计器 URL（平台管理台，不是 SPA 路由）
  const platformFormUrl = `https://yida.wisejob.cn/admin/forms/${ARCHIVE_FORM_UUID}`;
  const platformFormListUrl = `https://yida.wisejob.cn/admin/forms`;

  const runTestArchive = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ input: { action: "archiveBillingData", params: { date: new Date().toISOString().split("T")[0] } } }),
      });
      const raw = await response.json();
      const result = raw.output ?? raw.data?.output ?? raw.data?.result ?? raw;
      setTestResult(result);
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
    }
    setTestLoading(false);
  };

  const runDiagnose = async () => {
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ input: { action: "test_platform_api", params: {} } }),
      });
      const raw = await response.json();
      const result = raw.output ?? raw.data?.output ?? raw.data?.result ?? raw;
      setDiagResult(result);
    } catch (error: any) {
      setDiagResult({ success: false, error: error.message });
    }
    setDiagLoading(false);
  };

  const checkFormStatus = async () => {
    setStatus("checking");
    setMessage("正在检查表单状态...");
    
    try {
      // 调用归档函数测试表单是否可用
      const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ input: { action: "archiveBillingData", params: { date: new Date().toISOString().split("T")[0], testOnly: true } } }),
      });
      
      const raw = await response.json();
      const result = raw.output ?? raw.data?.output ?? raw.data?.result ?? raw;
      
      if (result.success) {
        setStatus("success");
        setMessage("✅ 表单数据表已初始化，可以正常使用归档功能！");
      } else {
        setStatus("error");
        setMessage(`❌ 表单数据表未初始化。错误：${result.error || result.message || "未知错误"}`);
      }
    } catch (error: any) {
      setStatus("error");
      setMessage(`❌ 检查失败：${error.message}`);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Database className="w-6 h-6" />
          表单管理
        </h1>
        <p className="text-gray-600 mt-2">管理账单归档表单，初始化数据表</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">账单数据归档表单</h2>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
            <Database className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-blue-900">表单信息</h3>
              <p className="text-sm text-blue-700 mt-1">
                <strong>表单名称：</strong>账单数据归档
              </p>
              <p className="text-sm text-blue-700">
                <strong>表单 UUID：</strong>{ARCHIVE_FORM_UUID}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
            <RefreshCw className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-red-900">重要：初始化表单数据表</h3>
              <p className="text-sm text-red-700 mt-1">
                当前表单是空的，需要通过平台 UI 添加字段并初始化数据表。
                请按照以下步骤操作：
              </p>
              <ol className="list-decimal list-inside text-sm text-red-700 mt-2 space-y-1">
                <li>点击下方按钮打开表单设计器（如果 404，请在平台管理台的「表单管理」中找到「账单归档V2」）</li>
                <li>在表单设计器中添加以下字段：
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li><strong>归档日期</strong>（日期类型 DateField）</li>
                    <li><strong>数据JSON</strong>（多行文本 TextareaField）</li>
                    <li><strong>记录数</strong>（数字类型 NumberField）</li>
                    <li><strong>归档类型</strong>（单行文本 TextField）</li>
                  </ul>
                </li>
                <li>点击「保存」按钮</li>
                <li>返回此页面，点击「检查表单状态」验证</li>
              </ol>
              <p className="text-xs text-red-600 mt-2">
                表单 UUID: {ARCHIVE_FORM_UUID}
              </p>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <a
              href={platformFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              打开表单设计器（添加字段）
            </a>
            
            <a
              href={platformFormListUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              打开平台表单列表
            </a>
            
            <button
              onClick={checkFormStatus}
              disabled={status === "checking"}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${status === "checking" ? "animate-spin" : ""}`} />
              {status === "checking" ? "检查中..." : "检查表单状态"}
            </button>

            <button
              onClick={runDiagnose}
              disabled={diagLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              <Stethoscope className={`w-4 h-4 ${diagLoading ? "animate-spin" : ""}`} />
              {diagLoading ? "诊断中..." : "诊断 ctx API"}
            </button>

            <button
              onClick={async () => {
                setTestLoading(true);
                setTestResult(null);
                try {
                  const response = await fetch(FUNCTION_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ input: { action: "test_create_one", params: {} } }),
                  });
                  const raw = await response.json();
                  const result = raw.output ?? raw.data?.output ?? raw.data?.result ?? raw;
                  setTestResult(result);
                } catch (error: any) {
                  setTestResult({ success: false, error: error.message });
                }
                setTestLoading(false);
              }}
              disabled={testLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              <Database className={`w-4 h-4 ${testLoading ? "animate-spin" : ""}`} />
              {testLoading ? "测试中..." : "测试 createOneData"}
            </button>

            <button
              onClick={runTestArchive}
              disabled={testLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              <Database className={`w-4 h-4 ${testLoading ? "animate-spin" : ""}`} />
              {testLoading ? "测试中..." : "测试归档（今日数据）"}
            </button>
          </div>

          {testResult && (
            <div className="p-4 rounded-lg bg-orange-50 text-orange-900">
              <h4 className="font-medium mb-2">归档测试结果：</h4>
              <pre className="text-xs overflow-auto max-h-60 bg-white p-3 rounded border">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}

          {diagResult && (
            <div className="p-4 rounded-lg bg-purple-50 text-purple-900">
              <h4 className="font-medium mb-2">诊断结果：</h4>
              <pre className="text-xs overflow-auto max-h-60 bg-white p-3 rounded border">
                {JSON.stringify(diagResult, null, 2)}
              </pre>
            </div>
          )}

          {message && (
            <div
              className={`p-4 rounded-lg ${
                status === "success"
                  ? "bg-green-50 text-green-900"
                  : status === "error"
                  ? "bg-red-50 text-red-900"
                  : "bg-gray-50 text-gray-900"
              }`}
            >
              {message}
            </div>
          )}

          <div className="border-t pt-4 mt-4">
            <h3 className="font-medium text-gray-900 mb-2">使用说明</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>点击「打开表单管理页面」按钮，在新标签页打开平台表单管理界面</li>
              <li>平台会自动初始化表单的数据表（首次打开时）</li>
              <li>初始化完成后，返回此页面点击「检查表单状态」验证</li>
              <li>状态显示成功后，即可正常使用账单归档功能</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">快速链接</h2>
        <div className="space-y-2">
          <a
            href={platformFormUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="font-medium text-gray-900">账单数据归档表单</div>
            <div className="text-sm text-gray-600 mt-1">直接打开归档表单管理页面</div>
          </a>
          
          <a
            href={platformFormListUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="font-medium text-gray-900">所有表单列表</div>
            <div className="text-sm text-gray-600 mt-1">查看应用中所有表单</div>
          </a>
        </div>
      </div>
    </div>
  );
}
