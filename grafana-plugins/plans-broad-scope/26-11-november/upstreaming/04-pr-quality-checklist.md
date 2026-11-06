# 04 — PR quality checklist (upstream side)

## Before opening

- Check the refactor ledger in `02-…`: does this PR absorb anything listed? Add new entries.
- Branch from latest upstream `main`, one feature only.
- `npm run lint`, `npm run typecheck`, `npm run test:ci` all green; `npm run build` works.
- New logic lives in small files with unit tests; Resium mocked like the existing test.
- No `console.log`, no `localStorage`, no fork-only options.
- New options default to current behaviour (existing dashboards unchanged).
- Existing 8-column data still works.

## PR content

Title and commits in conventional style (`feat: add body axes`). Description:
what, why, a screenshot or GIF, how to test with the provisioned dashboard, and
open questions. README updated (options and data format). No version bump —
Lucas releases with `npm version`.

## After review

Answer every comment, push fixes as new commits, and log lessons in this folder
so the next PR starts better.
