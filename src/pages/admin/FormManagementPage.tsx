import { useState } from "react";
import { Database, RefreshCw } from "lucide-react";

const APP_TYPE = "APP_DC40389CBE164B18AFAF";
const ARCHIVE_FORM_UUID = "FORM_4305FA38D1C64C2EB9D45704C314F490";
const FUNCTION_URL = `/service/openxiangda-api/v1/apps/${APP_TYPE}/functions/billing_proxy/invoke`;

export function FormManagementPage() {
  const [archiveResult, setArchiveResult] = useState<any>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const runArchiveT2 = async () => {
    setArchiveLoading(true);
    setArchiveResult(null);
    try {
      const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ input: { action: "archiveT2Data", params: {} } }),
      });
      const raw = await response.json();
      const result = raw.output ?? raw.data?.output ?? raw.data?.result ?? raw;
      setArchiveResult(result);
    } catch (error: any) {
      setArchiveResult({ success: false, error: error.message });
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Database className="w-6 h-6" />
          表单管理
        </h1>
        <p className="text-gray-600 mt-2">账单数据归档管理</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">账单数据归档</h2>

        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
            <Database className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-blue-900">归档表单信息</h3>
              <p className="text-sm text-blue-700 mt-1">
                <strong>表单名称：</strong>账单数据归档（billing_archive_v2）
              </p>
              <p className="text-sm text-blue-700">
                <strong>表单 UUID：</strong>{ARCHIVE_FORM_UUID}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
            <RefreshCw className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-green-900">T-2 自动归档</h3>
              <p className="text-sm text-green-700 mt-1">
                每天北京时间 06:00 定时自动归档前天（T-2）的完整计费数据。
                选择 T-2 是为了确保阿里云 T+1 出账后数据已完全结算。
              </p>
              <p className="text-xs text-green-600 mt-2">
                也可以手动点击下方按钮立即归档前天数据。
              </p>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={runArchiveT2}
              disabled={archiveLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Database className={`w-4 h-4 ${archiveLoading ? "animate-spin" : ""}`} />
              {archiveLoading ? "归档中..." : "归档 T-2 数据（前天）"}
            </button>

          </div>

          {archiveResult && (
            <div
              className={`p-4 rounded-lg ${
                archiveResult.success
                  ? "bg-green-50 text-green-900"
                  : "bg-red-50 text-red-900"
              }`}
            >
              <h4 className="font-medium mb-2">
                {archiveResult.success ? "归档成功" : "归档失败"}
              </h4>
              {archiveResult.success ? (
                <div className="text-sm space-y-1">
                  <p><strong>归档日期：</strong>{archiveResult.date}</p>
                  <p><strong>记录数：</strong>{archiveResult.recordCount} 条</p>
                  <p><strong>表单实例 ID：</strong>{archiveResult.formInstId}</p>
                  <p><strong>存储方式：</strong>{archiveResult.storageMethod}</p>
                </div>
              ) : (
                <pre className="text-xs overflow-auto max-h-40 bg-white p-3 rounded border">
                  {JSON.stringify(archiveResult, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
