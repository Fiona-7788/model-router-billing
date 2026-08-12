import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN.js";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn.js";
import { RouterProvider } from "react-router-dom";

import { router } from "./app/router";
import "antd-mobile/bundle/style.css";
import "./styles/index.css";

dayjs.locale("zh-cn");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <RouterProvider router={router} />
    </ConfigProvider>
  </React.StrictMode>,
);
