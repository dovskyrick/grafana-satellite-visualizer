# LVLH-Based Ellipsoid Orientation

## Why the Current Approach Flickers and Misaligns

The current renderer calls `covarianceToEllipsoid` which runs `powerIteration` — a numerical method that starts from a random vector. Two problems result. First, on each frame the random start can converge to either `+v` or `-v` (the eigenvector sign is ambiguous), causing the orientation to flip by 180° from one frame to the next — that is the flicker. Second, the covariance we are generating in the data generator is already LVLH-aligned, so asking the renderer to re-discover that alignment by decomposing the ECEF covariance is circular work that introduces numerical noise.

## The Proposed Solution

The codebase already contains `computeLVLHOrientation` in `SatelliteVisualizer.tsx`. It samples the satellite position property, finite-differences it to get velocity, builds the three LVLH axes (X=cross-track, Y=along-track, Z=nadir) and converts them into a `SampledProperty<Quaternion>`. It is working and battle-tested — the LVLH axis arrows already render correctly in the scene.

The proposal is to bypass `covarianceToEllipsoid` for **orientation** entirely. Instead, the `UncertaintyEllipsoidRenderer` receives (or computes inline via `CallbackProperty`) the LVLH quaternion from the satellite position at the current time. The `dynamicOrientation` callback simply does: normalize position → compute velocity from a small time offset → build R/T/N axes → return quaternion. This is the same four-line computation already used for LVLH axes.

For **radii**, two clean options exist. Option A: keep `covarianceToEllipsoid` for eigenvalues only (the eigenvalue magnitudes are stable even when eigenvector signs are ambiguous — only the sorted `sqrt(λ)` values matter) and map them to (along-track, cross-track, radial) slots by sorting. Option B (cleaner long-term): change the data format to store three explicit LVLH sigmas (`ell_along`, `ell_cross`, `ell_radial`) instead of the 6-element ECEF covariance, and use them directly as radii. No decomposition at all.

## What Changes

- `UncertaintyEllipsoidRenderer`: replace `dynamicOrientation` callback with an inline LVLH quaternion computation (copies the logic already in `computeLVLHOrientation`).
- Optionally (Option B): add `ell_along / ell_cross / ell_radial` fields to `TrajectoryPoint`, update both `orbit-math.ts` generators to emit them, update `ParsedSatellite` type, and update the renderer to read them directly.

## Why This Works

The LVLH frame is uniquely defined by position and velocity — no random seed, no iteration, no sign ambiguity. The orientation is deterministic every single frame.

## Difficulty: 4 / 10

Option A (orientation only, keep covariance for radii): **3/10** — one function rewrite in the renderer, no data model changes.
Option B (full LVLH, drop covariance): **5/10** — data model change propagates through generator, server, parser, and renderer but each step is mechanical.
