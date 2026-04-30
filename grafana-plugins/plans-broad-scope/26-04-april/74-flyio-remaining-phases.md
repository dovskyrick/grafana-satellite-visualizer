# Fly.io Deployment — Remaining Phases

## Current State
- ✅ Phase 1: All 6 dashboards exported as provisioned JSON files
- ✅ Phase 2: Infinity datasource provisioned (uid `cfkgq9jefjsw0e`, no host restrictions, working locally)
- ⏳ Phase 3 onwards: everything below

---

## Phase 3 — Fix fly.toml Before Deploying

Two things need correcting in the root `fly.toml`:

**A) Default home dashboard path is pointing to the deleted old file.** Change:
```toml
GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH = "/etc/grafana/provisioning/dashboards/satellite-demo.json"
```
to one of your actual dashboard files, e.g.:
```toml
GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH = "/etc/grafana/provisioning/dashboards/scenario-1-conjunction.json"
```

**B) Move the admin password out of the file into a Fly secret.** Remove `GF_SECURITY_ADMIN_PASSWORD` from `[env]` entirely, then set it as a secret:
```bash
fly secrets set GF_SECURITY_ADMIN_PASSWORD=yourpassword
```

Also set `min_machines_running = 1` so the container doesn't cold-start on first visit:
```toml
min_machines_running = 1
```

---

## Phase 4 — Create the Digital Twin Fly App

In `mockup-digital-twin/`, create a `fly.toml`:

```toml
app = 'satellite-twin'
primary_region = 'lhr'

[build]
  dockerfile = 'Dockerfile'

[http_service]
  internal_port = 3001
  force_https = false
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  memory = '512mb'
  cpu_kind = 'shared'
  cpus = 1
```

Then deploy it:
```bash
cd mockup-digital-twin
fly launch --no-deploy --name satellite-twin --region lhr
fly deploy
```

Verify it responds: `curl https://satellite-twin.fly.dev/api/health` or any known endpoint.

---

## Phase 5 — Update Dockerfile.fly

The current `Dockerfile.fly` uses Grafana `10.0.3` but your local stack runs `grafana:latest`. Update to match to avoid plugin compatibility surprises:

```dockerfile
FROM grafana/grafana:latest
```

Also confirm the plugin `dist` folder is built and up to date before deploying — Grafana on Fly.io uses whatever is in `grafana-plugins/3d-orbit-attitude-plugin/dist` at build time.

---

## Phase 6 — Deploy Grafana to Fly.io

From the repo root:
```bash
fly deploy
```

After deploy, visit `https://satellite-visualizer-demo.fly.dev`. All 6 dashboards should be immediately visible without login (anonymous Viewer access). Panels should load from the digital twin via the private `satellite-twin.internal:3001` address.

---

## Phase 7 — Verify

- [ ] All 6 provisioned dashboards visible in sidebar
- [ ] Time series panels load data (not just Cesium orbits)
- [ ] Admin login works at `/login`
- [ ] Anonymous users see Viewer-only mode (no edit/save buttons)
- [ ] No cold-start delay (min_machines_running = 1 on both apps)
