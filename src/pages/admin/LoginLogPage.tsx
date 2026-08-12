import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  type TableProps,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { RefreshCw, Search, ShieldCheck } from "lucide-react";
import { usePageSdk } from "openxiangda/runtime/react";
import type {
  LoginLogListParams,
  LoginLogRecord,
  LoginLogStats,
  PageOffsetListResult,
} from "openxiangda/runtime";

import { useAdminPageMetaController } from "@/layouts/AdminShell";

type FilterValues = {
  keyword?: string;
  method?: string;
  range?: [Dayjs, Dayjs];
  source?: string;
  sourceAppType?: string;
  status?: "success" | "failure";
};

type QueryState = {
  filters: Omit<LoginLogListParams, "appType" | "limit" | "page">;
  limit: number;
  page: number;
};

const emptyStats: LoginLogStats = {
  total: 0,
  success: 0,
  failure: 0,
  byMethod: [],
};

const statusOptions = [
  { label: "全部状态", value: "" },
  { label: "成功", value: "success" },
  { label: "失败", value: "failure" },
];

const methodOptions = [
  { label: "全部方式", value: "" },
  { label: "账号密码", value: "password" },
  { label: "钉钉免登", value: "dingtalk" },
  { label: "SSO", value: "sso" },
  { label: "手机号验证码", value: "phone_code" },
  { label: "游客访问", value: "guest" },
  { label: "票据免登", value: "ticket" },
  { label: "CLI 授权", value: "cli_authorization" },
  { label: "账号切换", value: "impersonate" },
];

const sourceOptions = [
  { label: "全部来源", value: "" },
  { label: "平台", value: "platform" },
  { label: "应用登录", value: "openxiangda_app" },
  { label: "钉钉", value: "dingtalk" },
  { label: "SSO", value: "sso" },
  { label: "公开游客", value: "public_guest" },
  { label: "开放票据", value: "openapi_frontend" },
  { label: "验证票据", value: "openxiangda_verification" },
  { label: "CLI", value: "openxiangda_cli" },
];

const trimText = (value?: string) => {
  const text = String(value || "").trim();
  return text || undefined;
};

const formatDateTime = (value?: string | Date | null) =>
  value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "-";

const normalizeFilters = (
  values: FilterValues,
): Omit<LoginLogListParams, "appType" | "limit" | "page"> => {
  const [startAt, endAt] = values.range || [];
  return {
    keyword: trimText(values.keyword),
    method: trimText(values.method),
    source: trimText(values.source),
    sourceAppType: trimText(values.sourceAppType),
    status: values.status || undefined,
    startAt: startAt ? startAt.startOf("day").toISOString() : undefined,
    endAt: endAt ? endAt.endOf("day").toISOString() : undefined,
  };
};

const statusTag = (status?: string) =>
  status === "success" ? (
    <Tag color="success">成功</Tag>
  ) : (
    <Tag color="error">失败</Tag>
  );

const dash = (value?: string | number | null) =>
  value === undefined || value === null || value === "" ? "-" : String(value);

