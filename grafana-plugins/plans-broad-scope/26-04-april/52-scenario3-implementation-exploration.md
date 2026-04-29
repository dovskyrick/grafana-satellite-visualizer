# Scenario 3 — Implementation Exploration

## Cesium Attitude Forcing (Earth-Pointing)

Cesium has a native `VelocityOrientationProperty` that keeps a satellite aligned with its velocity vector, but for nadir or ground-station pointing we need something custom. The approach is: at each clock tick, compute the unit vector from the satellite position to the ground station position in ECEF, then construct a quaternion that aligns the satellite's antenna axis (positive Z body) with that vector. This is straightforward 3D maths — cross product for the rotation axis, dot product for the angle — and can be done inside a Cesium `CallbackProperty` on the entity's `orientation`, which Cesium evaluates every frame. The result is a perfectly smooth ground-station-tracking attitude with no data generation changes needed.

This is entirely a plugin-side feature, toggled only when `scenarioId === Scenario3`. No server changes required for the attitude itself.

## Introducing the Mispointing Anomaly

Several options for creating the attitude fault during the anomaly interval:

**Option A — Fixed offset quaternion.** During the anomaly interval, add a fixed 15–20° rotation around the body X or Y axis before applying the GS-pointing quaternion. The antenna drifts off target abruptly at interval start and snaps back at interval end. Simple, visually obvious.

**Option B — Smooth drift.** Linearly interpolate the offset angle from 0° to 20° over a few seconds, hold, then recover. More realistic — looks like a slow attitude control failure rather than a glitch. Slightly more code.

**Option C — Wrong target.** During the anomaly, point the antenna at a fixed inertial direction (e.g. Sun or a hardcoded celestial point) instead of the GS. The footprint visibly slides away from the GS. Most dramatic visually.

**Recommendation: Option A or B.** Option A is easiest to implement and clearly shows the displacement in the FOV footprint. Option B is more convincing for an evaluator.

## Communication Link Timeseries

The server returns a `/api/link-quality?scenario=3` endpoint with one point per minute across the requested window, outputting a value between 0 and 1:

- **1.0** during nominal contact (satellite above horizon relative to GS, antenna pointing correctly)
- **0.0** during the anomaly interval (mispointing window, e.g. 8 minutes)
- A brief **ramp down / ramp up** (2–3 minutes each side) to simulate gradual degradation rather than a hard step

The window of `1.0` represents the contact pass. Outside the pass, the value is `null` or `0` (no link expected). This gives the operator a clear "find the anomaly in the flat-top region" task.

A second binary series `link_nominal` (1 or 0) could sit alongside it as a simpler indicator, but the continuous quality metric is more informative and better suited to the crosshair selection task.

## Satellite and Ground Station Setup

- Single circular orbit, inclination ~45°, altitude ~600 km, chosen so the satellite passes within 10° elevation of the GS during the scenario window
- Single ground station (e.g. Madrid or a fictional equivalent at similar latitude)
- Single sensor named "Antenna", FOV ~5°, aligned with +Z body axis
- `lastObservedTime` not relevant here — ellipsoid can be minimal or hidden

## Difficulty

Plugin attitude forcing: **4/10** — requires a per-frame ECEF vector computation inside a `CallbackProperty`.  
Server link quality curve: **1/10** — similar to the risk curve already implemented.  
Combined scenario: **4/10** total.
