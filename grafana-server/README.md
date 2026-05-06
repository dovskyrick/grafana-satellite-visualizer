# Grafana Server

Pre-configured Docker Compose setup that runs the full local environment: a Grafana instance with the 3D orbit & attitude plugin pre-loaded, and the mockup digital twin server that drives all scenario dashboards.

---

## What Starts When You Run This

```bash
docker compose up -d
```

Two containers start together:

| Container | Port | Description |
|-----------|------|-------------|
| `grafana-dev` | `3000` | Grafana with the plugin and all dashboards pre-loaded |
| `mockup-twin` | `3001` | Mockup digital twin server (see `../mockup-digital-twin/README.md`) |

Inside the Docker network, Grafana reaches the twin at `http://mockup-twin:3001`. On your host machine, both ports are forwarded so you can also hit the twin directly at `http://localhost:3001` for debugging.

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Compose (v2, i.e. `docker compose` not `docker-compose`)
- The plugin must already be built — the `dist/` folder at `grafana-plugins/3d-orbit-attitude-plugin/dist/` must exist. It is committed to the repository, so a fresh clone already has it.

### Start

```bash
cd grafana-server
docker compose up -d
```

Open **http://localhost:3000** — login with `admin` / `admin`.

All six scenario dashboards appear immediately under **Dashboards**. No data entry or manual setup required.

### Stop

```bash
docker compose down
```

### Full Reset (wipe all Grafana state)

```bash
docker compose down -v
docker compose up -d
```

The `-v` flag removes the `grafana-storage` volume, which holds any manual dashboard edits or settings changes made inside the UI. After a full reset, Grafana comes back in a clean provisioned state.

---

## What Is Pre-Provisioned

### Datasources (`provisioning/datasources/testdata.yml`)

| Name | Type | Used For |
|------|------|----------|
| `DigitalTwin` | Infinity datasource | All scenario dashboards — queries the mockup twin server |
| `TestData DB` | Grafana built-in TestData | Free exploration and development testing |

The Infinity datasource is set as the default. Individual dashboard panels store their own API URLs (currently `https://satellite-twin.fly.dev/...` for scenario data), so your local Grafana talks to the **hosted** mock twin on Fly.io for those queries — no manual datasource URL setup is required. The `DIGITAL_TWIN_URL` environment variable in `docker-compose.yml` is reserved for tooling or future provisioning; the provisioned YAML does not substitute it today.

The **local** `mockup-twin` container is still started alongside Grafana so you can develop the twin server against `http://localhost:3001`, or point panels at it yourself if you replace URLs.

> **Note**: The [Infinity datasource](https://grafana.com/grafana/plugins/yesoreyeram-infinity-datasource/) must be installed in Grafana (typically pulled from the Grafana plugin catalogue on first start when the container has internet access). The unsigned plugins allow-list is only for the **3d-orbit-attitude-plugin** (not published to the Grafana catalogue). Infinity is a signed catalogue plugin.

### Dashboards (`provisioning/dashboards/`)

All dashboards are loaded from JSON files at startup and refreshed every 10 seconds if the files change:

| File | Dashboard Name | Scenario |
|------|---------------|----------|
| `scenario-free-exploration.json` | Free Exploration | Default — 3 satellites, 4 ground stations |
| `scenario-1.json` | Collision Risk Analysis | Scenario 1 |
| `scenario2.json` | Confidence Assessment | Scenario 2 |
| `scenario3.json` | Communication Anomaly | Scenario 3 |
| `scenario4.json` | Star Tracker Anomaly | Scenario 4 |
| `scenario5.json` | Ground Station Antenna Anomaly | Scenario 5 |

`allowUiUpdates: true` is set in `dashboard.yml`, which means you can edit dashboards in the UI during development. Changes are not written back to the JSON files automatically — use **Dashboard settings → JSON model** and copy out manually if you want to save a change.

---

## Configuration

Most configuration is done through environment variables in `docker-compose.yml`. The `grafana.ini` file in this directory is present but nearly all its settings are commented out — it exists as a reference for advanced overrides.

Key environment variables set in `docker-compose.yml`:

| Variable | Value | Effect |
|----------|-------|--------|
| `GF_SECURITY_ADMIN_USER` | `admin` | Admin username |
| `GF_SECURITY_ADMIN_PASSWORD` | `admin` | Admin password |
| `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS` | `3d-orbit-attitude-plugin` | Allows the unpublished 3D plugin to load |
| `GF_DEFAULT_APP_MODE` | `development` | Development mode |
| `GF_LOG_LEVEL` | `debug` | Verbose logging |
| `DIGITAL_TWIN_URL` | `http://mockup-twin:3001` | Available to containers; scenario panels currently use Fly.io URLs in JSON |

---

## Development Workflow

### Rebuilding the Plugin

If you modify plugin source code, rebuild the plugin and refresh Grafana — no container restart needed:

```bash
# In the plugin directory
cd grafana-plugins/3d-orbit-attitude-plugin
npm run build

# Then just refresh http://localhost:3000 in your browser
```

The `dist/` folder is volume-mounted directly into the Grafana container, so the rebuilt files are picked up immediately.

### Editing the Mockup Twin

The `mockup-digital-twin/src/` folder is also volume-mounted into the `mockup-twin` container. However, since the twin runs with `ts-node` and does not have a file watcher, you need to restart the container after changes:

```bash
docker compose restart mockup-twin
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Grafana only
docker compose logs -f grafana

# Mockup twin only
docker compose logs -f mockup-twin
```

---

## Troubleshooting

**Dashboards do not appear on first start**
- The Infinity plugin may still be installing. Wait ~30 seconds and refresh.
- Check logs: `docker compose logs grafana | grep -i infinity`

**Plugin not found / visualization panel shows error**
- Ensure `grafana-plugins/3d-orbit-attitude-plugin/dist/` exists and contains `plugin.json`
- Run `npm run build` in the plugin directory if it is missing
- Restart Grafana: `docker compose restart grafana`

**Port 3000 or 3001 already in use**
- Change the left side of the port mapping in `docker-compose.yml`, e.g. `"3002:3000"`, and access Grafana at `http://localhost:3002`

**Scenario panels show "No data"**
- Confirm you have network access to `https://satellite-twin.fly.dev/health` (provisioned dashboards use the hosted twin).
- For the local twin only: `curl http://localhost:3001/health` should return `{"status":"ok"}`.
- In Grafana: **Connections → Data sources → DigitalTwin → Test** (Infinity plugin must have loaded).
