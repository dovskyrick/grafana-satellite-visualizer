# Option B Implementation Plan: LVLH Ellipsoid Axes

## Overview

Replace the 6-element ECEF covariance matrix with 3 explicit LVLH semi-axes
(`ell_along`, `ell_cross`, `ell_radial`) throughout the entire pipeline.
The renderer then uses these directly as `EllipsoidGraphics` radii and
computes orientation from the satellite position at runtime — zero eigen-decomposition,
zero flicker, always orbit-aligned.

---

## Step 1 — Data Generators: `orbit-math.ts` (both files)

**Files:** `satellite-data-generator/src/orbit-math.ts`, `mockup-digital-twin/src/orbit-math.ts`

- Remove `cov_xx/yy/zz/xy/xz/yz` from the `TrajectoryPoint` interface.
- Add `ell_along: number`, `ell_cross: number`, `ell_radial: number` (semi-axis lengths in metres).
- Replace `generateCovarianceForEpoch` with a simpler function that returns the 3 sigma values directly — no rotation math needed anymore.
- Update the `generateCircularOrbit` call site to spread the 3 values.

**Touches:** 2 files, ~30 lines changed.

---

## Step 2 — Output Serializers (4 files)

**Files:** `generate-realtime-window.ts`, `generate-trajectories.ts`, `generate-many-satellites.ts`, `mockup-digital-twin/src/server.ts`

- Replace the 6 `cov_*` column definitions and row-value spreads with 3 `ell_*` columns.

**Touches:** 4 files, ~6 lines changed each, purely mechanical find-and-replace.

---

## Step 3 — Plugin Parser: `covarianceParser.ts`

**File:** `src/parsers/covarianceParser.ts`

- Rename `CovarianceMatrix` → `EllipsoidAxes` with fields `along`, `cross`, `radial`.
- Rename `CovarianceEpoch` → `EllipsoidEpoch`.
- Simplify `parseCovariance` → `parseEllipsoid`: look up `ell_along`, `ell_cross`, `ell_radial` fields instead of 6 covariance fields.
- Update `findNearestCovariance` → `findNearestEllipsoid`.

**Touches:** 1 file, rewrite of ~80 lines but straightforward.

---

## Step 4 — Plugin Types: `satelliteTypes.ts`

- Change `covariance?: CovarianceEpoch[]` → `ellipsoid?: EllipsoidEpoch[]`.
- Update import.

**Touches:** 1 file, 2 lines.

---

## Step 5 — Plugin Parser: `satelliteParser.ts`

- Update the field references to call `parseEllipsoid` instead of `parseCovariance` and store the result in `ellipsoid`.

**Touches:** 1 file, a few lines.

---

## Step 6 — Renderer: `CesiumEntityRenderers.tsx`

**The biggest conceptual change, but the code is short.**

In `UncertaintyEllipsoidRenderer`:
- Replace `getEllipsoidParams` / `covarianceToEllipsoid` with a lookup of `satellite.ellipsoid` for the 3 axis lengths.
- `dynamicRadii`: returns `new Cartesian3(ell_along, ell_cross, ell_radial)` directly.
- `dynamicOrientation`: compute LVLH quaternion from `satellite.position.getValue(time)` and a 1-second finite-difference for velocity. This is the same 4-line calculation already used in `computeLVLHOrientation`. Map LVLH axes to match the radii axis assignment (X=along-track, Y=cross-track, Z=radial).
- Delete `covarianceEllipsoid.ts` or keep only `getOpacityForQuality`.

**Touches:** 1 file, ~40 lines changed.

---

## Total Scope

| Step | Files | Difficulty |
|------|-------|------------|
| 1 — orbit-math.ts ×2 | 2 | simple |
| 2 — serializers ×4 | 4 | trivial |
| 3 — covarianceParser.ts | 1 | moderate |
| 4 — satelliteTypes.ts | 1 | trivial |
| 5 — satelliteParser.ts | 1 | simple |
| 6 — renderer | 1 | moderate |

**Overall difficulty: 5 / 10.** Each step individually is 2/10. The complexity is purely in tracking the rename across 10 files without missing any reference. No new math, no new architecture.
