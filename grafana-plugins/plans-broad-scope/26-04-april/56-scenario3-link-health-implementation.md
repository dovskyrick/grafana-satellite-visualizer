# Scenario 3 — Communication Link Health Time Series: Implementation Plan

**Difficulty: 2/10**

---

## What already exists

`buildSatelliteFrame` builds the data frame by listing columns and then mapping each `TrajectoryPoint` to a row array. Adding two new columns is a matter of appending to both lists. The points array already has `longitude`, `latitude`, `altitude` at each timestamp — everything needed to compute the elevation angle toward the GS is already there.

---

## What needs to be computed

For each trajectory point `p` in `generateScenario3`:

1. Convert `(p.longitude, p.latitude, p.altitude)` to ECEF. This is standard geodetic-to-ECEF maths — no library needed, just sin/cos.
2. Convert the GS `(lon=−9.14°, lat=38.72°, alt=95 m)` to ECEF once before the loop (it is constant).
3. Compute the unit vector from GS to SAT: `normalize(satEcef − gsEcef)`.
4. Compute the GS surface normal (up vector): `normalize(gsEcef)` — accurate to well under 0.1° for WGS84.
5. **Elevation angle** = `degrees(asin(dot(gsToSat, gsUp)))`. Positive = above horizon, negative = below.
6. **Link healthy** = `elevation >= MASK_ANGLE_DEG ? 1 : 0` (use 5° as the mask).

All of this is pure arithmetic. No imports, no Cesium, no external dependencies.

---

## What changes in server.ts

**One helper function** (~15 lines): `llaToEcef(lon, lat, altM)` converting geodetic to ECEF using the standard spherical approximation (good enough for a fictional scenario — error < 20 km vs WGS84).

**In `generateScenario3`**: compute `gsEcef` once, then compute `elevationDeg` and `linkHealthy` per point in the same `.map()` that already applies the Z-spin attitude. Attach them to the point object.

**In `buildSatelliteFrame`**: add two entries to the `columns` array (`elevation_deg` and `link_healthy`) and include the two values in the `rows` map. Since `buildSatelliteFrame` is shared with Scenarios 1 and 2 (which don't have these fields), the cleanest approach is to pass them as an optional extra-columns parameter, or simply add a Scenario 3-specific `buildSatelliteFrameS3` wrapper that calls `buildSatelliteFrame` and then appends the columns. The wrapper approach avoids touching the shared function at all.

---

## Plugin side

Nothing needs to change in the plugin to *generate* the data — it just appears as two new numeric columns in the existing data frame. A separate Grafana time series panel can be pointed at the same data source query with Scenario 3 selected and display `link_healthy` and `elevation_deg` as a standard time series — no plugin code involved.

---

## Summary of file changes

| File | Change |
|---|---|
| `server.ts` | Add `llaToEcef` helper, compute elevation in `generateScenario3`, pass to `buildSatelliteFrame` |
| `server.ts` | Extend `buildSatelliteFrame` (or add a wrapper) with two optional extra columns |
| Plugin / Grafana | Zero changes — new columns appear automatically |

Total new lines: roughly 40.
