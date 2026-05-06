# Plan: Promote `dev` → `main` & Release

## What the Git Operation Is Called

This is **not a merge**. It is a **branch reset + force push**, sometimes called "promoting dev to main" or "rebasing main onto dev". The idea is:

```bash
git checkout main
git reset --hard dev
git push --force origin main
```

`main` will now point to the exact same commit as `dev`. Nothing from the old December `main` is adopted — it is simply overwritten. GitHub will show this as a force push. Since this is your solo thesis repo, there are no PRs or team members to notify, so it is safe.

---

## Should You Spend a Day on a Proper Release?

**Yes, but it does not need to be a full day.** A focused 2–3 hour session is enough if you scope it right. Here is why it matters: your thesis evaluators and potential test users will look at the README first. First impressions on GitHub count as much as the software itself.

---

## What Version Is This?

- `v1.0.0` / `v1.0.1` tagged on December `main` — that was the early proof of concept.
- `dev` since then has grown into a **fully deployed, multi-scenario, 3D attitude + orbit visualizer** running live on Fly.io with provisioned Grafana dashboards, a mock digital twin server, and a complete plugin ecosystem.

**Recommended: tag this as `v1.2.0`** (not v2.0 — the API and data model are continuous, no breaking external interface change).  
Use `v2.0.0` only if you do a breaking architectural change in the future.

---

## Checklist for the Release Session

### 1. Git Operations (15 min)
- [ ] `git checkout main && git reset --hard dev`
- [ ] `git push --force origin main`
- [ ] `git tag v1.2.0 && git push origin v1.2.0`
- [ ] Set `main` as the default branch in GitHub repo settings (if not already)

### 2. README Overhaul (1–1.5 hrs)
The current README almost certainly describes the December state. It needs:
- [ ] Project overview with a screenshot or GIF of the 3D visualizer
- [ ] Live demo link (Fly.io URL)
- [ ] Architecture diagram: mock server → Grafana → plugin
- [ ] Quick-start for local development (`docker compose up`)
- [ ] Plugin list and what each panel does
- [ ] Scenario descriptions (Scenario 1 & 2)
- [ ] Thesis context (1–2 sentences — it legitimizes the project)

### 3. GitHub Repository Hygiene (30 min)
- [ ] Add a repo description and topic tags (`grafana`, `satellite`, `cesium`, `digital-twin`, `thesis`)
- [ ] Add the Fly.io live URL to the GitHub repo "About" section
- [ ] Create a GitHub Release for `v1.2.0` with a short changelog
- [ ] Archive or delete any stale branches besides `main` and `dev`

### 4. Changelog (15 min)
A `CHANGELOG.md` at the root covering what changed since `v1.0.1`:
- 3D orbit & attitude visualization (CesiumJS)
- Multi-scenario Grafana dashboards
- Mock digital twin server
- Sun/moon/celestial body rendering
- Fly.io cloud deployment
- Tooltip, pin, label, and sun-exclusion UI improvements

---

## What NOT to Do Right Now

- Do not refactor code — test users need a stable build, not a moving target.
- Do not rename branches mid-test — keep `dev` alive for ongoing fixes.
- Do not bump to `v2.0.0` unless you introduce a new data ingestion API.

---

## Summary

| Task | Time |
|------|------|
| Git reset + tag + force push | 15 min |
| README rewrite | 1–1.5 hrs |
| GitHub hygiene + Release notes | 45 min |
| **Total** | **~2.5 hrs** |

A clean `main`, a proper README, and a `v1.2.0` tag is the right state to hand to thesis test users.
