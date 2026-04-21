# FOV Area Projection — Final Considerations & Full Problem Statement

## What Is Already Done

`computeFOVCelestialProjection` in `utils/projections.ts` already produces N `Cartesian3` ring points on the celestial sphere for any sensor. `computeAzEl(satPos, ringPoint)` already converts a single ECEF point to az/el from the satellite. The Sun proof-of-concept confirms the equirectangular SVG pipeline works end-to-end.

## What Is Not Yet Established

**Winding order.** SVG's non-zero fill rule fills the interior of a clockwise ring and the exterior of a counter-clockwise one. The ring from `computeFOVCelestialProjection` has a winding direction that depends on the sensor orientation. The seam-cut function must normalise to a consistent winding before fragmenting, or the fill will invert randomly.

**Signed-area pole detection.** The concrete formula for deciding whether a fragment is pole-enclosing has not been written in code. The sign of the 2D shoelace area of the fragment in map coordinates is the check — negative area after splitting means the fragment wraps the pole.

**`overlayClockTime` gating for orientation.** The satellite's `orientation` property at the current tick must be sampled (same pattern as `position.getValue(overlayClockTime)`) to feed into the ring computation. This hasn't been wired up in the Total Map block yet.

**Sensor color mapping.** `SENSOR_COLORS` exists in `utils/sensorCone.ts`. It needs to be read in the Total Map SVG block and applied as `fill` with low opacity to each sensor's `<path>`.

## Full Problem in One Paragraph

For each visible sensor at each clock tick: sample satellite position and orientation, call `computeFOVCelestialProjection` to get N ring points, convert each to az/el via `computeAzEl`, detect left-right seam crossings (`|Δaz| > 180`) and top-bottom pole crossings (`both el near ±90° AND |Δaz| > 90`), split into fragments at each crossing with interpolated edge points, check signed area of each fragment to detect pole-enclosing cases and inject border-following waypoints where needed, serialise all fragments into a single SVG `d` string of concatenated `M...Z` subpaths, render as one `<path>` per sensor with colour and low opacity fill.

## Difficulty Level

**Medium-Hard — 6 / 10.**

The per-tick pipeline (sample → convert → render) is straightforward. The seam-cut function is the hard part: signed-area check, interpolation at two different edge types, and border-following closure are all correct but require careful index arithmetic and edge-case handling (ring entirely on one side, ring entirely pole-enclosing, ring with multiple crossings). Estimated implementation: one focused session of 3–4 hours for a robust version covering sensor FOVs. Earth disk extension adds another session for the large-disk pole-enclosing path.
