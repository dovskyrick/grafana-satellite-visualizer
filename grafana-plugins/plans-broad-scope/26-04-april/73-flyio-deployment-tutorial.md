# Fly.io Deployment — Full Tutorial

## Remove the Old 7th Dashboard (Local)

The old dashboard is the file `grafana-server/provisioning/dashboards/satellite-demo.json`. Simply delete it:

```bash
rm grafana-server/provisioning/dashboards/satellite-demo.json
```

Grafana checks the provisioning folder every 10 seconds (`updateIntervalSeconds: 10` in `dashboard.yml`). As soon as the file is gone, the dashboard disappears from the UI on the next poll — no restart needed. If it does not disappear, restart the Grafana container once.

---

## Step-by-Step Deployment Todo

### Phase 1 — Export Your 6 Dashboards

For each of your 6 dashboards in the local Grafana UI:

1. Open the dashboard
2. Click the **gear icon** (Dashboard settings) in the top right
3. Click **JSON Model** in the left sidebar
4. Copy the entire JSON
5. Save as a file in `grafana-server/provisioning/dashboards/`:
   - `scenario-1-conjunction.json`
   - `scenario-2-manoeuvre.json`
   - `scenario-3-comms-anomaly.json`
   - `scenario-4-startracker.json`
   - `scenario-5-[name].json`
   - `scenario-free-exploration.json`

These 6 files replace `satellite-demo.json` which you just deleted.

---

### Phase 2 — Add the Infinity Data Source Provisioning

Your current datasource provisioning only has `TestData DB`. You need to add the Infinity data source pointing to the digital twin. Edit `grafana-server/provisioning/datasources/testdata.yml` (or create a new file `datasources.yml`):

```yaml
apiVersion: 1

datasources:
  - name: TestData DB
    type: testdata
    access: proxy
    orgId: 1
    uid: testdata
    isDefault: false
    version: 1
    editable: true

  - name: DigitalTwin
    type: yesoreyeram-infinity-datasource
    access: proxy
    orgId: 1
    uid: digital-twin
    isDefault: true
    version: 1
    editable: false
    jsonData:
      baseURL: ${DIGITAL_TWIN_URL}
```

The `${DIGITAL_TWIN_URL}` will be substituted at runtime from an environment variable.

---

### Phase 3 — Deploy the Digital Twin as a Separate Fly.io App

The digital twin needs its own Fly.io app. In the `mockup-digital-twin/` folder, create a `fly.toml`:

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

Deploy it:
```bash
cd mockup-digital-twin
fly launch --no-deploy   # only first time, to register the app
fly deploy
```

Once deployed, the digital twin is reachable at `https://satellite-twin.fly.dev` from the public internet, and at `http://satellite-twin.internal:3001` from Grafana over Fly.io's private network (same org, same region).

---

### Phase 4 — Update fly.toml for Grafana

Add `DIGITAL_TWIN_URL` to the `[env]` block in the root `fly.toml`. Use the internal hostname so traffic stays private:

```toml
[env]
  ...existing vars...
  DIGITAL_TWIN_URL = "http://satellite-twin.internal:3001"
  GF_AUTH_ANONYMOUS_ENABLED = "true"
  GF_AUTH_ANONYMOUS_ORG_ROLE = "Viewer"
  GF_USERS_ALLOW_SIGN_UP = "false"
  GF_AUTH_DISABLE_LOGIN_FORM = "false"
  GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH = "/etc/grafana/provisioning/dashboards/scenario-1-conjunction.json"
  GF_SECURITY_ADMIN_PASSWORD = "use-fly-secrets-not-here"
```

Set the admin password as a secret (not in the file):
```bash
fly secrets set GF_SECURITY_ADMIN_PASSWORD=yourpassword
```

---

### Phase 5 — Update Dockerfile.fly

The Dockerfile already copies provisioning correctly. Make sure `envsubst` is available to resolve `${DIGITAL_TWIN_URL}` in the datasource YAML. The official Grafana image supports environment variable substitution in provisioning files natively — no extra tooling needed.

No changes required to `Dockerfile.fly` if it already COPYs the provisioning folder.

---

### Phase 6 — Deploy Grafana

```bash
cd /home/rbbs/Dev/grafana-satellite-visualizer
fly deploy
```

Wait for the build. Visit `https://satellite-visualizer-demo.fly.dev` — all 6 dashboards should be visible immediately without login, in Viewer-only mode.

---

### Phase 7 — Verify

- [ ] All 6 dashboards appear in the sidebar
- [ ] Old satellite-demo dashboard is gone
- [ ] Panels load data from the digital twin (not TestData)
- [ ] 3D Cesium plugin loads correctly
- [ ] Anonymous users cannot edit or save dashboards
- [ ] You can log in at `/login` with admin credentials for maintenance

---

## Keep Machines Warm

Set `min_machines_running = 1` on both apps to avoid the 5–10 second cold-start penalty when colleagues first open the site.
