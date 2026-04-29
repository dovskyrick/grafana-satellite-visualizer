# Scenario 3 — GS-Pointing Attitude: Problem Statement & Resolution

## Project Context

This is a Grafana panel plugin (`3d-orbit-attitude-plugin`) built with React + Resium (Cesium wrapper). It visualises satellite trajectories and attitude in 3D. In Scenario 3, a single satellite (`SAT-COMM`) must have its antenna (a sensor cone pointing along the satellite body +Z axis) continuously aimed at a ground station (`Orbital GS Lisbon`, lat=38.72°N, lon=−9.14°E, alt=95 m). This orientation is computed entirely in the plugin — the server only provides the trajectory positions and a dummy attitude.

---

## Coordinate System Facts — Verified by Testing

### Positions
Satellite positions are stored in a Cesium `SampledPositionProperty` created with `ReferenceFrame.FIXED`. `getValue(time)` therefore returns **ECEF (Earth-Centred Earth-Fixed / ITRF)** vectors that co-rotate with Earth. Ground station positions are computed via `Cartesian3.fromDegrees(lon, lat, altMetres)` which also produces **ECEF** vectors.

### Orientations
Cesium entity orientation quaternions were empirically confirmed to be in **ICRF (Earth-Centred Inertial)**, not ECEF. This was determined by giving the satellite a slowly-increasing Z-rotation from the server: the spin axis remained fixed relative to the stars (inertial), not relative to Earth's surface. A fixed hardcoded quaternion `(0, 0.7071, 0, 0.7071)` (90° around Y) was then verified to freeze the satellite in a fixed inertial orientation, confirming the override `CallbackProperty` mechanism itself works correctly.

The orientation quaternion `q` represents: **rotation from satellite body frame to ICRF world frame**. Applied by Cesium as: world_vector = `Matrix3.fromQuaternion(q)` · body_vector.

### Sensor Cone Direction
In `CesiumEntityRenderers.tsx`, the sensor cone direction is computed as:
```typescript
const sensorWorldQuat = Quaternion.multiply(satOrient, sensorBodyQuat, new Quaternion());
const rotMatrix       = Matrix3.fromQuaternion(sensorWorldQuat);
const sensorDir       = Matrix3.multiplyByVector(rotMatrix, new Cartesian3(0, 0, 1), new Cartesian3());
```
The antenna sensor has identity body orientation (`qx=0, qy=0, qz=0, qw=1`), so `sensorWorldQuat = satOrient` and `sensorDir = Matrix3.fromQuaternion(satOrient) · [0,0,1]`. This is the **third column of the rotation matrix corresponding to `satOrient`**. For the antenna to point toward the GS, that third column must equal the unit vector from the satellite to the GS, expressed in ICRF.

---

## Root Cause (Resolved)

The bug was in the `Matrix3` constructor argument order. Cesium's `Matrix3` constructor takes its 9 numbers in **row-major** argument order — even though the internal storage is column-major. From `cesium/Source/Cesium.d.ts`:

```typescript
constructor(
  column0Row0?, column1Row0?, column2Row0?,   // row 0 (across columns)
  column0Row1?, column1Row1?, column2Row1?,   // row 1
  column0Row2?, column1Row2?, column2Row2?,   // row 2
);
```

The previous implementation passed the basis vectors three-at-a-time as if the constructor were column-major:

```typescript
new Matrix3(
  xDir.x, xDir.y, xDir.z,
  yDir.x, yDir.y, yDir.z,
  zDir.x, zDir.y, zDir.z,
);
```

Because the constructor is row-major, this actually produced a matrix whose **rows** were the basis vectors — i.e. the **transpose** of the intended rotation. For an orthonormal matrix the transpose is the inverse, so the resulting quaternion described the *inverse* rotation, which exactly matched the observed symptom: the satellite orientation drifted with the orbit but did not track the GS.

The misleading factors that distracted earlier debugging:

1. **Cesium quaternion convention (active vs passive rotation):** Not the issue. `Matrix3.fromQuaternion(q)` and `Quaternion.fromRotationMatrix(M)` are exact inverses by Cesium's design; the hardcoded-quaternion test already established the body→world convention is consistent.
2. **`Matrix3.fromQuaternion` vs the inverse:** Same as above — round-trip identity holds.
3. **Cesium axis permutation in ICRF:** Not the issue. Cesium ICRF axes are standard (X = vernal equinox, Z = celestial pole, right-handed). The hardcoded-quaternion test would have exposed any permutation.
4. **`computeFixedToIcrfMatrix` direction:** Not the issue. The function returns ECEF→ICRF, matching its name and how the code uses it.

