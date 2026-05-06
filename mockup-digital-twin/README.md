# Mockup Digital Twin Server

A lightweight TypeScript/Express HTTP server that acts as the simulated spacecraft digital twin powering all scenario dashboards in this project. It generates satellite trajectories, uncertainty ellipsoids, collision risk curves, communication link telemetry, and star tracker anomaly series — all computed on the fly from orbital mechanics and served as JSON to Grafana via the [Infinity datasource](https://grafana.com/grafana/plugins/yesoreyeram-infinity-datasource/).

**Live deployment**: `https://satellite-twin.fly.dev` (Fly.io, London region)

---

## What It Does

The server has no database. Every response is computed at request time from deterministic orbital math, anchored to **30-minute time slots** so that the satellite positions, TCA timestamps, anomaly windows, and confidence table values stay consistent across dashboard reloads and auto-refreshes within the same slot.

It drives six Grafana dashboards:

| Scenario | Dashboard | What It Evaluates |
|----------|-----------|-------------------|
| 0 | Free Exploration | General 3D orbit and attitude browsing — 3 satellites + 4 ground stations |
| 1 | Collision Risk Analysis | Conjunction assessment with pre-assigned source confidence — 4 trajectories with different observation ages and uncertainty growth |
| 2 | Confidence Assessment | Same conjunction geometry but the operator must assign confidence themselves — one trajectory has a suspiciously frozen ellipsoid |
| 3 | Communication Anomaly | Single satellite with an antenna sensor; link health drops during the 2nd contact window with a Lisbon ground station |
| 4 | Star Tracker Anomaly | Periodic 4-minute attitude degradation every 30-minute cycle when the star tracker enters solar exclusion |
| 5 | Ground Station Antenna Anomaly | Same orbit and link data as Scenario 3, but the anomaly is attributed to the ground antenna, not the spacecraft |

---

## API Endpoints

All endpoints return JSON. Time parameters (`from`, `to`) are Unix timestamps in **milliseconds**.

| Method | Endpoint | Query Params | Description |
|--------|----------|--------------|-------------|
| `GET` | `/health` | — | Health check — returns `{ "status": "ok" }` |
| `GET` | `/api/satellites` | `from`, `to`, `scenario` | Main satellite trajectory data for the 3D plugin. Returns an array of satellite frames, each containing orbital columns and rows, sensor definitions, and uncertainty ellipsoid data. |
| `GET` | `/api/risk` | `from`, `to` | Gaussian collision risk curve centred on TCA. σ = 20 minutes, one point per minute. |
| `GET` | `/api/tca-marker` | — | Single-point timestamp marking the Time of Closest Approach, used to draw a vertical annotation line on timeseries panels. |
| `GET` | `/api/confidence` | `scenario` | Confidence metadata table: trajectory ID, source reliability score, ellipsoid size at TCA, time since last observation, and source name. For Scenario 2, reflects operator-submitted values if present. |
| `POST` | `/api/confidence` | — | Body: `{ "id": "sat-2a", "confidence": 7 }`. Stores an operator-assigned confidence score for Scenario 2 with a 10-minute TTL. |
| `GET` | `/api/link-elevation` | `from`, `to` | Satellite elevation angle above the Lisbon ground station horizon (Scenario 3). |
| `GET` | `/api/link-status` | `from`, `to` | Binary link health (100 = healthy, 0 = no contact or injected anomaly) for Scenario 3. |
| `GET` | `/api/link-anomaly` | `from`, `to` | Anomaly intensity signal (triangle pulse in the middle third of the 2nd contact window) for Scenario 3. |
| `GET` | `/api/link-anomaly-window` | — | `{ "start": <ms>, "end": <ms> }` — exact boundaries of the injected anomaly window for Scenario 3. |
| `GET` | `/api/sc5-link-elevation` | `from`, `to` | Same as `link-elevation` but for Scenario 5's independently configured dashboard panels. |
| `GET` | `/api/sc5-link-status` | `from`, `to` | Same as `link-status` for Scenario 5. |
| `GET` | `/api/sc5-link-anomaly` | `from`, `to` | Same as `link-anomaly` for Scenario 5. |
| `GET` | `/api/sc5-link-anomaly-window` | — | Same as `link-anomaly-window` for Scenario 5. |
| `GET` | `/api/stars-matched` | `from`, `to` | Number of stars matched by the star tracker per 30-second sample. Drops to 0 during the 4-minute anomaly window of each 30-minute cycle (Scenario 4). |
| `GET` | `/api/tracker-anomaly` | `from`, `to` | Binary anomaly flag (100 = anomaly, 0 = nominal) for the star tracker degradation windows (Scenario 4). |

### Scenario IDs

Pass `scenario=<n>` to `/api/satellites` and `/api/confidence`:

```
0 = Default (free exploration)
1 = Collision Risk Analysis
2 = Confidence Assessment
3 = Communication Anomaly
4 = Star Tracker Anomaly
5 = Ground Station Antenna Anomaly
```

---

## Time Slot Anchoring

The TCA timestamp and orbit anchor are both snapped to **30-minute boundaries** at request time:

- **TCA** = `floor(now / 30min) * 30min + 90min` (always 1h30min into the future from the current slot start)
- **Scenario 3/4/5 orbit anchor** = `floor(now / 30min) * 30min − 6h`

This means every request within the same 30-minute window returns identical timestamps, keeping the 3D plugin, risk curve, TCA marker, and confidence table perfectly synchronised without any shared state.

---

## Session Isolation (Scenario 2)

Scenario 2 requires each test user to assign their own confidence scores without seeing other users' values. This is solved without user accounts:

- The Grafana dashboard URL contains a unique session token as a template variable
- Every `POST /api/confidence` request stores the value in memory under the satellite ID with a **10-minute TTL**
- On `GET /api/confidence`, expired entries return `-1` (rendered as `?` in Grafana via value mappings)
- Values reset automatically without any manual cleanup

This is intentionally ephemeral: a fresh user gets a clean slate after 10 minutes.

---

## Running Locally

### Standalone (with ts-node)

```bash
cd mockup-digital-twin
npm install
npm start
```

Server starts on `http://localhost:3001`.

### Via Docker Compose (recommended for full local setup)

From the repository root:

```bash
cd grafana-server
docker compose up -d
```

The `docker-compose.yml` starts both the Grafana server and this mockup twin together. The twin is reachable inside the Docker network at `http://mockup-digital-twin:3001` — which is the URL pre-configured in the Infinity datasource.

---

## Deployment on Fly.io

The server is deployed as a Fly.io application named `satellite-twin` in the `lhr` (London) region.

**App URL**: `https://satellite-twin.fly.dev`

**Machine spec**: 512 MB RAM, 1 shared CPU, auto-start/stop enabled with minimum 1 machine always running.

### Redeploy after changes

```bash
cd mockup-digital-twin
fly deploy
```

Fly.io builds from the included `Dockerfile` (Node 20 Alpine, runs `ts-node` directly — no compile step needed).

### Check logs

```bash
fly logs --app satellite-twin
```

---

## Technology

- **Runtime**: Node.js 20
- **Framework**: Express 4
- **Language**: TypeScript (executed directly via ts-node — no build step)
- **Orbital math**: custom Keplerian propagator in `src/orbit-math.ts`
- **Deployment**: Fly.io (Docker-based)
