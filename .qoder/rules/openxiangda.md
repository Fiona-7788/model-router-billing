---
description: OpenXiangda React SPA 工作区强约束 — 路由、命令、不变量、禁令
alwaysApply: true
---

# OpenXiangda React SPA Rule

This is an OpenXiangda React SPA workspace. Read [AGENTS.md](AGENTS.md) for full guidance. New apps use `resource publish` plus `runtime deploy`; do not use classic workspace publish flows for frontend deployment.

## Hard route

| 用户说 | 必用命令 |
|---|---|
| 发布资源 / publish resources | `openxiangda resource publish <type> --only <codes> --change <change> --profile <name>` |
| 发布前端预览 / deploy preview | `openxiangda runtime deploy --profile <name> --no-activate --json` |
| 正式 promotion | `release begin --change <change>` → publish/activate → merge/push frozen SHA → `integration-status` → `release end` |
| 完整部署 / deploy | 使用同一 change + 精确 `--only` 的显式命令；无范围 `pnpm deploy` 已停用 |
| 资源计划 / diff | `openxiangda resource plan <type> --only <codes> --profile <name>` |
| 诊断 / 环境 | `openxiangda doctor --profile <name> --json` / `openxiangda env --profile <name>` |
| 外部后端 / 三方系统开放接口 | `openxiangda-open-api` + `openxiangda open-api spec describe ...` |

## Always

- 发布和写平台资源必须显式传 `--profile <name>`。
- 架构类需求先跑 `openxiangda design gates --topic <code> --json` 并等用户确认。
- 每个任务使用独立 worktree/branch 和一个开发 change，但 feature worktree 不发布。批准提交先合并并 push 到远端默认主分支，再创建一个 `sdd bundle <release-change> --changes ...`，从同步且干净的 main/master 一次发布。
- L0 只读/文档/测试无需 SDD；L1 使用 quick；L2/L3 保留批准和结构化范围。默认 streamlined 模式下，未完成的 task/evidence/spec 文案只告警；只有 `strictDocumentation: true` 才阻断。
- 账号/角色/权限/RBAC/组织账号/查询参数授权需求先跑 `openxiangda design gates --topic permissions --json`，选择 `managed-platform-account` / `existing-platform-user-assignment` / `static-role-permission` / `query-param-context` 并输出权限矩阵。
- 角色能新增角色、分配成员、授接口权限、维护权限组或管理组织账号时，角色资源必须声明 `apiPermissionCodes`，例如 `app:role:manage`、`app:page-permission-group:manage`、`app:form-permission-group:manage`、`app:organization:manage`。
- `src/resources/**` 是工程化资源来源，正式多资源变更走 `validate -> plan -> publish`。
- 默认按逻辑资源 code 使用 `--only` 或单资源 `--code`；全类型/全应用发布必须由批准的依赖闭包明确覆盖。
- Function/Automation 源码触发默认走服务端 source-field PATCH，保留线上 bindings/contracts/metadata/trigger/view/enabled/published state；整包 manifest 替换必须加 `--replace-manifest --reason "..."`。
- Promotion 必须持有 `release begin/end` 租约；`release begin` 只接受与权威远端 tip 完全一致的 clean main/master。feature branch 或未 push 主线在任何写入前失败。激活后直接运行 `integration-status` 和 `release end`，不再补做发布后合并。
- React SPA 路由由 `src/app/router.tsx` 管理，前端包通过 `openxiangda runtime deploy` 发布。
- 表单附件预览使用 `AttachmentField` / `ImageField`；普通自定义页面使用 `AttachmentPreviewList` / `ImagePreviewGrid` / `useFilePreview`，不要伪造表单上下文、直接引用内部预览实现或维护扩展名白名单。
- 页面权限、表单权限、公开访问 grants、App Function 后端检查是授权依据；前端只做展示保护。
- 查询参数只能做上下文、筛选或 ticket 输入，不能作为敏感数据授权依据。
- 外部后端使用 `/dingtalk-api/v1.0` 时由后端自己保管 AK/SK 和 token；React SPA 不得接收这些凭证。

## Never

- 不要直接运行 `lowcode-workspace publish-all`、`pnpm publish:all` 或 `pnpm openxiangda:publish`。
- 不要省略 `--profile` 发布。
- 不要在临时发布副本中做仓库没有的 hot patch，也不要直接激活未合并会话构建的 Runtime。
- 不要使用旧 `?publicAccess=guest`、`isRenderNav` 或 workbench 参数模型开发新 React SPA。
- 不要只隐藏按钮、只判断 query 参数、硬编码角色、前端模拟权限、假账号/假 ID、或用 `PermissionBoundary` 代替真实授权。
- 不要给用户挂“管理员”业务角色但不给该角色绑定 `app:role:manage` 等角色设置接口权限。
- 不要绕过 `sdk.organization` / `ctx.organization` 直接写平台账号/部门。
- 不要把 token、AK、SK、第三方密钥写入项目文件。
