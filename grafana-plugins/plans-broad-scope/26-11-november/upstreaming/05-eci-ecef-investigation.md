# 05 — Why the fork handles the attitude quaternion differently from Lucas

Investigated 2026-11-06 from fork docs, fork code and Cesium 1.140 source.

## Short answer

Lucas expects the quaternion as **body → ECI** and converts it to body → ECEF
before giving it to Cesium. The fork passes it straight to Cesium, so its data
is effectively **body → ECEF**. No fork doc records a decision to change this.
The conversion seems to have quietly disappeared when the parser was rewritten
for multiple satellites (Dec 2025, docs `21-…` and `16-…`).

## What Cesium actually expects

Cesium's source (`Entity.js`) says entity orientation is "in respect to
Earth-fixed-Earth-centered (ECEF)". So whatever you give `orientation` is read
as body → ECEF. Lucas's code respects this: `q_B_ECEF = conj(q_ECI_ECEF) · q_B_ECI`,
using `computeFixedToIcrfMatrix`. The maths checks out. That conversion is the
only reason upstream can accept inertial attitude, which is what most flight
software and attitude determination outputs.

## Why the fork never noticed

The test data generator wrote identity quaternions ("for now, identity
quaternion", doc `25-12-december/22-…`). An identity attitude looks fine in
either frame, so dropping the conversion caused no visible bug. Meanwhile the
fork's own `src/README.md` still says "Orientation in inertial frame", left over
from Lucas's README. That line now contradicts the fork's code.

## The April detour (stale docs)

Docs `26-04-april/53-…`, `54-…` and `61-…` say Cesium was "empirically
confirmed" to read orientation as ICRF, based on a spin test. That test was
weak: 3 full spins over a few hours would hide Earth's rotation. Doc 54 then found
the real bug was the `Matrix3` constructor taking row-major arguments. The final code
(`SatelliteVisualizer.tsx:1046–1056`) says body → ECEF. **Treat 53, 54 and 61 as
deprecated.**

## Inconsistencies still inside the fork

The fork's ICRF-axes feature (`computeICRFOrientation`) and ITRF-axes fix
(`26-03-march/03-…`) both assume orientation is ECEF, which is right. Scenario 3/5
GS pointing and scenario 4 Sun pointing build body → ECEF in the final code, also
right. Only the docs and the fork README disagree. So the fork's *code* is consistent:
its data contract is ECEF, just never written down.

## Decision for upstreaming

Keep Lucas's behaviour as the default: quaternion is body → ECI, converted
in the parser. If ECEF input is wanted (the fork's scenarios), add an explicit
panel option `Attitude frame: Inertial (ECI) | Earth-fixed (ECEF)`, default ECI.
Inside the plugin everything is body → ECEF after parsing, so renderers (body
axes, cones, footprints) never need to think about frames.

## Impact on PR 1 (body axes)

None, as long as body axes read the entity's orientation *after* parsing. Add a
unit test that feeds an ECI quaternion at a known time and checks the rendered
X axis against a hand-computed ECEF direction. That test pins the convention
for every future PR and would have caught the fork's silent change.
