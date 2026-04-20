# Total Map — Sun Point Implementation Plan

## Decision: Keep the Polar Circle, Add Sun Inside It

The simplest safe path is to add the Sun dot **inside the existing polar SVG circle** (the one already in the Total Map overlay). The circle already covers the full `viewBox="0 0 100 100"`, has a known center `(50, 50)` and horizon radius `R_HORIZON = 40`. For this first step, we treat the circle as an all-sky map where the center is zenith and the edge is nadir — effectively a polar stereographic projection centered on zenith — and project the Sun into it. Once it works, the full equirectangular rectangle is a later step (described at the end).

---

## Step 1 — Sun Direction in LVLH Frame

We already use `Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time)` in `CesiumEntityRenderers.tsx`. The same call gives us the Sun direction in ICRF. We need it in LVLH relative to the tracked satellite.

At `gsPovClockTime` (the clock time already threaded into the Total Map block):

```
sunECI  = Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time)
icrfToFixed = Transforms.computeIcrfToFixedMatrix(time)   // may be null
sunECEF = icrfToFixed ? Matrix3.multiplyByVector(icrfToFixed, sunECI) : sunECI
sunDir  = normalize(sunECEF - satPos)   // direction from satellite to Sun
```

LVLH axes (mirrors the existing `computeLVLHOrientation` logic in SatelliteVisualizer):

```
zAxis = normalize(-satPos)          // nadir (toward Earth)
yAxis = normalize(velocity)         // along-track
xAxis = normalize(cross(yAxis, zAxis))  // cross-track
zenith = -zAxis                     // away from Earth
```

Velocity is approximated by finite difference from the satellite's `SampledPositionProperty` at `t` and `t + 1s`.

---

## Step 2 — Earth Occlusion Check

The Earth blocks the Sun when the angular separation between the Sun direction and the nadir direction is smaller than the angular radius of the Earth as seen from the satellite:

```
angEarth = asin(R_earth / |satPos|)     // half-angle of Earth disc
nadirDir = -zenith = zAxis
angToNadir = acos(dot(sunDir, nadirDir))
sunVisible = angToNadir > angEarth
```

`R_earth = 6_371_000` m (mean radius; fine for occlusion, no need for WGS84 ellipsoid here). If `sunVisible === false`, render nothing — skip the element entirely with an early return.

---

## Step 3 — Polar Stereographic Projection (inside the existing circle)

Map the Sun direction to polar coordinates centred on zenith:

```
el  = asin(dot(sunDir, zenith))         // +90° = zenith, −90° = nadir
az  = atan2(dot(sunDir, xAxis), dot(sunDir, yAxis))  // 0° = along-track

// Zenith at centre, nadir at rim (R_HORIZON = 40 SVG units)
r   = R_HORIZON * (90° − el) / 180°    // 0 at zenith, 40 at nadir

svgX = 50 + r * sin(az)
svgY = 50 − r * cos(az)
```

Render as a `<circle cx={svgX} cy={svgY} r="1.5" fill="yellow" />` plus a small `<text>` label "☉".

---

## Step 4 — Responsive SVG (no work needed for polar mode)

The polar overlay already uses `width="100%" height="100%"` with `viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"`. The SVG scales uniformly regardless of panel size, so the Sun dot coordinates need no adjustment.

**Future rectangle view note:** When we eventually switch to the equirectangular rectangle (`viewBox="0 0 200 100"`), we keep `preserveAspectRatio="xMidYMid meet"`. The parent `<div>` is already `background: #000`, so any letter-box bars are invisible. Point coordinates scale automatically with the viewBox — no JS resize listeners needed.

---

## What To Touch

Only the Total Map JSX block inside `SatelliteVisualizer.tsx` (`selectedMode === 'celestial' && celestialCameraView === 'total-map'`). No new files, no changes to existing renderers. The Sun SVG element is a self-contained `{(() => { ... })()}` block appended after the existing orbit-track and satellite-dot blocks.
