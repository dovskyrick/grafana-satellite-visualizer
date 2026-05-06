# README Update Plan — v1.2.0 Release

## Which READMEs Need Work

| File | Priority | Work Required |
|------|----------|---------------|
| `README.md` (root) | **High** | Major content additions — missing entire new system |
| `grafana-server/README.md` | **High** | Full rewrite — currently wrong content from early dev |
| `mockup-digital-twin/README.md` | **High** | Does not exist — must be created |
| `grafana-plugins/3d-orbit-attitude-plugin/README.md` | **Medium** | Feature additions for celestial map, exclusion zones, new UI |
| `satellite-data-generator/README.md` | **Low** | Probably fine as-is — generator hasn't changed much |
| `grafana-server/provisioning/README.md` | **Skip** | Internal dev note, not user-facing |
| `grafana-plugins/3d-orbit-attitude-plugin/src/README.md` | **Skip** | Internal scaffolding file |
| `grafana-plugins/3d-orbit-attitude-plugin/.config/README.md` | **Skip** | Auto-generated scaffolding |

---

## 1. Root `README.md` — What to Add

The root README is actually already good-looking and well-structured but it was frozen in December. The entire second half of the system is invisible in it. These sections need to be added or rewritten:

**New section: Mock Digital Twin Server**
Introduce `mockup-digital-twin/` as a core component — a Node.js/TypeScript simulation server that drives all scenario dashboards. It generates satellite trajectories, uncertainty ellipsoids, TCA markers, risk curves, confidence tables, link health telemetry, attitude anomaly time series, and star tracker exclusion data. It is deployed to Fly.io alongside Grafana. Point to the new `mockup-digital-twin/README.md`.

**New section: Scenarios**
The system ships with five operational scenarios, each a provisioned Grafana dashboard testing a different operator task:
- **Scenario 1** — Conjunction risk analysis with pre-assigned confidence levels
- **Scenario 2** — User-assigned confidence and collision dismissal
- **Scenario 3** — Communication anomaly diagnosis via attitude/antenna pointing
- **Scenario 4** — Star tracker attitude degradation and solar exclusion diagnosis
- **Scenario 5** — Ground station pass directional interpretation (polar plot)

Each scenario is a self-contained dashboard. No data entry needed by the test user.

**Update: Repository Structure tree**
The current tree is missing `mockup-digital-twin/`. Add it with a short description of its contents.

**Update: Technology Stack**
Add `Infinity Datasource` (Grafana plugin used to query the mock server from dashboards) and `Fly.io` (deployment platform).

**Update: Version and date**
Change `Current Version: 1.0.0` and `Last Updated: December 18, 2025` to `v1.2.0` and today's date.

---

## 2. `grafana-server/README.md` — Full Rewrite

The current content is from early development: Windows PowerShell commands, `test-plugin` references, and `C:\Dev\r3f-test\` paths. None of that is valid anymore. The rewrite should cover:
- What the server folder contains (Docker Compose + provisioned dashboards)
- How to start it locally (`docker compose up -d`)
- That scenario dashboards auto-load on first start
- That the Infinity datasource is pre-configured and points to `http://mockup-digital-twin:3001` in Docker or the Fly.io URL in production
- How to reset state (`docker compose down -v`)

---

## 3. `mockup-digital-twin/README.md` — New File

This README does not exist. It should cover:
- What this server is: a stateless (mostly) TypeScript/Express simulation of a spacecraft digital twin
- What it serves: satellite positions, uncertainty ellipsoids, TCA data, risk curves, confidence metadata, link quality telemetry, attitude anomaly series, star tracker FOV time series
- Key endpoints summary (brief table)
- How to run locally (`npm run dev` or `docker compose up` from the root)
- How session isolation works for Scenario 2 (lazy initialization per session hash)
- The Fly.io deployment: what image is built, how it is deployed

---

## 4. `grafana-plugins/3d-orbit-attitude-plugin/README.md` — Additions

The plugin README is in better shape than the others but is missing features added on `dev`:
- Celestial map view with solar and Earth exclusion zones, sun/moon markers, RA/Dec overlay
- Sun exclusion legend entry in the sidebar
- Tooltip pin behaviour (click to lock tooltip)
- Label collision avoidance on ground projections
- Per-scenario behaviour driven by panel options

Add a short "What's New in v1.2.0" section or fold these into the existing Features section.

---

## Suggested Work Order

1. `mockup-digital-twin/README.md` — write from scratch (cleanest, no legacy to untangle)
2. `grafana-server/README.md` — rewrite (short, focused)
3. Root `README.md` — add the new sections (most visible, most impact)
4. `grafana-plugins/3d-orbit-attitude-plugin/README.md` — add the missing features
