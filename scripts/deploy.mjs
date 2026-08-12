#!/usr/bin/env node

const lines = [
  '',
  '错误：模板已停用无范围的 pnpm deploy 聚合发布入口。',
  '',
  '请使用一个显式 change 和精确资源 selector：',
  '  openxiangda resource plan <type> --only <codes> --profile <name>',
  '  openxiangda runtime deploy --no-activate --change <change> --profile <name>',
  '  openxiangda sdd verify <change> --changed --stage prepublish',
  '  openxiangda release begin --change <change> --profile <name>',
  '  openxiangda resource publish function,automation --only function:<code>,automation:<code> --stage-only --change <change> --profile <name>',
  '  openxiangda release app-finalize --staged-resources-json .openxiangda/releases/<change>/staged-resources.json --change <change> --profile <name>',
  '',
  '激活后必须把冻结的发布 SHA merge/fast-forward 并 push 到权威主分支：',
  '  openxiangda release integration-status --profile <name>',
  '  openxiangda release end --profile <name>',
  '',
];

for (const line of lines) console.error(line);
process.exit(1);
