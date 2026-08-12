# Billing Proxy Function

代理调用阿里云 Model Router 计费管理 API。

## 配置步骤

### 1. 创建阿里云 AccessKey

1. 登录阿里云控制台
2. 进入 [AccessKey 管理页面](https://ram.console.aliyun.com/manage/ak)
3. 创建 AccessKey（或使用已有的）
4. 记录 `AccessKey ID` 和 `AccessKey Secret`

### 2. 在享搭中创建 Secrets

```bash
# 创建 change
openxiangda sdd propose configure-secrets --title "配置阿里云凭证" --resources
openxiangda sdd approve configure-secrets --summary "配置阿里云 AK/SK"

# 开始 release
openxiangda release begin --change configure-secrets --profile yida

# 创建 secrets（会提示输入值，输入时不会显示）
openxiangda secret create ALIYUN_ACCESS_KEY_ID --value-stdin --change configure-secrets --profile yida
# 粘贴 AccessKey ID，然后按 Ctrl+D

openxiangda secret create ALIYUN_ACCESS_KEY_SECRET --value-stdin --change configure-secrets --profile yida
# 粘贴 AccessKey Secret，然后按 Ctrl+D

# 完成 release
openxiangda release end --profile yida
```

### 3. 发布 Function

```bash
# 构建 JS code
pnpm build-js-code --scripts functions:billing-proxy

# 发布 function
openxiangda resource publish function --only billing-proxy --change configure-secrets --profile yida
```

### 4. 更新 API Endpoint

根据阿里云 Model Router 的实际 API 文档，更新 `src/functions/billing-proxy/index.ts` 中的：

- `MODEL_ROUTER_API_BASE`: API 基础 URL
- `buildAuthHeaders()`: 认证头构建逻辑（如果需要特殊的签名算法）
- 各个 API 调用函数的 path 和参数

## API 端点参考

根据阿里云 Model Router 控制台，可能的 API 端点包括：

- `/api/v1/companies` - 获取公司列表
- `/api/v1/billing/overview` - 费用概览
- `/api/v1/billing/trend` - 费用趋势
- `/api/v1/billing/models` - 模型费用
- `/api/v1/billing/call-sources` - 调取来源

**注意**: 以上端点是推测的，需要根据实际 API 文档确认。

## 安全说明

- ✅ AccessKey 通过 `secretRefs` 安全存储，不在代码中硬编码
- ✅ 只在服务端执行，前端无法直接访问凭证
- ✅ 所有 API 调用都是只读的（GET 请求）
- ❌ 不要在前端代码中直接使用 AccessKey
- ❌ 不要将 `.env` 文件或包含密钥的文件提交到 Git

## 调试

查看 Function 日志：

```bash
openxiangda function test billing-proxy --input '{"action":"companies","params":{}}' --profile yida
```

## 故障排除

### "未配置阿里云凭证"

确保已通过 `openxiangda secret create` 创建了 secrets，并且 function manifest 中声明了 `secretRefs`。

### "API 调用失败"

1. 检查 AccessKey 是否正确
2. 检查 API endpoint 是否正确
3. 查看 Function 日志获取详细错误信息
4. 确认网络连接正常

### 返回空数据

可能是 API endpoint 或参数格式不正确。检查阿里云 Model Router 的实际 API 文档。
