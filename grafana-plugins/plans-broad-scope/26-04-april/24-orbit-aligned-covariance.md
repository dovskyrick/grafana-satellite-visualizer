# Orbit-Aligned Covariance Ellipsoids

## The Problem With the Current Generation

Both `satellite-data-generator/src/orbit-math.ts` and `mockup-digital-twin/src/orbit-math.ts` contain identical `generateCovarianceForEpoch` functions that hard-code the uncertainty as simply 3× along ECEF-X, 0.5× along ECEF-Y, and 1.5× along ECEF-Z. ECEF-X happens to point toward the prime meridian at the equator — it has nothing to do with the orbit direction. The ellipsoid ends up roughly along one ECEF axis and drifts in a confusing, non-physical way as the satellite moves.

## What "Orbit-Aligned" Means

In real orbit determination the uncertainty is naturally largest along-track (the position is hardest to know in the direction you are moving), smallest radially (range to Earth is well constrained), and medium cross-track. The three LVLH axes are:

- **R (radial)**: unit position vector — pointing away from Earth center.
- **T (along-track)**: velocity direction — tangent to the orbit.
- **N (cross-track)**: R × T — normal to the orbital plane.

## What Changes in the Code

The `generateCircularOrbit` loop already computes `(xFinal, yFinal, zFinal)`, the ECEF unit position vector. The velocity direction is just the derivative of position w.r.t. the mean anomaly angle: `(-sin(θ), cos(θ), 0)` rotated by the same inclination and LOAN matrices. Both vectors are already computable with no new imports.

`generateCovarianceForEpoch` receives those two direction vectors, builds the 3×3 LVLH-to-ECEF rotation matrix `R = [R_col | T_col | N_col]`, defines a diagonal covariance `C_lvlh = diag(σ_r², σ_t², σ_n²)` with `σ_t >> σ_r`, then transforms: `C_ecef = R · C_lvlh · Rᵀ`. The six output terms `cov_xx … cov_yz` are read from this matrix. The same change applies to both files identically.

## Difficulty: 3 / 5

The math involves a 3×3 rotation and matrix multiplication written by hand in plain TypeScript (no linear algebra library). All values needed are already produced in the loop. The change is self-contained in `generateCovarianceForEpoch` and the call site. The identical duplication across two files means the work is done twice, but copy-paste handles that.
