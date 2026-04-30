# Scenario 4 — Sun-Pointing via Plugin Override (Copy of Scenario 3)

**Difficulty: 1/10**
**Scope: plugin-side only (`SatelliteVisualizer.tsx`). Server-side static attitude can stay as-is — it gets overridden anyway.**

## Idea

The Scenario 3 GS-pointing override already builds, per Cesium frame, a body→ECEF rotation whose +Z column is the SAT→target direction. Reuse this verbatim, only swap the target: instead of a fixed ground-station ECEF point, recompute the Sun's ECEF position every frame.

## What needs to be done

1. **Server**: in `generateScenario4`, set the Star Tracker `orientation` to identity `{ qx: 0, qy: 0, qz: 0, qw: 1 }`. Boresight is then body +Z, exactly mirroring Scenario 3's antenna. Drop the existing `ST_BASE/ST_ROT_Y/ST_ROT_Z` chain and the per-point Sun computation I added earlier.
2. **Plugin**: copy the `if (options.scenarioId === ScenarioId.Scenario3 …)` block in `SatelliteVisualizer.tsx` (lines ~961–1027) and add a sibling `else if (options.scenarioId === ScenarioId.Scenario4)` block. Inside the `CallbackProperty`, replace the constant `gsEcef` with a per-frame `sunECEF` using the same recipe already present at line ~1851:

   ```typescript
   const sunECI    = Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time, new Cartesian3());
   const icrfToFixed = Transforms.computeIcrfToFixedMatrix(time);
   const sunECEF   = icrfToFixed
     ? Matrix3.multiplyByVector(icrfToFixed, sunECI, new Cartesian3())
     : sunECI;
   ```

   Skip the anomaly-window tilt block — Scenario 4 has no anomaly injection. Everything else (radial up-hint, X/Y/Z basis, `Quaternion.fromRotationMatrix`) is unchanged.

## Why this works

The same code path already maintains a valid pointing toward a moving Earth-fixed target across the orbit; the Sun is just a much farther target whose ECEF position varies with time. Imports (`Simon1994PlanetaryPositions`, `Transforms`, `Matrix3`) are already present in the file.
