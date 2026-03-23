# Plan: Mockup Digital Twin Server

## Goal

Replace the manual "generate JSON → paste into TestData DB" workflow with a lightweight HTTP
server that Grafana queries automatically.  The server always generates the same 3-satellite
trajectory (Starlink-4021, Hubble, ISS) but anchors the timestamps to whatever time range
Grafana asks for, capped at 6 hours.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js 20 (LTS) | Same ecosystem as the existing generator code |
| Language | TypeScript via `ts-node` | Reuse `orbit-math.ts` with zero conversion |
| HTTP framework | **Express 4** | 3 lines to add a route; no magic |
| CORS | `cors` npm package | Needed so the browser-side plugin can `fetch()` it |
| Grafana integration | **Plugin-side `fetch()`** (no new datasource plugin) | Minimal: one new panel option in the plugin |

No build step required for the mockup digital twin – `ts-node` runs it directly, just like the generator.

---

## Repository Layout

```
mockup-digital-twin/          ← new top-level folder
  package.json
  tsconfig.json
  src/
    server.ts              ← single entry-point (all logic here)
    orbit-math.ts          ← copy/symlink from satellite-data-generator/src/
```

`orbit-math.ts` is duplicated (or symlinked) so the mockup digital twin has zero dependency on the
generator package.  If the two diverge later we can make a shared lib.

---

## API Contract

### `GET /health`

Returns `200 OK` with body `{ "status": "ok" }`.
Grafana can use this for datasource health checks.

### `GET /api/satellites?from=<epoch_ms>&to=<epoch_ms>`

**Query params** (both optional, defaults to "last 6 hours from now"):
- `from` – start of the requested window in Unix milliseconds
- `to` – end of the requested window in Unix milliseconds

**Behaviour**:
1. Parse `from` and `to`.
2. Cap the effective duration at `MAX_DURATION = 6 * 3600 s` (6 hours). If the requested
   window is longer, only the first 6 hours starting at `from` are returned.
3. Compute `numPoints = Math.floor(effectiveDurationSeconds / 300) + 1`
   (one point every 5 minutes).
4. Generate the 3 satellites + ground-stations using the existing orbit configs.
5. Return the JSON array (same format already understood by the plugin).

**Response headers**:
```
Content-Type: application/json
Access-Control-Allow-Origin: *
```

**Response body**: identical structure to `multi-satellite-9h.json` (array of satellite
objects + ground-stations object at the end).

---

## Functions to Write (all in `server.ts`)

```
generateTrajectory(fromMs: number, durationSeconds: number) → array
  - Mirrors the satellite loop in generate-realtime-window.ts
  - Uses fixed orbit configs (no randomness, same 3 satellites)
  - Returns the complete JSON array ready to send

handleSatellites(req, res)
  - Reads ?from and ?to query params
  - Defaults: to = Date.now(), from = to - 6h
  - Caps duration to MAX_DURATION_S
  - Calls generateTrajectory()
  - res.json(result)

handleHealth(req, res)
  - res.json({ status: 'ok' })

main()
  - Creates Express app
  - Registers routes: GET /health, GET /api/satellites
  - Listens on PORT (default 3001)
```

---

## Plugin Change (minimal)

Add one new panel option in `types.ts`:

```ts
dataServerUrl?: string;   // e.g. "http://localhost:3001"
```

In `SatelliteVisualizer.tsx`, in the existing data-loading `useEffect`:

```ts
if (options.dataServerUrl) {
  const { from, to } = timeRange;              // already available in panel props
  const url = `${options.dataServerUrl}/api/satellites?from=${from.valueOf()}&to=${to.valueOf()}`;
  const raw = await fetch(url).then(r => r.json());
  // hand raw to the existing parser that already handles multi-satellite-9h.json format
  return;
}
// ... existing datasource path unchanged
```

If `dataServerUrl` is empty the panel works exactly as before (TestData DB).
This means zero breaking change.

---

## Running the Mockup Digital Twin

```bash
cd mockup-digital-twin
npm install           # only needed once
npx ts-node src/server.ts
```

Mockup digital twin starts on `http://localhost:3001`.

In the Grafana panel options set:
```
Data Server URL: http://localhost:3001
```

---

## What Is NOT in Scope (future)

- TLE ingestion / live propagation
- Multiple configurable orbit types
- Auth / rate-limiting
- Docker / systemd service
- Serving different trajectories per request
- Database persistence
