# Scenario 3 — Quaternion Frame is ICRF, Not ECEF

## What the Observation Tells Us

The slow Z-spin from the server appeared fixed in inertial space (the spin axis did not rotate with the Earth). This confirms that Cesium entity orientation quaternions are interpreted in the **ICRF (Earth-Centred Inertial / ECI)** frame, not in ECEF. The quaternion rotates body-frame vectors into ICRF world space, regardless of the fact that the position property uses `ReferenceFrame.FIXED` (ECEF). These are two independent properties in Cesium.

## What Changes for the GS-Pointing Computation

Previously the plan was: compute direction vector (GS − SAT) in ECEF, build rotation matrix, done. That would have produced a quaternion in ECEF, which Cesium would have misinterpreted as ICRF — causing the cone to chase a fixed inertial point rather than the rotating ground station.

The corrected plan:
1. `sat.position.getValue(time)` → satellite ECEF position (correct, position IS in ECEF)
2. `Cartesian3.fromDegrees(lon, lat, alt)` → GS ECEF position (fixed on Earth surface)
3. `direction = normalize(GS_ecef − SAT_ecef)` → direction vector in ECEF
4. **Transform direction to ICRF**: `Matrix3.multiplyByVector(Transforms.computeFixedToIcrfMatrix(time), direction, ...)` → direction vector in ICRF
5. Build rotation matrix in ICRF with +Z column = ICRF direction
6. `Quaternion.fromRotationMatrix(R)` → quaternion in ICRF ✓

## Is There a Simple Cesium Function for Step 4?

Yes. `Cesium.Transforms.computeFixedToIcrfMatrix(time)` returns the 3×3 rotation matrix that transforms any ECEF vector to its ICRF equivalent at the given Julian time. This accounts for Earth's rotation, precession, and nutation. It may return `undefined` briefly on startup while the transform data loads — the callback should return the previous result or `Quaternion.IDENTITY` as a fallback.

The inverse (`computeIcrfToFixedMatrix`) is also available if needed. Both are standard Cesium utilities already imported in `SatelliteVisualizer.tsx` via the `Transforms` import.

## Does This Make Things Easier or Harder?

Slightly more work than the pure-ECEF approach — one extra `Matrix3.multiplyByVector` call per frame — but not harder. The maths is identical; we just apply the ECEF→ICRF rotation to the direction vector before building the pointing matrix. The `Transforms` object is already imported in the file.

## Next Step

Replace the fixed-quaternion override (Step 2) with the per-frame `CallbackProperty` that: fetches ECEF positions, computes the ICRF direction, builds the rotation matrix, returns the quaternion. Estimated difficulty still 3/10.
