# Digital Twin Mockup Server — Design Considerations

## Overview

A lightweight HTTP server wraps the existing `orbit-math` / trajectory generators and exposes satellite trajectory data to Grafana via the **Infinity plugin** (JSON datasource). Two interaction modes need to be supported: **static time-range queries** and **live/rolling updates**.

---

## Mode 1 — Static Time-Range Query

Grafana sends a request specifying `from` and `to` timestamps (Infinity passes these as query params or body fields). The server:

1. Accepts `?from=<unix_ms>&to=<unix_ms>` (plus optionally `?satellite=<name>`).
2. Derives `duration = to - from` in seconds and `numPoints` from a fixed step (e.g. 30 s).
3. Always seeds the orbit from the **same canonical initial state** (fixed altitude, inclination, RAAN, `startAnomaly=0`) so the trajectory is deterministic and reproducible across dashboard reloads.
4. Calls `generateCircularOrbit()` with those params and returns the `TrajectoryPoint[]` array as JSON rows matching the existing column schema.

**Key consideration:** Grafana's time range can be arbitrarily wide (hours to days). The generator already accepts any `duration`, so this is free — just watch `numPoints` scaling (cap at e.g. 5 000 points, downsample if needed to keep response size bounded).

---

## Mode 2 — Live / Rolling State

For a "live" feed the server must maintain **per-satellite state**: the last known position and velocity (or equivalently, the last `TrajectoryPoint` + wall-clock timestamp).

**Mechanics:**
- On first request for satellite `SAT-A`, initialize state from the canonical seed.
- On each subsequent request, compute `Δt = now - lastUpdateTime`, propagate the orbit forward by `Δt`, store the new state, and return a window of e.g. the last N seconds of points.
- The Grafana panel polls on a refresh interval (e.g. 5 s). Each poll triggers a `/live?satellite=SAT-A&window=300` request returning the last 5 min of trajectory so the 3-D path stays populated without gaps.

**Key considerations:**
- **State store:** an in-memory map `{ [satelliteId]: { lastPoint, lastWallTime } }` is sufficient for a mockup. No persistence needed.
- **Clock drift:** use `Date.now()` server-side; do not trust client-supplied timestamps for propagation.
- **Realism ceiling:** Keplerian propagation is valid indefinitely, but the covariance model grows unbounded — reset it periodically or clamp.
- **Multiple satellites:** each entry in the state map is independent; trivially parallelisable.

---

## API Shape (Proposed)

| Endpoint | Params | Returns |
|---|---|---|
| `GET /trajectory` | `from`, `to`, `satellite?` | full arc, deterministic |
| `GET /live` | `satellite`, `window?` (seconds) | rolling window from live state |
| `GET /satellites` | — | list of available satellite names/ids |

---

## Grafana / Infinity Integration

- Set Infinity datasource URL to `http://localhost:<port>`.
- Use **JSON** type, **Backend** mode for CORS-free access, or allow origin in server headers.
- Map response `rows` array directly — column order must match the existing plugin schema (`time`, `longitude`, `latitude`, `altitude`, `qx`, `qy`, `qz`, `qs`, `cov_*`).
- Refresh interval drives the effective "live" cadence; 5–10 s is a reasonable starting point.
