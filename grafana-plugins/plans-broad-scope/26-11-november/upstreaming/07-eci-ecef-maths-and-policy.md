# 07 — ECI → ECEF: is the maths dangerous, and who should do it?

## Short answer

The maths is simple and has no singularities. ECI → ECEF is one rotation
matrix per timestamp, and composing rotations with matrices or quaternions never
blows up. Your trouble almost certainly came from **conventions**, not maths:
wrong order, a missing transpose, an extra conversion, or quaternion sign flips.
Those give "crazy rotations" that look like hard maths but are bookkeeping.

## Why there are no singularities

A rotation matrix is orthonormal: its inverse is just its transpose, always
defined. Quaternion multiply and conjugate are defined for every unit quaternion.
Singularities (gimbal lock) only appear with **Euler angles** (roll/pitch/yaw),
which neither Lucas nor the fork uses. So `q_B_ECEF = conj(q_ECI_ECEF) · q_B_ECI`
is safe for every input. Upstream's only fragile point is `computeFixedToIcrfMatrix`
returning `undefined` before its data loads (the `!` in his code).

## Was it a double conversion?

Partly, yes, and it's documented. In April, doc `54-…` "fixed" GS pointing by
building the attitude in ECEF and then converting it to ICRF (`R_icrf = M_fixedToIcrf · R_ecef`).
Cesium reads ECEF, so that conversion was one too many. It makes the attitude
drift at Earth's rotation rate (15°/hour). The final code dropped that step. Doubling
inside the parser is unlikely: the fork's parser has no conversion at all. The
pre-April history is gone, so that part can't be proven.

## The conventions that actually bite

1. **Order:** `A·B` ≠ `B·A`. Swapping them rotates around the wrong frame.
2. **Direction:** body→ECI vs ECI→body. These are conjugates, and mixing them inverts the attitude.
3. **Matrix layout:** Cesium's `new Matrix3(...)` takes numbers row by row (your April bug).
4. **Scalar position:** Cesium is `(x, y, z, w)`. Many tools send `w` first.
5. **Active vs passive:** some sources (e.g. STK, CCSDS AEM) document rotations the other way round.

Any one of these produces plausible-looking but wrong motion.

## Quaternion sign flips — the hidden one

`q` and `-q` are the same rotation. If consecutive samples flip sign (common
in exported data), interpolating between them can take the long way round:
a 360° spin between two samples that should be nearly identical. Cheap fix in the
adapter: if `dot(q_i, q_{i-1}) < 0`, negate `q_i`, and normalise every sample.
Worth a unit test regardless of frame choice.

## "ECI" is not one frame

J2000/EME2000, GCRF/ICRF, TOD and TEME (SGP4/TLE output) all get called ECI.
They differ by up to ~0.4° (mostly precession since 2000). For the 3D view that's
invisible, but on the zoomed celestial map it's noticeable. A hand-rolled "rotate
about Z by sidereal angle" adds similar error. So: use Cesium's
`Transforms.computeIcrfToFixedMatrix` (full precession/nutation) and document
that ECI input means ICRF/GCRF.

## Your instinct: ECEF-only frontend?

Right for **your** backend: the digital twin should send ECEF and set the
attitude-frame option to ECEF. Converting where the data is produced, with a proper
astro library, is cleaner. Wrong for **upstream** as the only option: Lucas's
dashboards already send ECI, and dropping it would break them. He would rightly
reject that. The adapter option from `05-…` gives both.

## Policy for the upstream code

- The conversion lives in exactly one function in the adapter layer, using Cesium's
  transform, never hand-rolled.
- Option `attitudeFrame`: `ECI` (default, Lucas's behaviour) or `ECEF` (no conversion).
- Everything after the adapter is body→ECEF. Renderers never convert.
- If Cesium's transform isn't ready, skip that sample with a warning instead of using `!`.
- Sign-continuity and normalisation for every quaternion sample.

## Tests that pin it (so AI mistakes get caught)

1. Identity body→ECI at a known time: body X must equal the ICRF X axis
   expressed in ECEF (cross-check with `computeIcrfToFixedMatrix`).
2. ECI ↔ ECEF round trip returns the input within 1e-12.
3. `attitudeFrame = ECEF` passes the quaternion through unchanged.
4. A sign-flipped sequence is made continuous.
5. One sample one hour later rotates by ~15° about Z.

These five tests are the safety net. If they pass, the frame bookkeeping is right.
