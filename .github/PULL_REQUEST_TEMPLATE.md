## Why

<!-- What problem does this solve? Link issues with "Closes #123". -->

## What changed

<!-- Bullet points. Mention user-visible behaviour. -->

## How it was verified

- [ ] `npm run build`
- [ ] `npm run test`
- [ ] `npm run test:drag` (if drag and drop changed)
- [ ] Screenshot or recording attached (if UI changed)

## Checklist

- [ ] Filesystem access stays in the main process
- [ ] New IPC channels are added to main, preload, and `FolioApi`
- [ ] No `any`, `@ts-ignore`, or type suppression
- [ ] `CHANGELOG.md` updated under Unreleased
- [ ] No personal paths, secrets, or build output committed
