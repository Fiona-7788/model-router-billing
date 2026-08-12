export const starterBrand = {
  fallbackName: "业务应用",
  logoText: "A",
  name: "OpenXiangda",
  subtitle: "React SPA Starter",
};

export const dashboardContent = {
  activities: {
    actionText: "查看全部活动",
    items: [
      {
        key: "release",
        subtitle: "发布了新的业务页面与权限配置",
        time: "10:18",
        title: "应用版本已更新",
        tone: "blue",
      },
      {
        key: "form",
        subtitle: "表单字段与校验规则已同步",
        time: "09:42",
        title: "业务表单已更新",
        tone: "emerald",
      },
      {
        key: "data",
        subtitle: "数据视图完成自动刷新",
        time: "昨天",
        title: "数据看板已刷新",
        tone: "amber",
      },
    ],
    title: "近期活动",
  },
  aiReview: {
    centerLabel: "总数",
    centerValue: "1,248",
    items: [
      { color: "#22c55e", label: "通过", percent: "68.6%", value: 856 },
      { color: "#f59e0b", label: "需人工复核", percent: "25.0%", value: 312 },
      { color: "#ef4444", label: "不通过", percent: "6.4%", value: 80 },
    ],
    title: "智能校验识别（近 7 天）",
  },
  environment: {
    actionText: "查看运行详情",
    rows: [
      { key: "env", label: "当前环境", status: "success", value: "生产环境" },
      { key: "mode", label: "运行模式", value: "React SPA" },
      { key: "version", label: "部署版本", status: "success", value: "v1.0" },
      { key: "service", label: "服务状态", status: "success", value: "运行中" },
    ],
    title: "运行环境",
  },
  metrics: [
    {
      caption: "较昨日",
      delta: "↑ 12.6%",
      icon: "chart",
      key: "page_visits",
      label: "页面访问",
      tone: "blue",
      value: "24,680",
    },
    {
      caption: "较昨日",
      delta: "↑ 9.1%",
      icon: "clipboard",
      key: "pending_tasks",
      label: "待办事项",
      tone: "emerald",
      value: "12",
    },
    {
      caption: "较昨日",
      delta: "↑ 8.3%",
      icon: "file",
      key: "form_submit",
      label: "表单提交",
      tone: "violet",
      value: "1,248",
    },
    {
      caption: "较昨日",
      delta: "↑ 15.4%",
      icon: "refresh",
      key: "sync_jobs",
      label: "数据视图刷新",
      tone: "amber",
      value: "356",
    },
  ],
  todos: {
    actionText: "查看全部（12）",
    items: [
      {
        key: "expense",
        meta: "申请人：李明 ｜ 金额：¥2,450.00",
        time: "10:24",
        title: "费用报销申请",
        tone: "amber",
      },
      {
        key: "purchase",
        meta: "申请人：王芳 ｜ 金额：¥18,600.00",
        time: "09:58",
        title: "采购申请",
        tone: "violet",
      },
      {
        key: "leave",
        meta: "申请人：张三 ｜ 类型：年假 2 天",
        time: "昨天",
        title: "请假申请",
        tone: "blue",
      },
      {
        key: "contract",
        meta: "申请人：陈晨 ｜ 合同金额：¥120,000.00",
        time: "昨天",
        title: "合同审批",
        tone: "violet",
      },
    ],
    title: "待办审批",
  },
  trend: {
    labels: ["05-09", "05-10", "05-11", "05-12", "05-13", "05-14", "05-15"],
    series: [
      {
        color: "#3b82f6",
        data: [2100, 2800, 3100, 4300, 3000, 2200, 2700],
        name: "页面访问数",
      },
      {
        color: "#22c55e",
        data: [1100, 1500, 1600, 2100, 1600, 1200, 1500],
        name: "独立访客数",
      },
    ],
    title: "访问趋势",
  },
};
