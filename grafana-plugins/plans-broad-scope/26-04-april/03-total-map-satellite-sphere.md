# Total Map — Satellite 360° Sphere Projection Plan

## What Exists Right Now

The `total-map` sub-view under Celestial Map mode (`selectedMode === 'celestial' && celestialCameraView === 'total-map'`) is a black rectangle overlay (`position: absolute, inset: 0, zIndex: 9`) containing an SVG that was copied from the Ground Station POV polar chart. It has circular elevation rings, azimuth radials, and cardinal labels — all geometry specific to the polar projection. This code is a temporary scaffold to be morphed, not kept.

The Ground Station POV uses **azimuth/elevation from a ground point**, mapping elevation 90°→0° outward from the circle center. The Total Map needs a fundamentally different projection and a different observer: the **selected satellite**, not a ground station.

## Target: Equirectangular Sphere Map

The full sphere around the satellite is "unrolled" into a 2:1 rectangle:
- **X axis**: azimuth 0°→360° (left to right), wraps at ±180°
- **Y axis**: elevation +90° (zenith/top) → −90° (nadir/bottom)

Reference frame: **LVLH** (nadir = −90°, zenith = +90°, orbit velocity direction = azimuth 0°). This makes FOV cones, Earth limb, and nadir direction all intuitive. The Earth disc fills the nadir region, space fills the zenith region.

Projection formula for any direction unit vector from satellite → target:

```
(az, el) → svgX = (az + 180) / 360 * viewWidth
           svgY = (90 - el) / 180 * viewHeight
```

The SVG `viewBox` changes from `"0 0 100 100"` to `"0 0 200 100"` (2:1).

## Morph Strategy — Safe Incremental Steps

**Step 1 — Add the Sun point (DO NOT remove anything yet)**
- Compute Sun direction in ECEF at `gsPovClockTime` using Cesium's `Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame`
- Convert to LVLH frame relative to the tracked satellite's position and velocity
- Project to `(az, el)` → `(svgX, svgY)`
- Render as a yellow circle with label inside the existing SVG (it will overlap the polar rings — that is expected and acceptable for now)
- Verify it moves with time and ends up roughly at the correct quadrant

**Step 2 — Only after Sun renders correctly: replace the grid**
- Delete the circular rings, azimuth radials, and cardinal text
- Add a rectangular graticule: horizontal lines at −60°, −30°, 0°, +30°, +60° elevation; vertical lines every 45° azimuth
- Add horizon line (el = 0°) prominently as a thicker stroke
- Update `viewBox` to `"0 0 200 100"`

**Step 3 — Add more point types**
- Earth limb circle projected as an arc (nadir region)
- Ground stations visible from satellite (line-of-sight check → dot)
- Other satellites (relative direction → dot with orbit track)

**Step 4 — Area fills (deferred)**
- FOV cone footprint on the map = a closed polygon of projected cone-rim direction vectors
- Handling wrap-around (polygon crossing the ±180° seam) requires splitting the path at the seam before rendering — this is the main complexity; plan separately

## Key Isolation Rule

Every step adds new SVG elements independently. Old elements stay visible until the new ones are verified. Nothing is deleted until the replacement renders correctly for at least one real data point.
