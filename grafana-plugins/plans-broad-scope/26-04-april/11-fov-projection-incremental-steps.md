# FOV Projection — 3 Incremental Steps

## Why 3 Steps Work Here

Winding order errors are **not uncorrectable** — they are visually obvious (fill appears outside the cone instead of inside) and fixed by reversing the ring array. Doing the first two steps without fill means winding is irrelevant and cannot silently poison the work. The geometry is validated before fill is added. This is the safe order.

---

## Step 1 — Ring Projection, No Seam Handling, Stroke Only (1/10)

For each sensor of the tracked satellite: sample `position` and `orientation` at `overlayClockTime`, call `computeFOVCelestialProjection` to get N Cartesian3 ring points, convert each to az/el via `computeAzEl(satPos, ringPoint)`, map to SVG coordinates `(x = az, y = 90 - el)`, serialise as a single `M x0 y0 L x1 y1 ... Z` path with `stroke` color and `fill="none"`.

No seam logic. Expect ugly straight lines cutting across the map when the cone crosses az=0/360. That is correct and expected at this stage.

**Verify:** ring appears roughly at the right location, moves with time, has the right angular size.

---

## Step 2 — Seam-Cut Function, Still Stroke Only (3/10)

Implement the pure seam-cut utility: detect left-right crossings (`|Δaz| > 180`), detect pole crossings (`both el near ±90° AND |Δaz| > 90`), interpolate edge points, split into fragment arrays, serialise all fragments as concatenated `M...Z M...Z` subpaths. Still `fill="none"`, stroke only.

The ugly crossing lines from Step 1 disappear. Fragments that cross the seam appear as two separate arcs on opposite edges of the map.

**Verify:** no spurious cross-map lines, fragments meet the map edges cleanly, pole-crossing cones split at the top or bottom border.

---

## Step 3 — Fill, Winding Normalisation, Border-Following (2/10)

Add fill with low opacity. Normalise winding to clockwise before the seam cut (reverse the ring if its signed 2D area in map coordinates is positive — SVG non-zero rule fills clockwise rings). Add signed-area check on each fragment after cutting: negative area → pole-enclosing → inject border waypoints. 

**Verify:** fill appears inside the cone, not outside. Pole-enclosing fragment fills the large region including the map edge. Seam-crossing cone shows two filled islands with no gap or overlap at the seam.

---

## Higher-Order Note

The seam-cut function is the single shared dependency between steps 2 and 3. Step 2 validates it geometrically (stroke) before step 3 trusts it topologically (fill). If step 2 looks wrong, fix it before moving to step 3 — the fill will be impossible to reason about on top of broken geometry.

Difficulty per step: **1 / 3 / 2** out of 10. Step 2 is the load-bearing one.
