import { useCallback, useEffect, useState } from "react";
import { DatePicker, Select, Spin, Table, Tag, Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

import { billingApi } from "@/shared/billing/api-client";
import type { CallSourceRecord, Company, PaginatedResponse } from "@/shared/billing/types";

function formatCurrency(value: number): string {
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value: number): string {
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
  if (value >= 1e4) return `${(value / 1e4).toFixed(1)}万`;
  return value.toLocaleString("zh-CN");
}

export function CallSourcesPage() {
  const [date, setDate] = useState(dayjs());
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [data, setData] = useState<PaginatedResponse<CallSourceRecord> | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState("");

  const dateStr = date.format("YYYY-MM-DD");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await billingApi.getCallSources({
        date: dateStr,
        companyId,
        page,
        pageSize,
      });
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [dateStr, companyId, page, pageSize]);

  useEffect(() => {
    // 从真实 API 获取客户列表
    billingApi.getCompanies().then(setCompanies);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredItems = data?.items.filter(
    r =>
      !searchText ||
      r.model.toLowerCase().includes(searchText.toLowerCase()) ||
      r.company.toLowerCase().includes(searchText.toLowerCase()) ||
      r.apiKeyId?.toLowerCase().includes(searchText.toLowerCase()),
  ) ?? [];

  const columns: ColumnsType<CallSourceRecord> = [
    {
      title: "公司",
      dataIndex: "company",
      key: "company",
      width: 120,
      render: (v: string) => <span className="font-medium text-slate-900">{v}</span>,
      filters: companies.map(c => ({ text: c.name, value: c.name })),
      onFilter: (value, record) => record.company === value,
    },
    {
      title: "模型",
      dataIndex: "model",
      key: "model",
      width: 160,
      render: (v: string) => <span className="font-mono text-sm text-slate-800">{v}</span>,
    },
    {
      title: "类别",
      dataIndex: "modelCategory",
      key: "modelCategory",
      width: 110,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: "调用次数",
      dataIndex: "calls",
      key: "calls",
      width: 110,
      align: "right",
      render: (v: number) => formatNumber(v),
      sorter: (a, b) => a.calls - b.calls,
    },
    {
      title: "输入 Token",
      dataIndex: "inputTokens",
      key: "inputTokens",
      width: 120,
      align: "right",
      render: (v: number) => formatNumber(v),
      sorter: (a, b) => a.inputTokens - b.inputTokens,
    },
    {
      title: "输出 Token",
      dataIndex: "outputTokens",
      key: "outputTokens",
      width: 120,
      align: "right",
      render: (v: number) => formatNumber(v),
      sorter: (a, b) => a.outputTokens - b.outputTokens,
    },
    {
      title: "总 Token",
      dataIndex: "totalTokens",
      key: "totalTokens",
      width: 120,
      align: "right",
      render: (v: number) => <span className="font-medium text-slate-800">{formatNumber(v)}</span>,
      sorter: (a, b) => a.totalTokens - b.totalTokens,
    },
    {
      title: "费用",
      dataIndex: "cost",
      key: "cost",
      width: 120,
      align: "right",
      render: (v: number) => <span className="font-semibold text-slate-900">{formatCurrency(v)}</span>,
      sorter: (a, b) => a.cost - b.cost,
      defaultSortOrder: "descend",
    },
    {
      title: "API Key ID",
      dataIndex: "apiKeyId",
      key: "apiKeyId",
      width: 160,
      render: (v: string) => (
        <span className="font-mono text-xs text-slate-500">{v || "-"}</span>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div className="min-w-0 space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">日期</span>
            <DatePicker
              value={date}
              onChange={v => {
                if (v) {
                  setDate(v);
                  setPage(1);
                }
              }}
              allowClear={false}
              size="middle"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">公司</span>
            <Select
              allowClear
              placeholder="全部公司"
              style={{ width: 160 }}
              value={companyId}
              onChange={v => {
                setCompanyId(v);
                setPage(1);
              }}
              options={[
                { label: "全部公司", value: undefined },
                ...companies.map(c => ({ label: c.name, value: c.id })),
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">搜索</span>
            <Input
              placeholder="模型 / 公司 / API Key"
              prefix={<SearchOutlined className="text-slate-400" />}
              style={{ width: 220 }}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </div>
        </div>

        {/* Summary bar */}
        {data ? (
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <span>
              共 <b className="text-slate-800">{data.total}</b> 条记录
            </span>
            <span>
              总费用{" "}
              <b className="text-slate-800">
                {formatCurrency(
                  data.items.reduce((sum, r) => sum + r.cost, 0),
                )}
              </b>
            </span>
            <span>
              总调用{" "}
              <b className="text-slate-800">
                {formatNumber(data.items.reduce((sum, r) => sum + r.calls, 0))}
              </b>
            </span>
          </div>
        ) : null}

        {/* Table */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <Table<CallSourceRecord>
            columns={columns}
            dataSource={filteredItems}
            pagination={{
              current: page,
              pageSize,
              total: filteredItems.length,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ["10", "20", "50"],
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
              showTotal: total => `共 ${total} 条`,
            }}
            rowKey="id"
            size="middle"
            scroll={{ x: 1200 }}
          />
        </div>
      </div>
    </Spin>
  );
}
