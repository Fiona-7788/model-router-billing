# AGENTS.md — OpenXiangda React SPA 应用工作区

本工作区是标准 React 18 + Vite + React Router 应用。默认模板只提供应用壳、账号菜单和一个首页，不是开发验证控制台。

## 开发原则

- 架构类需求默认只规划、不实现。新应用、复杂页面、登录注册、公开访问、权限数据范围、流程自动化、连接器/通知等需求，先运行 `openxiangda doctor --json` 和 `openxiangda design gates --topic <code> --json`，输出设计并等用户确认；确认前只允许读取、快照、dry-run、提问和写设计文档，不允许改源码、写平台、发布或发送通知。
- 先按风险分级：只读/文档/测试为 L0；纯文案样式或单一既有资源绑定等可逆窄改为 L1，可用受限的 `openxiangda sdd quick` 记录精确范围；表单结构、业务函数、自动化/流程、权限、登录/公开访问、数据写入和 runtime/config 为 L2；不可逆、生产迁移或应用级扩权为 L3。L2/L3 必须挂完整 SDD，并由 `coverage.json` 把需求与场景映射到精确的文件、表单、页面及工程资源范围。
- 一个开发任务只使用一个显式 change，并从 `openxiangda sdd context --change <change> --changed --json` 开始；结构化 approval、coverage 资源和文件范围是硬约束，任务/证据/规格文案默认只告警，不阻断开发或发布。只有明确配置 `strictDocumentation: true` 才把文案完成度恢复为门禁。
- 多会话开发使用独立 Git worktree/branch，但 feature worktree 不发布。把已批准提交合并并 push 到权威默认主分支后，用 `sdd bundle <release-change> --changes ...` 聚合范围；只从与远端 tip 完全一致的 clean `main`/`master` 一次发布。
- 账号、角色、权限、数据范围、组织账号、RBAC、查询参数授权需求必须先运行 `openxiangda design gates --topic permissions --json`，选择 `managed-platform-account` / `existing-platform-user-assignment` / `static-role-permission` / `query-param-context`，输出权限矩阵后再实现。
- 应用角色如果要创建角色、分配角色成员、给角色授接口权限、维护页面/表单权限组或管理组织账号，必须在角色资源声明 `apiPermissionCodes`，例如 `app:role:manage`、`app:page-permission-group:manage`、`app:form-permission-group:manage`、`app:organization:manage`。
- 默认用户界面保持克制：左侧应用导航、顶部账号信息、首页内容区域。
- 不在默认可见页面展示 SDK、Runtime、Cookie、Proxy、Playwright、AI 验证、调试上下文、构建号等开发语言。
- 使用 React Router 管理路由，路由定义在 `src/app/router.tsx`。
- 使用 Tailwind CSS 表达样式，不依赖平台 theme tokens。
- 菜单和首页文案优先改 `src/app/navigation.ts`、`src/app/starter-content.ts` 与 `src/pages/admin/AdminDashboardPage.tsx`。
- 页面、表单、字段、数据范围、流程动作、文件、连接器权限以后端接口为准；前端只做展示保护和清晰状态页。
- 查询参数只能作为上下文、筛选或 ticket 输入，不能作为敏感数据授权依据；敏感读写必须由 public-access grants、平台角色、页面/表单权限组或 App Function 后端校验保护。
- 应用管理平台账号/部门时，必须走 `sdk.organization` / `ctx.organization`，并要求当前操作者具备 `app:organization:manage`。
- 只给用户分配“管理员”业务角色不等于授权其设置角色；缺少 `app:role:manage` 时角色创建、成员分配和角色接口权限授予会被后端拒绝。
- 本地开发通过 Vite `/service` 代理远端平台，保持 HttpOnly Cookie 同域访问。
- 新公开访问页使用 `/view/:appType/public/*`、`src/resources/routes/`、`src/resources/public-access/` 和 `PublicAccessGate`。不要使用旧 `?publicAccess=guest`。
- 外部后端或三方系统调用享搭时，使用 `openxiangda-open-api` 与 `openxiangda open-api spec describe`；不要把 AK/SK 或开放 API token 放进 React SPA。