export function LoginLogPage() {
  const sdk = usePageSdk();
  const setPageMeta = useAdminPageMetaController();
  const [form] = Form.useForm<FilterValues>();
  const [query, setQuery] = useState<QueryState>({
    filters: {},
    limit: 20,
    page: 1,
  });
  const [items, setItems] = useState<LoginLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<LoginLogStats>(emptyStats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<LoginLogRecord | null>(null);

  useEffect(() => {
    setPageMeta({
      breadcrumbs: ["首页", "应用工作台", "登录日志"],
      title: "登录日志",
    });
    return () => setPageMeta(null);
  }, [setPageMeta]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [listResponse, statsResponse] = await Promise.all([
        sdk.loginLog.list<PageOffsetListResult<LoginLogRecord>>({
          ...query.filters,
          page: query.page,
          limit: query.limit,
        }),
        sdk.loginLog.stats<LoginLogStats>({
          startAt: query.filters.startAt,
          endAt: query.filters.endAt,
        }),
      ]);
      const result = listResponse.result;
      setItems(result?.items || []);
      setTotal(Number(result?.total || 0));
      setStats(statsResponse.result || emptyStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录日志加载失败");
    } finally {
      setLoading(false);
    }
  }, [query, sdk]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const successRate = useMemo(() => {
    if (!stats.total) return "0.0";
    return ((stats.success / stats.total) * 100).toFixed(1);
  }, [stats.success, stats.total]);

  const columns = useMemo<TableProps<LoginLogRecord>["columns"]>(
    () => [
      {
        dataIndex: "createdAt",
        key: "createdAt",
        render: value => formatDateTime(value),
        title: "时间",
        width: 180,
      },
      {
        key: "user",
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{dash(record.name || record.username)}</Typography.Text>
            <Typography.Text type="secondary">{dash(record.jobNumber || record.userId)}</Typography.Text>
          </Space>
        ),
        title: "用户",
        width: 220,
      },
      {
        dataIndex: "status",
        key: "status",
        render: statusTag,
        title: "状态",
        width: 90,
      },
      {
        key: "method",
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>{dash(record.method)}</Typography.Text>
            <Typography.Text type="secondary">{dash(record.source)}</Typography.Text>
          </Space>
        ),
        title: "方式 / 来源",
        width: 160,
      },
      {
        dataIndex: "sourceAppType",
        key: "sourceAppType",
        render: value => dash(value),
        title: "来源应用",
        width: 140,
      },
      {
        key: "client",
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>{dash(record.ipAddress)}</Typography.Text>
            <Typography.Text ellipsis style={{ maxWidth: 280 }} type="secondary">
              {dash(record.userAgent)}
            </Typography.Text>
          </Space>
        ),
        title: "客户端",
        width: 300,
      },
      {
        key: "failure",
        render: (_, record) =>
          record.status === "failure" ? (
            <Space direction="vertical" size={0}>
              <Typography.Text type="danger">{dash(record.failureCode)}</Typography.Text>
              <Typography.Text ellipsis style={{ maxWidth: 300 }} type="secondary">
                {dash(record.failureReason)}
              </Typography.Text>
            </Space>
          ) : (
            "-"
          ),
        title: "失败原因",
        width: 320,
      },
      {
        fixed: "right",
        key: "action",
        render: (_, record) => (
          <Button onClick={() => void openDetail(record.id)} size="small" type="link">
            详情
          </Button>
        ),
        title: "操作",
        width: 90,
      },
    ],
    [],
  );

  const handleSearch = (values: FilterValues) => {
    setQuery(current => ({
      ...current,
      filters: normalizeFilters(values),
      page: 1,
    }));
  };

  const handleReset = () => {
    form.resetFields();
    setQuery(current => ({ ...current, filters: {}, page: 1 }));
  };

  const handleTableChange: NonNullable<TableProps<LoginLogRecord>["onChange"]> =
    pagination => {
      setQuery(current => ({
        ...current,
        limit: pagination.pageSize || current.limit,
        page: pagination.current || 1,
      }));
    };

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const response = await sdk.loginLog.get<LoginLogRecord | null>(id, {
        includeSensitive: true,
      });
      setDetail(response.result || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录日志详情加载失败");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="small">
          <Statistic prefix={<ShieldCheck size={18} />} title="总登录事件" value={stats.total} />
        </Card>
        <Card size="small">
          <Statistic title="成功" value={stats.success} valueStyle={{ color: "#059669" }} />
        </Card>
        <Card size="small">
          <Statistic title="失败" value={stats.failure} valueStyle={{ color: "#dc2626" }} />
        </Card>
        <Card size="small">
          <Statistic suffix="%" title="成功率" value={successRate} valueStyle={{ color: "#2563eb" }} />
        </Card>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Form.Item name="keyword">
            <Input allowClear placeholder="姓名、账号、工号、失败原因" style={{ width: 240 }} />
          </Form.Item>
          <Form.Item name="status">
            <Select allowClear options={statusOptions} placeholder="状态" style={{ width: 130 }} />
          </Form.Item>
          <Form.Item name="method">
            <Select allowClear options={methodOptions} placeholder="登录方式" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="source">
            <Select allowClear options={sourceOptions} placeholder="来源" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="sourceAppType">
            <Input allowClear placeholder="来源应用" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="range">
            <DatePicker.RangePicker style={{ width: 260 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button htmlType="submit" icon={<Search size={15} />} type="primary">
                查询
              </Button>
              <Button onClick={handleReset}>重置</Button>
              <Button icon={<RefreshCw size={15} />} onClick={() => void loadData()}>
                刷新
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </section>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table<LoginLogRecord>
          columns={columns}
          dataSource={items}
          loading={loading}
          onChange={handleTableChange}
          pagination={{
            current: query.page,
            pageSize: query.limit,
            showSizeChanger: true,
            total,
          }}
          rowKey="id"
          scroll={{ x: 1420 }}
          size="small"
        />
      </section>

      <Drawer
        loading={detailLoading}
        onClose={() => setDetailOpen(false)}
        open={detailOpen}
        title="登录日志详情"
        width={620}
      >
        {detail ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions
              bordered
              column={1}
              items={[
                { label: "时间", children: formatDateTime(detail.createdAt) },
                { label: "状态", children: statusTag(detail.status) },
                { label: "用户", children: dash(detail.name || detail.username) },
                { label: "用户 ID", children: dash(detail.userId) },
                { label: "工号", children: dash(detail.jobNumber) },
                { label: "用户类型", children: dash(detail.userType) },
                { label: "方式", children: dash(detail.method) },
                { label: "来源", children: dash(detail.source) },
                { label: "来源应用", children: dash(detail.sourceAppType) },
                { label: "IP", children: dash(detail.ipAddress) },
                { label: "User-Agent", children: dash(detail.userAgent) },
                { label: "失败代码", children: dash(detail.failureCode) },
                { label: "失败原因", children: dash(detail.failureReason) },
                { label: "请求 ID", children: dash(detail.requestId) },
                {
                  label: "指纹 Hash",
                  children: dash(detail.clientFingerprintHash),
                },
              ]}
              size="small"
            />
            <div>
              <Typography.Text strong>元数据</Typography.Text>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                {JSON.stringify(detail.metadata || {}, null, 2)}
              </pre>
            </div>
          </Space>
        ) : (
          <Typography.Text type="secondary">暂无详情</Typography.Text>
        )}
      </Drawer>
    </div>
  );
}