---

## Fix

Two cleanups, applied together:

1. Use `Matrix3.fromColumnMajorArray([...])` to pack the basis vectors as columns. This removes any ambiguity about the constructor's argument order.
2. Build the body→ECEF rotation in ECEF (where the geometry — SAT→GS direction, satellite radial — is naturally expressed), then convert to ICRF with a single matrix multiply: `R_icrf = M_fixedToIcrf · R_ecef`. This replaces two per-frame vector transforms with one matrix multiply and reads more naturally.

```typescript
// In SatelliteVisualizer.tsx — inside applyFrames(), after parseSatellites()
if (options.scenarioId === ScenarioId.Scenario3 && parsedGroundStations.length > 0) {
  const targetGs = parsedGroundStations[0];
  const gsEcef   = Cartesian3.fromDegrees(targetGs.longitude, targetGs.latitude, targetGs.altitude);

  parsedSatellites.forEach(sat => {
    (sat as any).orientation = new CallbackProperty((time: JulianDate) => {
      const satEcef = sat.position.getValue(time);
      if (!satEcef) { return Quaternion.IDENTITY; }

      const fixedToIcrf = Transforms.computeFixedToIcrfMatrix(time, new Matrix3());
      if (!fixedToIcrf) { return Quaternion.IDENTITY; }

      // Body +Z target (antenna boresight) in ECEF: SAT → GS.
      const zEcef = Cartesian3.normalize(
        Cartesian3.subtract(gsEcef, satEcef, new Cartesian3()),
        new Cartesian3()
      );

      // Up hint: satellite radial in ECEF (just the normalised position).
      const radialEcef = Cartesian3.normalize(satEcef, new Cartesian3());

      // X axis: perpendicular to boresight and radial.
      const xEcef = Cartesian3.cross(radialEcef, zEcef, new Cartesian3());
      if (Cartesian3.magnitude(xEcef) < 1e-6) {
        Cartesian3.cross(Cartesian3.UNIT_Y, zEcef, xEcef);
      }
      Cartesian3.normalize(xEcef, xEcef);

      // Y axis: completes the right-handed frame.
      const yEcef = Cartesian3.normalize(
        Cartesian3.cross(zEcef, xEcef, new Cartesian3()),
        new Cartesian3()
      );

      // Body→ECEF rotation: basis vectors as columns.
      const rEcef = Matrix3.fromColumnMajorArray([
        xEcef.x, xEcef.y, xEcef.z,
        yEcef.x, yEcef.y, yEcef.z,
        zEcef.x, zEcef.y, zEcef.z,
      ]);

      // Body→ICRF = (ECEF→ICRF) · (Body→ECEF).
      const rIcrf = Matrix3.multiply(fixedToIcrf, rEcef, new Matrix3());

      return Quaternion.fromRotationMatrix(rIcrf);
    }, false);
  });
}
```

---

## Verification

1. **Visual check:** at a time when SAT-COMM passes near Lisbon, the cone should sweep through the GS marker.
2. **Numeric round-trip (temporary):**
   ```typescript
   const q = Quaternion.fromRotationMatrix(rIcrf);
   const m = Matrix3.fromQuaternion(q, new Matrix3());
   const back = Matrix3.multiplyByVector(m, new Cartesian3(0, 0, 1), new Cartesian3());
   // back should equal Matrix3.multiplyByVector(fixedToIcrf, zEcef, …) to ~1e-12.
   ```

---

## Files Involved

- `grafana-plugins/3d-orbit-attitude-plugin/src/components/SatelliteVisualizer.tsx` — orientation override (Scenario 3 block in `applyFrames`)
- `grafana-plugins/3d-orbit-attitude-plugin/src/components/entities/CesiumEntityRenderers.tsx` — sensor cone direction computation
- `grafana-plugins/3d-orbit-attitude-plugin/src/parsers/satelliteParser.ts` — position (`ReferenceFrame.FIXED`, ECEF), orientation (`SampledProperty(Quaternion)`, ICRF)
- `mockup-digital-twin/src/server.ts` — `generateScenario3()` returns SAT-COMM trajectory with Z-spin attitude test data and `SCENARIO3_GS` ground station