## 常用命令

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm typecheck:js-code
pnpm build
pnpm build-js-code
openxiangda resource publish form-setting --only <formCode> --change <change> --profile <name>
openxiangda form export <formCode> --mode package --profile <name> --output ./exports/
openxiangda doctor --profile <name> --json
openxiangda design gates --topic public-access --json
openxiangda sdd context --change <change> --changed --json
openxiangda sdd verify <change> --changed --stage implementation
openxiangda resource plan <type> --only <code1,code2> --profile <name>
openxiangda sdd bundle <release-change> --changes <change-a,change-b>
openxiangda sdd verify <release-change> --changed --stage prepublish --profile <name>
openxiangda release begin --change <release-change> --profile <name>
openxiangda release integration-status --profile <name>
openxiangda release end --profile <name>
openxiangda commands --json
```

模板已停用无范围的 `pnpm deploy` 聚合入口。日常变更必须使用 `resource plan|publish <type> --only <codes>`（单资源可用 `--code <code>`）。Form bundle、Backend Release 和 Runtime 都先暂存；CLI 会按 `--change` 自动聚合 `.openxiangda/releases/<change>/staged-resources.json`，最后只由一次 Root App finalize 原子激活。不要使用 `workspace publish --form`、单独 `runtime activate`、`pnpm publish:all`、`pnpm openxiangda:publish` 或 `lowcode-workspace publish-all`。

`resource plan` 与 publish dry-run 严格只允许 GET/HEAD。遇到 `READ_ONLY_AUTH_REQUIRED` 时，先执行 `openxiangda auth refresh --profile <name>` 或重新登录再重试；不得在 plan 内自动 POST 刷新 token。

完整发布顺序：

```bash
# 先合并所有 approved task commits 到 main/master 并 push
openxiangda sdd bundle <release-change> --changes <change-a,change-b>
# commit/push bundle 后执行 verify，随后按生成的唯一 canonical command set 暂存并原子激活
openxiangda sdd verify <release-change> --changed --stage prepublish --profile <name>
openxiangda release begin --change <release-change> --profile <name>
openxiangda release integration-status --profile <name>
openxiangda release end --profile <name>
```

`pnpm build-js-code` 会检查并打包 `src/js-code-nodes/<code>/index.ts`、`src/automations/<code>/index.ts`、`src/functions/<code>/index.ts`，供 JS_CODE V2、代码自动化和 App Function 资源发布使用。批量目标使用 `pnpm build-js-code --scripts functions:a,functions:b,automations:c`，也兼容重复的 `--script a --script b --source functions`。正式 `resource plan/publish` 由 CLI 内置 scoped builder 一次批量构建选中入口及其传递/shared/ambient 依赖，不再为每个资源启动工作区 `pnpm`。缓存写入 `.openxiangda/build-cache.cli-v4.json`，稳定 `source_lineage_v1` 只按 authored source/dependencies 比较，不因构建器升级制造假冲突；需要强制重建时追加 `--force`。

App Function 第三方凭据只能在 Function manifest 顶层声明 `secretRefs: [{name, required}]`，并使用 `function_v2` + `runtimeContractVersion: "trusted_node_v2"`；源码通过 `await ctx.secrets.get(name)` 获取。值只能经 `openxiangda secret create|rotate --value-stdin --change <id> --profile <name>` 或隐藏 TTY 配置，禁止进入 Git、`.env`、manifest、源码、构建产物、plan、日志和异常。本地测试只使用 `openxiangda function test --secret-from-env logical=ENV` 的隔离子进程注入。

`openxiangda runtime deploy --no-activate` 会构建并上传不可变预览版本；发布前先提交所有可能进入构建的源码/配置。所有 Runtime deploy（包括 `--no-activate`）都会先获取应用发布 lease，并在任何构建和上传前冻结 clean `HEAD` 与当前 active Runtime 父血缘；旧分支返回 `RUNTIME_SOURCE_BASE_DIVERGED`，不能先上传旧 preview 再激活。`openspec/` SDD 证据和生成/状态目录不算源码 dirty。仅审批的回退可使用 `--allow-runtime-rollback --reason "至少 8 个字符"`；`--no-build` 不会跳过守卫。不要手工修改 `dist/index.html`。

Function/Automation 走 Backend Release v2；同一个 child 可以混合 create、source-only update 与显式 manifest replacement，并对整个集合做 CAS。正式多资源发布必须使用 canonical 精确 selector 和 `--stage-only`。`release begin` 只接受与权威远端默认主分支完全一致的 clean HEAD；feature branch 或未 push 的 main 会在任何平台写入前失败。成功激活后主线证据天然成立，不再补做发布后合并。

## 应用结构

- `src/layouts/AdminShell.tsx`：管理后台应用壳、侧边栏、顶部栏、用户菜单。
- `src/pages/admin/AdminDashboardPage.tsx`：默认首页。
- `src/pages/defaults/*`：表单、流程、数据列表、文件预览等默认页。
- `src/runtime/default-page-overrides.tsx`：整页覆盖默认页的入口。
- `src/js-code-nodes/*`、`src/automations/*`、`src/functions/*`：后端执行脚本源码。
- `scripts/build-js-code.mjs`：JS_CODE V2、代码自动化和 App Function 的 TypeScript 构建脚本。

## 权限资源

React SPA 页面需要声明菜单 code、route code 和 path pattern。默认菜单资源在 `src/resources/menus/menus.json`；可以用 `children` 声明树形菜单，`resource validate|plan|publish` 会展开成独立菜单资源：

```json
{
  "code": "admin_dashboard",
  "name": "工作台",
  "routeCode": "admin.dashboard",
  "path": "/view/:appType/admin"
}
```

页面中可以使用：

```tsx
import { PermissionBoundary, useAppMenus, useRuntimeBootstrap } from "openxiangda/runtime/react";
```

`PermissionBoundary` 只能做展示保护，不能替代后端权限。不要硬编码角色、前端模拟权限、只判断 query 参数或用空数组兜底伪装成功。后端返回 401 时跳登录，403 时展示无权限状态。

公开页面需要同时声明 route 和 public access policy：

```json
{
  "code": "public.register",
  "pathPattern": "/view/:appType/public/register",
  "publicAccess": "guest",
  "publicPolicyCode": "public_register"
}
```

```json
{
  "code": "public_register",
  "mode": "guest",
  "routeCode": "public.register",
  "externalRoleCodes": ["external_visitor"],
  "grants": {
    "forms": [],
    "dataViews": [],
    "functions": [],
    "connectors": []
  }
}
```

表单、dataView、function、connector 没有被 policy `grants` 显式列出时，公开 guest 默认无权访问。需要数据访问时，把同一个外部角色码加入对应后端权限组。

资源诊断或小步修复可以使用一等 CLI：`route`、`public-access`、`auth-config`、`function`、`connector`、`notification`、`data-view`、`menu`、`permission`。正式多资源开发仍优先写 `src/resources/**` 后走 `openxiangda resource validate|plan|publish`。直接 CLI 写平台资源时，先加 `--dry-run` 看 path/body；需要保持仓库为来源时加 `--write-manifest`；删除、发送、覆盖类高风险动作必须加 `--force`。

## 默认页与覆盖

- 表单提交：`/view/:appType/admin/forms/:formUuid/new`
- 表单详情：`/view/:appType/admin/forms/:formUuid/:formInstId`
- 流程详情：`/view/:appType/admin/process/:formUuid/:formInstId`
- 数据列表：`/view/:appType/admin/data/:formUuid`
- 文件预览：`/view/:appType/file-preview?ticket=...`

附件预览约定：

- 表单上下文使用 `AttachmentField` / `ImageField`；不要为只读业务数据伪造 `FormProvider`。普通自定义页面从 `openxiangda/runtime/react` 导入 `AttachmentPreviewList` / `ImagePreviewGrid`；自定义卡片、表格和详情操作使用 `useFilePreview({ items })`，并渲染返回的 `host`。
- 自定义编辑页确需在 `FormProvider` 内使用平台字段时，从 `openxiangda/runtime/react` 调用 `usePageFormRuntimeApi()` 并把返回值设置为 `config.api`。非 Hook 场景使用 `createPageFormRuntimeApi(sdk)`。不要手写 `api.request: config => sdk.request(...)`；它会丢失 `responseType: "blob"`，并绕过下载 ticket 的 `servicePrefix` 归一化，导致预览拿不到二进制 Blob，或下载错误打开站点根 `/file/*`。应用也不要自行给 ticket URL 拼 `/service`。
- 上述独立组件和 hook 必须位于 `OpenXiangdaProvider` + `OpenXiangdaPageProvider` 内。它们自动使用当前 PageSdk `appType`，复用平台 capability、ticket metadata 和受控二进制下载。
- 只有需要复制、分享或新窗口打开时，才通过 PageSdk（`usePageSdk()` 返回的 `sdk`）调用 `sdk.createFileAccessTicket(bucketName, objectName, fileName, "preview", { appType })` 获取 `previewPageUrl` 后打开。
- `previewPageUrl` 是给用户打开的页面入口；`previewUrl` / `/service/file/preview-by-ticket/:ticket` 是文件内容流，只供预览页内部 iframe、PDF、图片或视频组件加载。
- 不要自行维护“可预览扩展名”列表，也不要直接引用内部 `FilePreviewContent` / `useFilePreviewController`。公开组件会调用平台 capability API，只在服务端确认 `canPreview: true` 时展示预览；图片使用同组弹窗画廊，视频、音频和文档使用站内弹窗。
- 默认支持 PDF、常见图片/视频/音频、文本、DOCX 和 XLSX；DOC/XLS/PPT、ODF 等格式需要部署侧配置 ONLYOFFICE。文件过大时平台会按 `FILE_PREVIEW_*_MAX_*` 上限降级为仅下载。
- 全局兼容入口 `/view/file-preview?ticket=...` 只有在后端能从 URL、ticket payload 或 `FILE_PREVIEW_APP_TYPE` 推导 appType 时才会被 React SPA runtime 接管。若响应头仍是 `X-OpenXiangda-Runtime-Mode: legacy`，检查 ticket 是否含 appType、URL 是否带 `appType`、runtime release 是否已激活、以及服务端兜底配置。
- 需要自定义文件预览 UI 时，在 `src/runtime/default-page-overrides.tsx` 覆盖 `file-preview`；自定义组件仍应读取 ticket metadata 和 `/service/file/*` 接口，不要直接拼旧 view/workbench 参数。

需要自定义默认页时，在 `src/runtime/default-page-overrides.tsx` 中按页面类型和 `formUuid` 注册覆盖组件。不要回到旧平台 `isRenderNav` 或 workbench 参数模型。
