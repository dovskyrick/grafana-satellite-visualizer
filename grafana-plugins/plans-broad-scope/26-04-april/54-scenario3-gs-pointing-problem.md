# Scenario 3 — GS-Pointing Attitude: Full Problem Statement

## Project Context

This is a Grafana panel plugin (`3d-orbit-attitude-plugin`) built with React + Resium (Cesium wrapper). It visualises satellite trajectories and attitude in 3D. In Scenario 3, a single satellite (`SAT-COMM`) must have its antenna (a sensor cone pointing along the satellite body +Z axis) continuously aimed at a ground station (`Orbital GS Lisbon`, lat=38.72°N, lon=−9.14°E, alt=95 m). This orientation is computed entirely in the plugin — the server only provides the trajectory positions and a dummy attitude.

---

## Coordinate System Facts — Verified by Testing

### Positions
Satellite positions are stored in a Cesium `SampledPositionProperty` created with `ReferenceFrame.FIXED`. This means all position values are in **ECEF (Earth-Centred Earth-Fixed / ITRF)** — they co-rotate with Earth. Ground station positions are computed via `Cartesian3.fromDegrees(lon, lat, altMetres)` which also produces **ECEF** vectors.

### Orientations
Cesium entity orientation quaternions were empirically confirmed to be in **ICRF (Earth-Centred Inertial)**, not ECEF. This was determined by giving the satellite a slowly-increasing Z-rotation from the server: the spin axis remained fixed relative to the stars (inertial), not relative to Earth's surface. A fixed hardcoded quaternion `(0, 0.7071, 0, 0.7071)` (90° around Y) was then verified to freeze the satellite in a fixed inertial orientation, confirming the override `CallbackProperty` mechanism itself works correctly.

The orientation quaternion `q` therefore represents: **rotation from satellite body frame to ICRF world frame**. Applied by Cesium as: world_vector = `Matrix3.fromQuaternion(q)` · body_vector.

### Sensor Cone Direction
In `CesiumEntityRenderers.tsx`, the sensor cone direction is computed as:
```typescript
const sensorWorldQuat = Quaternion.multiply(satOrient, sensorBodyQuat, new Quaternion());
const rotMatrix       = Matrix3.fromQuaternion(sensorWorldQuat);
const sensorDir       = Matrix3.multiplyByVector(rotMatrix, new Cartesian3(0, 0, 1), new Cartesian3());
```
The antenna sensor has identity body orientation (`qx=0, qy=0, qz=0, qw=1`), so `sensorWorldQuat = satOrient` and `sensorDir = Matrix3.fromQuaternion(satOrient) · [0,0,1]`. This is the **third column of the rotation matrix corresponding to `satOrient`**. For the antenna to point toward the GS, that third column must equal the unit vector from the satellite to the GS, expressed in ICRF.

---

## The Rotation Matrix Construction

The goal: build a rotation matrix `R` (in ICRF) such that `R · [0,0,1] = zDir_icrf` where `zDir_icrf` is the unit vector from satellite to GS in ICRF. This requires three orthonormal columns:

- **Column 2 (zDir):** unit vector from SAT → GS, in ICRF
- **Column 0 (xDir):** perpendicular to zDir and to a chosen "up" hint
- **Column 1 (yDir):** completes the right-handed frame

The Cesium `Matrix3` constructor signature is:
```
new Matrix3(c0r0, c0r1, c0r2,  c1r0, c1r1, c1r2,  c2r0, c2r1, c2r2)
```
where `cNrM` = column N, row M. So `Matrix3.multiplyByVector(R, [0,0,1])` picks out column 2 = `(c2r0, c2r1, c2r2)`. The construction:
```typescript
new Matrix3(
  xDir.x, xDir.y, xDir.z,   // column 0
  yDir.x, yDir.y, yDir.z,   // column 1
  zDir.x, zDir.y, zDir.z    // column 2
)
```
makes `R · [0,0,1] = (zDir.x, zDir.y, zDir.z)` = `zDir` ✓. This matrix algebra is confirmed correct.

---

## Current Implementation

