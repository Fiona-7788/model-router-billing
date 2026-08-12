#!/usr/bin/env node

const lines = [
  '',
  '错误：React SPA 工作区不要直接调用 lowcode-workspace publish-all。',
  '',
  'React SPA 的发布入口必须显式指定 profile：',
  '  openxiangda workspace publish --change <change> --profile <name> --form <formCode>',
  '  openxiangda resource publish <type> --only <codes> --change <change> --profile <name>',
  '  openxiangda runtime deploy --no-activate --change <change> --profile <name>',
  '',
  '正式激活后还必须 merge/push 冻结 SHA，再执行 release integration-status 与 release end。',
  '',
  'legacy lowcode-workspace publish-all 只用于旧 classic workspace 的兼容流程。',
  '',
];

for (const line of lines) {
  console.error(line);
}
process.exit(1);
