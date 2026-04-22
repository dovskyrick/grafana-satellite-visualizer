# 18 — 2D Scene Mode Crash Fix

## Problem

Switching the Cesium viewer to **2D map mode** (via the built-in scene mode picker) caused a
hard render-loop crash within one to two seconds of the transition. The browser console showed:

```
DeveloperError: normalized result is not a number
  Cartesian3.normalize
  Ellipsoid.geodeticSurfaceNormal
  Ellipsoid.cartesianToCartographic
  SceneTransforms.computeActualWgs84Position
  Billboard._computeActualPosition
  recomputeActualPositions (BillboardCollection)
  updateMode (BillboardCollection)
  LabelCollection.update
  EntityCluster.update
  ...
  render (CesiumWidget)
```

Once the crash fired, Cesium displayed its red error panel and stopped rendering entirely.
Secondary errors (`can't access property "scene", _cesiumWidget is undefined`) followed as
mouse-move handlers tried to call `viewer.scene.pick()` on a destroyed widget.

The 1–2 second delay matched the length of the 3D → 2D morph animation exactly: the crash
happened at the moment the animation completed and Cesium called `updateMode()` on every
`BillboardCollection` / `LabelCollection` in the scene.

## Root Causes (three, in order of discovery)

### 1 — Earth Center entity at `Cartesian3.ZERO`

`CelestialBodiesRenderer` placed an "Earth Center" marker at the literal zero vector `(0, 0, 0)`.
`cartesianToCartographic` must normalise that vector to compute the geodetic surface normal.
Normalising a zero-length vector produces `NaN` → crash.

Additionally, `CelestialBodiesRenderer` was rendered unconditionally, so it was active even in
satellite / earth / groundstation modes where it serves no purpose.

### 2 — `scene.pick()` in the hover handler triggered the same render pass in 2D

After the initial guard was added for `CelestialBodiesRenderer`, the crash continued via a
different path. The mouse-move handler called `viewer.scene.pick(movement.endPosition)`, which
internally performs a pick-render pass. In 2D mode that pass traverses every billboard and hits
the same normalisation failure. This caused the crash on every mouse movement.

### 3 — `getScaledLength` returns `NaN` in 2D / Columbus View mode

`getScaledLength` computed axis-vector and sensor-cone scale using `camera.frustum.sseDenominator`.
`PerspectiveFrustum` (used in 3D) exposes this property; `OrthographicFrustum` (used in 2D) **does
not**. During the mode transition the frustum object switches, `sseDenominator` becomes `undefined`,
and the function returned `NaN`.

That `NaN` was stored in `vectorScaleRef.current`. On the next frame the label-position
`CallbackProperty` computed `satellitePos + axisDirection × NaN = (NaN, NaN, NaN)` and passed
it to Cesium as the entity position. `cartesianToCartographic((NaN, NaN, NaN))` → `normalize`
→ crash. Two callbacks were also falling back to `Cartesian3.ZERO` (the zero vector) when
position or orientation data was temporarily unavailable, producing the same failure through a
different route.

## Fixes Applied

| File | Change |
|------|--------|
| `SatelliteVisualizer.tsx` | Gate `CelestialBodiesRenderer` on `selectedMode === 'celestial'` — these entities (Sun on celestial sphere, Earth centre) only belong in that view |
| `CesiumEntityRenderers.tsx` | Replace `Cartesian3.ZERO` fallback in two `CallbackProperty` position callbacks with `undefined`, which Cesium handles as "no position at this time" |
| `SatelliteVisualizer.tsx` | Guard `viewer.scene.pick()` in the hover handler: skip if `viewer.scene.mode !== SceneMode.SCENE3D` |
| `cameraScaling.ts` | `getScaledLength` now checks that `sseDenominator` is defined and finite before using it; falls back to an orthographic-width–based estimate in 2D / Columbus mode so the return value is always a finite number |
| `CesiumEntityRenderers.tsx` — axis label callback | Added `!isFinite(vectorLength)` guard and a NaN check on `endPos` before returning, so a stale NaN in the ref can never reach Cesium |
| `CesiumEntityRenderers.tsx` — celestial FOV label callback | Replaced `Cartesian3.normalize()` (throws on zero/NaN input) with a manual magnitude check that returns `undefined` for degenerate cases |

## Key Principle

Any `CallbackProperty` that drives a `LabelGraphics` or `PointGraphics` position **must never
return `Cartesian3.ZERO` or a vector with NaN components**. Cesium calls
`cartesianToCartographic` on every such position when the scene mode changes, and
`cartesianToCartographic` normalises the input vector. Returning `undefined` from the callback
is the correct Cesium idiom for "no data at this time" and is handled silently.
