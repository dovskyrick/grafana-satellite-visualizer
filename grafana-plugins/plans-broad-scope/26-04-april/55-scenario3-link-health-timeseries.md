# Scenario 3 — Communication Link Health Time Series

## First question: is the orbit sampled every 60 seconds or every 30 minutes?

The current generator is:

```typescript
const numPoints = Math.floor(durationS / 60) + 1;
```

That is **one point per minute**, which is fine — at 550 km a pass over Lisbon takes roughly 8–10 minutes, so there are ~10 position samples per pass. Cesium interpolates between them using Lagrange degree-5, so the animation is smooth. **No decimation problem.** This is not a concern.

---

## Second question: does Scenario 3 snap its start time to a stable slot like Scenarios 1 and 2?

**No — and that is a bug.**

Scenarios 1 and 2 both call `getTcaMs()` to anchor their propagation:

```typescript
function getTcaMs(): number {
  const SLOT_MS   = 30 * 60 * 1000;
  const OFFSET_MS = 90 * 60 * 1000;
  return Math.floor(Date.now() / SLOT_MS) * SLOT_MS + OFFSET_MS;
}
```

`Math.floor(Date.now() / SLOT_MS) * SLOT_MS` snaps "now" down to the nearest 30-minute boundary. Every request within the same 30-minute window returns the exact same TCA timestamp, so the orbits in Cesium are identical frame-to-frame and panel-to-panel. Users never see trajectory jumps on reload.

Scenario 3 does not do this. Its start time is:

```typescript
const startTime = new Date(fromMs);
```

`fromMs` is the Grafana time-range left edge, which Grafana recalculates as `Date.now() − windowDuration` on every page load or auto-refresh. Even a one-second difference in load time produces a different `startTime`, which shifts the entire orbit by one second, visibly moving every ground track and pass window. The effect is subtle for a single reload but becomes obvious on auto-refresh dashboards.

**Fix:** compute a snapped anchor the same way `getTcaMs` does, then pin `startTime` relative to it rather than to `fromMs`.

```typescript
function getScenario3AnchorMs(): number {
  const SLOT_MS = 30 * 60 * 1000;
  return Math.floor(Date.now() / SLOT_MS) * SLOT_MS;
}

// In generateScenario3:
const anchorMs   = getScenario3AnchorMs();
const startTime  = new Date(anchorMs);   // orbit always starts at the same slot boundary
```

The rest of the generator (`numPoints`, `durationS`, `lastObservedMs`) can still be derived from `fromMs` / `toMs` as now — the only thing that changes is where in the orbit the satellite is at the slot boundary, which stays fixed within each 30-minute window.

---

## The goal

Produce a time series column in the SAT-COMM data frame (or a separate frame on the same panel query) with one value per sample point, representing **link health**: is the antenna's GS-pointing attitude geometrically able to close a link with Lisbon at that moment? A simple boolean (visible / not-visible) is enough for now; later it can carry a signal quality float (function of elevation angle).

---

## Why not ask Cesium to compute this?

You could — but it would create a one-way dependency: the server would only have the time series after the plugin has run and somehow posted data back. That defeats the purpose of the server being the authoritative data source. The server already holds the full trajectory (positions in ECEF, timestamped). All the geometry needed to compute visibility — satellite ECEF position at each epoch, GS ECEF position (fixed, known) — is available server-side with no Cesium involved. Cesium has no monopoly on that maths.

---

## What the server needs to compute per sample point

For each trajectory point `(t, satEcef)`:

1. Compute the unit vector from GS to SAT in ECEF.
2. Compute the local "up" at the GS: the WGS84 surface normal at the GS location (`normalize(gsEcef)`; for a near-spherical Earth this is accurate to <0.1°).
3. **Elevation angle** = `asin(dot(gsToSat_unit, gsUp))`. This is the standard horizon angle — positive above the horizon, negative below.
4. **Link healthy** if elevation ≥ a minimum mask angle (e.g. 5° to avoid terrain blockage). At 550 km, maximum elevation during a pass can reach 80°+ for a directly overhead pass.

All of this is pure geometry — three dot products and an asin per sample. No Cesium, no ICRF, nothing exotic.

---

## Keeping it time-independent (the key requirement)

The orbit is **fictional and fixed**: `generateCircularOrbit` takes a `startTime` and a period and always generates the same shape of orbit scaled to whatever `[fromMs, toMs]` is requested. This means the *shape* of the elevation angle curve over one orbit period is always the same — only the absolute UTC timestamps shift.

The server already does this correctly for positions; it just needs to do it for the link health column too. Since `generateScenario3(fromMs, toMs)` is called fresh on every query with the caller's time range, the link health values will naturally be correct for whatever window is requested without any pre-computation or caching.

---

## Implementation plan (server side only)

In `generateScenario3`, after computing `basePoints` (which already has ECEF positions implicitly via the Kepler propagator):

```
gsEcef = Cartesian3.fromDegrees(-9.14, 38.72, 95)   // same coords as SCENARIO3_GS
MASK_ANGLE_DEG = 5

for each point p in points:
    satEcef = p.ecef           // add ecef output to generateCircularOrbit, or recompute inline
    gsToSat = normalize(satEcef - gsEcef)
    gsUp    = normalize(gsEcef)            // good approximation; WGS84 normal ≈ radial
    el_deg  = degrees(asin(dot(gsToSat, gsUp)))
    p.linkHealthy = el_deg >= MASK_ANGLE_DEG ? 1 : 0
    p.elevation   = el_deg                 // include raw elevation too — useful for display
```

Then `buildSatelliteFrame` needs to include `linkHealthy` and `elevation` as numeric columns in the data frame alongside the existing time, x, y, z, qx, qy, qz, qs columns.

---

## What `generateCircularOrbit` needs to expose

Currently the propagator returns attitude quaternions and times, but it is worth checking whether it already returns raw ECEF position or only stores it internally. If it doesn't expose ECEF x/y/z, either add them to the return value or recompute `satEcef` from the same Kepler parameters inline in `generateScenario3` — the geometry is simple at circular orbit.

---

## Summary

- **Orbit sampling**: already 1 point/minute, no issue.
- **Link health**: compute server-side from geometry (elevation angle vs. mask angle), no Cesium needed.
- **Time-independence**: free, because the server already regenerates the whole trajectory on every query.
- **Changes needed**: add ECEF output to `generateCircularOrbit` (or recompute inline), add elevation-angle logic in `generateScenario3`, add two new columns (`elevation_deg`, `link_healthy`) to `buildSatelliteFrame`.
- **Zero changes** to trajectory generation, orbit parameters, or plugin rendering.