```typescript
// In SatelliteVisualizer.tsx — inside applyFrames(), after parseSatellites()
if (options.scenarioId === ScenarioId.Scenario3 && parsedGroundStations.length > 0) {
  const targetGs = parsedGroundStations[0];  // Orbital GS Lisbon
  const gsEcef   = Cartesian3.fromDegrees(targetGs.longitude, targetGs.latitude, targetGs.altitude);

  parsedSatellites.forEach(sat => {
    (sat as any).orientation = new CallbackProperty((time: JulianDate) => {
      const satEcef = sat.position.getValue(time);  // ECEF
      if (!satEcef) { return Quaternion.IDENTITY; }

      // Step 1: direction SAT→GS in ECEF
      const dirEcef = Cartesian3.normalize(
        Cartesian3.subtract(gsEcef, satEcef, new Cartesian3()), new Cartesian3()
      );

      // Step 2: transform direction to ICRF
      const fixedToIcrf = Transforms.computeFixedToIcrfMatrix(time, new Matrix3());
      if (!fixedToIcrf) { return Quaternion.IDENTITY; }
      const zDir = Cartesian3.normalize(
        Matrix3.multiplyByVector(fixedToIcrf, dirEcef, new Cartesian3()), new Cartesian3()
      );

      // Step 3: up-hint = satellite radial direction in ICRF
      const radialIcrf = Cartesian3.normalize(
        Matrix3.multiplyByVector(fixedToIcrf, satEcef, new Cartesian3()), new Cartesian3()
      );

      // Step 4: orthonormal frame
      const xDir = Cartesian3.cross(radialIcrf, zDir, new Cartesian3());
      if (Cartesian3.magnitude(xDir) < 1e-6) {
        Cartesian3.cross(Cartesian3.UNIT_Y, zDir, xDir);
      }
      Cartesian3.normalize(xDir, xDir);
      const yDir = Cartesian3.normalize(Cartesian3.cross(zDir, xDir, new Cartesian3()), new Cartesian3());

      // Step 5: rotation matrix and quaternion
      const rotMatrix = new Matrix3(
        xDir.x, xDir.y, xDir.z,
        yDir.x, yDir.y, yDir.z,
        zDir.x, zDir.y, zDir.z
      );
      return Quaternion.fromRotationMatrix(rotMatrix);
    }, false);
  });
}
```

The `CallbackProperty` override mechanism is confirmed working. The `fixedToIcrf` transform is confirmed available. The matrix algebra is verified correct on paper.

---

## Observed Problem

The cone does not point toward Lisbon. The orientation is "moving somewhat" with the orbit but not clearly tracking the GS. Possible causes yet to be isolated:

1. **Cesium quaternion convention (active vs passive rotation):** Cesium may define the orientation quaternion as rotating ICRF vectors into the body frame (passive/inverse), rather than body → ICRF (active). If so, the quaternion returned should be the conjugate/inverse: `Quaternion.conjugate(Quaternion.fromRotationMatrix(rotMatrix), result)`.

2. **Matrix3.fromQuaternion vs the inverse:** The sensor cone computes `sensorDir = Matrix3.fromQuaternion(satOrient) · [0,0,1]`. If `Matrix3.fromQuaternion(q)` produces the transpose of the rotation described by `q` (Cesium sometimes uses column-major vs row-major conventions), then the relationship between the quaternion and the third column is inverted.

3. **Cesium axis permutation:** Cesium's ICRF axes may not be standard XYZ (e.g., Y and Z swapped relative to what we expect). This would require permuting the matrix columns.

4. **`computeFixedToIcrfMatrix` direction:** The function might return ICRF→ECEF rather than ECEF→ICRF (naming ambiguity). If so, `computeIcrfToFixedMatrix` should be used instead, or the matrix should be transposed.

---

## Files Involved

- `grafana-plugins/3d-orbit-attitude-plugin/src/components/SatelliteVisualizer.tsx` — orientation override (lines ~943–1005)
- `grafana-plugins/3d-orbit-attitude-plugin/src/components/entities/CesiumEntityRenderers.tsx` — sensor cone direction computation (lines ~308–346)
- `grafana-plugins/3d-orbit-attitude-plugin/src/parsers/satelliteParser.ts` — position (`ReferenceFrame.FIXED`, ECEF), orientation (`SampledProperty(Quaternion)`, ICRF)
- `mockup-digital-twin/src/server.ts` — `generateScenario3()` returns SAT-COMM trajectory with Z-spin attitude test data and `SCENARIO3_GS` ground station
