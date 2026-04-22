# North-Pole Singularity Smoothing — Transition-Zone Artefact

## What Is Happening

When a FOV ring is transitioning from two disconnected left/right fragments into a
single full-width fragment (cone axis approaching the zenith), some ring points reach
very high elevation — `el ≈ 88°–90°`. At those near-pole directions the unit vector
pointing nearly straight up has east and north components that are both close to zero,
so `atan2(e, n)` amplifies floating-point noise into a wildly unpredictable azimuth.
The point is geometrically almost at the zenith but its mapped x-coordinate can land
anywhere from 0° to 360° at random. The result is a spray of short jagged strokes
across the very top of the map exactly in the frames where the ring shape is otherwise
smooth.

## Why It Only Hurts During the Transition

Before the transition: both disconnected fragments stay well below `el ≈ 85°` and
azimuths are stable. After full merging with corners injected: the noisy points sit
so close to `y = 0` that the corners cover them. The problem is the brief window
where `spansFullWidth` is true (corners are being injected) but one or more ring points
still carry a numerically random azimuth right next to the top border.

## The Proposed Fix — Pole-Point Collapse

Inside `injectPoleCorners`, after confirming `spansFullWidth`, scan the fragment for
points whose elevation exceeds a threshold (e.g. `el > 88°`). These are the
singularity-contaminated points. Instead of plotting them individually, remove them
from the point list and replace the entire "pole cluster" with a single representative
point at `el = 90°` and the median azimuth of their non-contaminated neighbours.
Because the corners `(360, 90)` and `(0, 90)` are injected right after, this single
representative point merges cleanly into the top edge with no discontinuity.

## Difficulty

**2 / 10.** The hook point already exists inside `injectPoleCorners`, just before the
corner append. No changes to `cutRingAtSeam`, `normalizeWinding`, or the JSX are
needed. It is a handful of array filter/replace lines on an already-identified fragment.
