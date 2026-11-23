# Reverse Engineering Timestamp

## Run Record

- Date: 2026-11-23
- Commit: 680f4417ad3b60356396dd59e45a7532516a72ef

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: input-list-panel
fingerprint: d1fcc18fa9588ba43745b3d4e3c46cf5c83e4a41
analyzed:
  paths:
    - packages/web/
    - packages/server/
    - packages/core/
    - infra/
    - scripts/build-web.mjs
    - docs/deploy.md
  components:
    - core
    - server
    - web
    - infra
shallow:
  paths:
    - ./
    - packages/extension/
    - scripts/deploy/
    - scripts/apply-outputs.mjs
    - scripts/build-extension.mjs
    - scripts/load-test.mjs
    - docs/organizer-guide.html
    - docs/participant-guide.html
```
