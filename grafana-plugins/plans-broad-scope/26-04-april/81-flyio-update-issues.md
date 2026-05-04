# Fly.io Deploy Issues — Two Problems, Two Fixes

## Problem 1 — Plugin changes not appearing on Fly.io

`npm run dev` runs a development watcher that compiles to `dist/` in watch mode — but it outputs **unoptimised development bundles** and may not have finished a clean build when `flyctl deploy` ran. The `Dockerfile.fly` copies whatever is currently in `dist/` at deploy time:

```
COPY grafana-plugins/3d-orbit-attitude-plugin/dist ...
```

So if `dist/` contains a stale or dev build, that's what Fly.io gets.

**Fix**: Before every Fly.io deploy, stop `npm run dev`, run a clean production build, then deploy:

```bash
# In the plugin folder:
npm run build

# Then from the repo root:
flyctl deploy
```

You only need to do this when plugin code has changed. The build output goes into `dist/` and is then baked into the Docker image on the next deploy.

---

## Problem 2 — Home dashboard link broken

`fly.toml` has this line:

```
GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH = "/etc/grafana/provisioning/dashboards/scenario-1-conjunction.json"
```

But you renamed the file to `scenario-1.json`. The path no longer matches, so Grafana falls back to its default home screen.

**Fix**: Either rename the file back to `scenario-1-conjunction.json`, or update the path in `fly.toml` to match the new filename:

```toml
GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH = "/etc/grafana/provisioning/dashboards/scenario-1.json"
```

Then redeploy. No plugin rebuild needed for this one — it is a pure config change.

---

## Deploy order for today

1. `npm run build` (in plugin folder)
2. Fix `fly.toml` path
3. `flyctl deploy` from repo root
