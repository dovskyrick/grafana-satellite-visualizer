# FOV Projection — Code Architecture Plan

## Guiding Principle

Separate pure geometry from React rendering from the start. The geometry never touches React. React never reimplements geometry. A future refactor that extracts the Total Map SVG into its own component will be a prop-threading exercise, not a logic rewrite.

---

## New File: `utils/totalMapProjection.ts`

Created immediately, before any JSX is written. Contains three pure functions with no imports from React, Cesium viewer, or component state.

**`ringToAzEl(satPos, ringPoints)`**
Takes the satellite ECEF position and the array of N `Cartesian3` ring points from `computeFOVCelestialProjection`. Returns an array of `{ az: number, el: number }` by calling `computeAzEl(satPos, point)` for each. This is the only bridge between the existing Cesium geometry utilities and the new map projection code.

**`seamCutPath(points)`**
Takes the az/el array. Detects left-right seam crossings (`|Δaz| > 180`) and pole crossings (`both el near ±90° AND |Δaz| > 90`). Interpolates edge points at each crossing. Returns an array of fragment arrays — each fragment is a `{ az, el }[]` subpath. In Step 2 this function produces fragments only. In Step 3 it also injects the border-following waypoints for pole-enclosing fragments (this is the only conditional added at Step 3).

**`fragmentsToSvgPath(fragments)`**
Takes the fragment arrays. Converts each fragment to `M x0 y0 L x1 y1 ... Z` using `x = az, y = 90 - el`. Concatenates all fragment strings into a single `d` attribute value. Returns a string.

These three functions are pure, composable, and independently testable. The pipeline is: `ringToAzEl → seamCutPath → fragmentsToSvgPath → d string`.

---

## In `SatelliteVisualizer.tsx` — Stays Inline for Now

An IIFE block inside the Total Map SVG, after the Sun block, renders one `<path>` per sensor of the tracked satellite:

```
for each sensor:
  sample satPos and satOrientation at overlayClockTime
  call computeFOVCelestialProjection → ring Cartesian3[]
  call ringToAzEl → az/el[]
  call seamCutPath → fragments[][]
  call fragmentsToSvgPath → d string
  render <path d={d} stroke={color} fill="none" />
```

This block depends on `overlayClockTime`, `satellites`, `trackedSatelliteId`, `sensors`, and sensor color helpers — the same state already present in the Total Map block. No new state, no new props.

---

## Future Refactor Boundary (Not Now)

When the Total Map SVG accumulates 3–4 independent elements (Sun, FOV cones, ground stations, Earth disk), the entire SVG content moves into a `TotalMapOverlay` React component in `components/overlays/TotalMapOverlay.tsx`. It receives `overlayClockTime`, `satellites`, `trackedSatelliteId`, and `groundStations` as props. The utility functions in `totalMapProjection.ts` are unchanged. The IIFE blocks become the body of the component. This refactor is mechanical and takes under 30 minutes.

---

## Summary Table

| What | Where | When |
|---|---|---|
| `ringToAzEl`, `seamCutPath`, `fragmentsToSvgPath` | `utils/totalMapProjection.ts` | From the start |
| FOV rendering IIFE loop | `SatelliteVisualizer.tsx` inline | From the start |
| `TotalMapOverlay` component | `components/overlays/` | When 3–4 SVG elements exist |
