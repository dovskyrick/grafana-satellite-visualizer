# Scenario 4 — Sun-Pointing Sensor (Diagnosis & Plan)

**Difficulty: 3/10**
**Scope: server-side only (`mockup-digital-twin/src/server.ts`). No plugin changes.**

## Where we actually are

The static body attitude `(qx=1, qy=0, qz=0, qs=0)` we ship from `generateScenario4` is being interpreted by Cesium as **body→ICRF**, not body→ECEF (confirmed earlier in plan `53-scenario3-icrf-orientation.md`). That is exactly why the cone now appears glued to the celestial map: ICRF *is* the celestial frame. Picking a different static quaternion (the table in `60-scenario4.md`) only re-aims the boresight at a different fixed star — it can never track the Sun, because the Sun's ICRF direction drifts ~1°/day. No server-side constant will ever land on it.

## What needs to be done

The body attitude must be **time-dependent in ICRF**, computed so that the *sensor boresight* (after the fixed sensor-mount quaternion `ST_ORI`) lines up with the Sun unit vector in ICRF at every sample.

For each trajectory point at time `t`:

1. Get the Sun direction in ICRF, `s_icrf(t)` (unit vector).
2. Decide the boresight axis in body frame. The Star Tracker mount in `server.ts` is `ST_BASE * rotY(-10°) * rotZ(+90°)`, which rotates body **+Z** of the sensor onto a known body axis of the spacecraft. Pick the boresight expression `b_body` that the sensor's `+Z` becomes — for the current mount that is roughly body **+X** rotated by −10° around Y. Solve algebraically once, hardcode the body unit vector.
3. Build a body→ICRF rotation `R(t)` whose action on `b_body` equals `s_icrf(t)`. Use the standard "two-vector" construction: pick an "up hint" (e.g. ICRF +Z, the celestial north pole), cross-product it with the Sun direction to get a stable secondary axis, then complete the right-handed frame. Identical pattern to the GS-pointing block in `SatelliteVisualizer.tsx` lines 961–1027 — only the target vector and the frame change.
4. `Quaternion.fromRotationMatrix(R)` → emit as `(qx, qy, qz, qs)` per row.

## Best place to do it: server-side

Do it in `generateScenario4`, not in the plugin. Reasons:

- The plugin's `CallbackProperty` override already exists for Scenario 3 and adding another scenario-specific branch grows the file. The server already imports nothing Cesium-specific, so a tiny analytic Sun model (Meeus low-precision, ~0.01° accuracy, 20 lines) is appropriate and deterministic across reloads.
- One quaternion per minute (already our cadence) is plenty — the Sun moves 0.04° per minute. No `CallbackProperty`, no per-frame cost.
- Keeps the sensor-mount quaternion `ST_ORI` untouched; only the *body* attitude rows change.

## Verification

In Cesium with celestial-map mode on, the Star Tracker FOV disc should sit centered on the ☉ Sun marker and stay there as time advances. If it lags by a constant offset, the boresight body axis assumption is wrong; if it drifts at sidereal rate, the Sun vector was accidentally computed in ECEF instead of ICRF.
