---
description: src/resources/** glob — OpenXiangda React SPA 资源 manifest 规则
glob: src/resources/**/*
alwaysApply: false
---

# OpenXiangda Resource Manifests

You are editing engineering-managed resource manifests under `src/resources/`. Local files use logical codes; platform IDs stay in `.openxiangda/state.json`.

## Commands

```bash
openxiangda resource validate <type> --only <codes> --profile <name>
openxiangda resource plan <type> --only <codes> --profile <name>
openxiangda resource publish <type> --only <codes> --profile <name>
# one target: replace --only <codes> with --code <code>
openxiangda resource typegen --profile <name>
```

## Rules

- Public routes require matching `routes` and `public-access` manifests.
- Guest access to forms, dataViews, functions, and connectors requires explicit policy `grants`.
- Connector secrets and third-party credentials belong in the platform backend, never in manifests or page source.
- App Function manifests may contain only metadata names in top-level `secretRefs`; values use the Secret CLI and runtime `ctx.secrets.get(name)` under `function_v2` / `trusted_node_v2`.
- Formal changes should keep Git as the source of truth: edit manifests, validate, plan, then publish.
- Exact selectors apply before manifest/source analysis and JS_CODE build: touch only selected targets plus transitive/shared/ambient dependencies; omit selectors only for intentional full-workspace work.
- `resource plan` and publish dry-runs are GET/HEAD-only. On `READ_ONLY_AUTH_REQUIRED`, run `openxiangda auth refresh --profile <name>` or log in again before retrying; never refresh inside the plan.
- Source-triggered Function/Automation publishing patches only source fields on the server and preserves online bindings/contracts/metadata/state. Whole-manifest replacement requires `--replace-manifest --reason "..."`.
- Formal promotion freezes the clean publish HEAD separately from the change base, preflights the complete set, and rejects `SOURCE_BASE_DIVERGED` / `RELEASE_SOURCE_BEHIND_MAIN` / `RESOURCE_FIELD_CONFLICT`. After activation, merge/fast-forward and push the frozen SHA, verify `release integration-status`, then run normal `release end`; squash/rebase does not preserve the released source.
