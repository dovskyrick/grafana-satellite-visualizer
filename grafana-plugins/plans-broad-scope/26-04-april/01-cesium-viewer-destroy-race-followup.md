# Follow-up: Cesium Viewer Destroy Race Condition

## What Was Fixed (14 Apr)

Two-part fix for `TypeError: can't access property "scene", _cesiumWidget is undefined`
that appeared when navigating to/from the Grafana panel edit view (SPA navigation).

### Part 1 — `SatelliteVisualizer.tsx`
Added `isViewerReady` state (default `false`), set to `true` in the `<Viewer>` ref callback
once `cesiumElement` is confirmed present, and cleared to `false` on unmount.
All Resium entity children inside `<Viewer>` are now gated on `{isViewerReady && ...}`.
Prevents entities from mounting before Cesium has finished initializing.

### Part 2 — `CesiumEntityRenderers.tsx`
Both `SensorVisualizationRenderer` and `BodyAxesRenderer` subscribe to
`viewer.scene.postRender` to keep cone/axis scale in sync with camera distance.
Their effect cleanup functions now guard with `viewer.isDestroyed()` before calling
`removeEventListener`, and the `updateScale` callback also bails early if destroyed.
Prevents the crash in the *unmount* direction when Cesium destroys the viewer before
React finishes draining its cleanup queue.

---

## Things Still Worth Testing

1. **Scale regression after rapid navigation** — navigate edit → dashboard → edit several
   times quickly, then zoom in/out and verify sensor cones and body axes still resize
   correctly. A stale `coneScaleRef`/`vectorScaleRef` would show as fixed-size cones
   that never adapt to camera distance.

2. **First-load timing on slow connections** — `isViewerReady` gates on `cesiumElement`
   existing, but some Cesium deferred init (terrain, imagery) happens after that. Test
   with browser network throttling to confirm no Cesium errors appear in the console on
   the very first render after navigation.

3. **Viewer re-creation via `viewerKey` increment** — certain panel option changes force
   a new Viewer via `setViewerKey`. Verify entities reappear correctly after that cycle;
   React 18 batching could theoretically skip the intermediate `isViewerReady=false`
   render, leaving entities in a stale state.

---

## Potential Further Improvement

If issue 3 above is observed, the fix is to call `flushSync` around the
`setIsViewerReady(false)` call in the ref null-path to force a synchronous render before
the new viewer mounts. Low priority unless actually seen in testing.
