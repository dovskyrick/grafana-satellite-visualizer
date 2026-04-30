# Earth Focus Zoom Cap — Debug Ideas

**Status**: `maximumZoomDistance` appears to be completely ignored in Earth Focus mode.
Even setting it to `earthRadius * 0.5` (inside Earth itself) produces no resistance when zooming out.

---

## Why It Might Not Apply at All

### 1. Free Camera vs. Orbit Camera Controller
Cesium has two internal camera modes. When an entity is **tracked**, the `ScreenSpaceCameraController` operates in a "tethered orbit" mode relative to the tracked entity. The `maximumZoomDistance` property governs the distance from the tracked entity to the camera in this mode. When tracking is **disabled**, the controller switches to a flat free-fly mode. In free-fly mode, `maximumZoomDistance` might simply not be enforced — the property exists, is writable, but the free-fly orbit path does not check it against the same logic. This is a known quirk in Cesium that is not clearly documented.

### 2. The `enableCollisionDetection` Interaction
Cesium's `ScreenSpaceCameraController.enableCollisionDetection` prevents the camera from going underground. This might be the only enforced distance constraint in free mode. Without tracking, the outward cap may be intentionally absent — Cesium assumes free camera mode is for power users who want no limits.

### 3. `minimumZoomDistance` vs. `maximumZoomDistance` Semantics
There is a chance the semantics differ in free mode. In tracking mode, zoom distance is measured camera-to-entity. In free mode, it may measure something else entirely — like camera-to-terrain intersection — making `earthRadius * 0.5` have no meaningful surface reference and therefore no clamp.

---

## Candidate Fixes for Tomorrow

### Option A: `preUpdate` / `preRender` Camera Clamp
Register a Cesium `preRender` listener that checks `viewer.camera.positionCartographic.height` every frame and pulls the camera back if it exceeds a threshold. This is brute-force but 100% reliable regardless of controller mode.

```typescript
viewer.scene.preRender.addEventListener(() => {
  const maxAlt = 6378137 * 4; // ~4x Earth radius from center
  const pos = viewer.camera.position;
  if (Cartesian3.magnitude(pos) > maxAlt) {
    Cartesian3.normalize(pos, pos);
    Cartesian3.multiplyByScalar(pos, maxAlt, viewer.camera.position);
  }
});
```

### Option B: Switch Earth Focus to a Tracked Entity
Keep `isTracked = true` but track a hidden Earth-center entity. Zoom distance in tracked mode is well-behaved. This is hacky but avoids the free-camera problem entirely.

### Option C: Accept It and Move On
Earth Focus is a wide-view mode by design. A generous uncapped zoom out may actually be fine for most demos. Revisit only if a colleague complains.

---

## Today's Summary

Great session — zoom cap is the only loose end. Everything else shipped cleanly. 🛰️
