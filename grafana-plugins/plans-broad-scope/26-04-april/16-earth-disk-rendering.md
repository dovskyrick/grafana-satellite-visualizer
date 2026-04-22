# Earth Disk Rendering — Implementation Plan

## Singularity Status in Existing Code

The code already contains partial singularity handling. `cutRingAtSeam` detects
`isZenith` and `isNadir` (both consecutive points at el > 85° or < −85° with
|Δaz| > 90°) and splits the ring there, injecting a clean pole-boundary edge.
This correctly handles the case where a cone fully encircles a pole — the
resulting U-shape fragment is geometrically clean.

The remaining artefact — a brief visual glitch when a ring is transitioning
through the pole-adjacent zone and some points have numerically noisy az values
— has no code path addressing it.  It is accepted as a known limitation and
left alone.  For the Earth disk this is relevant: the Earth disk always sits
near the nadir (bottom of the map), and its rim occasionally passes through
the nadir-adjacent zone.  The glitch will be brief and tolerable.

---

## What `generateEarthDiskRing` Needs to Do

The Earth visible disk is a cone whose:

- **Axis** is the nadir direction — the unit vector from the satellite toward
  Earth's centre.  In ECEF this is simply `−normalize(satPos)`, since the
  Earth centre is the origin.

- **Half-angle** (angular radius of the visible disk) is derived analytically:

  ```
  halfAngle = arcsin(R_earth / |satPos|)
  ```

  `R_earth` can be taken as `Ellipsoid.WGS84.maximumRadius` (≈ 6 378 137 m).
  For a 500 km LEO orbit this gives ≈ 67.6°.  For a GEO orbit at 35 786 km
  it shrinks to ≈ 8.7°.  It is always strictly less than 90° (the satellite
  would have to be on the surface for it to reach 90°), so the disk never
  exceeds a hemisphere — the full-pipeline handling already in place is
  sufficient for every real orbit.

- **Ring generation loop** is identical to `generateFOVRing` once the axis
  and half-angle are known.  Build the two perpendicular vectors `perp1` /
  `perp2` from the nadir axis using the same cross-product fallback already
  written, then iterate N angles and call `ecefDirToAzEl`.  No quaternion,
  no sensor body frame.

## What Is Reused Without Changes

Everything downstream is unchanged: `normalizeWinding` → `cutRingAtSeam` →
`injectPoleCorners` → `fragmentsToSvgPath` handles the nadir case correctly
already.  The Earth disk will nearly always span the full azimuth range and
trigger the nadir corner injection (bottom-left and bottom-right corners),
filling the lower portion of the map.

## New Code Required

1. **`generateEarthDiskRing(satPos, N = 64)`** in `totalMapProjection.ts`
   (~20 lines, same loop as `generateFOVRing` but with analytic axis and
   half-angle instead of quaternion composition).  Export it alongside the
   existing functions.  Use N = 64 for a smoother arc since the disk is large.

2. **JSX block** in `SatelliteVisualizer.tsx` inside the Total Map SVG,
   after the sensor FOV block.  Read `satPos` at `overlayClockTime`, call
   `generateEarthDiskRing`, pass result to `filledRingToSvgPath`, render as a
   `<path>` with semi-transparent blue fill (`#4488FF`, `fillOpacity={0.12}`)
   and a thin blue stroke.

## Implementation Order

1. Add `generateEarthDiskRing` to `totalMapProjection.ts`.
2. Add the JSX block in `SatelliteVisualizer.tsx` (one IIFE block, ~15 lines).
3. No other files need changes.

Difficulty: **1 / 10**.
