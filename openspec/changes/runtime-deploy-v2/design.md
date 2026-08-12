# Design: Runtime deploy 包含 function

## OpenXiangda Resource Impact

- Forms: (none)
- Pages: (none)
- Functions: (none)
- Automations: (none)
- Workflows: (none)
- JS_CODE nodes: (none)
- Resources: no
- Runtime: yes
- Contracts/config: no

## Data And Contract Notes

- Keep application specs focused on observable behavior; implementation details stay here or in source code.
- Resource IDs remain profile-local under `.openxiangda/state.json`.

## Publish Plan

- Run `openxiangda sdd verify runtime-deploy-v2 --changed`.
- Run `openxiangda workspace check --changed`.
- Publish with the commands recorded in `release.json`.
