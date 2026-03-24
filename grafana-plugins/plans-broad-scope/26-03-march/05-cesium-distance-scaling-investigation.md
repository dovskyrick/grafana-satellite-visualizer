# Cesium Distance-Based Scaling — Source Investigation

> **Purpose:** Understand how Cesium computes size-with-distance scaling under the hood,
> so we can replicate the same mathematics for our custom sensor cones and axis arrows.
>
> **Cesium version in project:** 1.112.0
> **Source location:** `grafana-plugins/3d-orbit-attitude-plugin/node_modules/cesium/Build/CesiumUnminified/Cesium.js`

---

## 1. Three Distinct Scaling Systems in Cesium

Cesium has **three separate mechanisms** for keeping objects visible as the camera zooms out.
Each targets a different primitive type:

| Mechanism | Primitive type | Runs on | Source |
|---|---|---|---|
| `NearFarScalar` via `scaleByDistance` | Billboards, Labels, Points | **GPU** (vertex shader) | `czm_nearFarScalar` GLSL |
| `minimumPixelSize` | 3D Models (glTF/glb) | **CPU** per-frame | `updateComputedScale()` |
| `czm_metersPerPixel` | General shader usage | **GPU** | Built-in GLSL uniform |

Our custom geometry (sensor cones, axis arrows built from `PolylineGraphics` / custom primitives)
does **not** go through any of these paths natively — hence the need for our own replication.

---

## 2. The `NearFarScalar` / `scaleByDistance` Path (Billboards)

### 2a. The Data Structure

```js
// packages/engine/Source/Core/NearFarScalar.js  (line 14924 in bundle)
function NearFarScalar(near, nearValue, far, farValue) {
  this.near      = near;      // distance (metres) at which nearValue applies
  this.nearValue = nearValue; // scale multiplier at near distance
  this.far       = far;       // distance (metres) at which farValue applies
  this.farValue  = farValue;  // scale multiplier at far distance
}
```

### 2b. The GLSL Shader Formula

The actual interpolation runs on the GPU inside the billboard vertex shader
(`czm_nearFarScalar`, line 38718 in bundle):

```glsl
float czm_nearFarScalar(vec4 nearFarScalar, float cameraDistSq)
{
    float valueAtMin    = nearFarScalar.y;              // nearValue
    float valueAtMax    = nearFarScalar.w;              // farValue
    float nearDistanceSq = nearFarScalar.x * nearFarScalar.x;
    float farDistanceSq  = nearFarScalar.z * nearFarScalar.z;

    float t = (cameraDistSq - nearDistanceSq) / (farDistanceSq - nearDistanceSq);

    t = pow(clamp(t, 0.0, 1.0), 0.2);   // ← non-linear ease curve

    return mix(valueAtMin, valueAtMax, t);
}
```

**Key observations:**

- Uses **squared distances** throughout — avoids a `sqrt()` on the GPU.
- The `pow(..., 0.2)` exponent shapes the curve: value rises quickly at first and then flattens.
  At t=0.25 in linear-distance space the scalar is already ~0.72 of its full range.
  This biases heavily toward the `nearValue` and keeps objects large over a wider distance band.
- Values are **clamped** — no extrapolation beyond `near` or `far`.
- In the billboard vertex shader this `distanceScale` directly multiplies both `scale` and the
  billboard's `translate` offset:
  ```glsl
  float distanceScale = czm_nearFarScalar(scaleByDistance, lengthSq);
  scale     *= distanceScale;
  translate *= distanceScale;
  ```

### 2c. JavaScript-side equivalent

There is **no public JS function** that evaluates `NearFarScalar` — the interpolation only
happens inside the GPU shader. The JS side just packs the four floats into a vertex attribute;
the GPU does the math.

---

## 3. The `minimumPixelSize` Path (3D Models)

This is the most instructive mechanism because it works entirely in JavaScript and is computed
every frame — making it directly replicable for our custom geometry.

### 3a. Call chain

```
Model.update(frameState)
  └─ updateComputedScale(model, modelMatrix, frameState)     // line 98587
       └─ scaleInPixels(positionWC, radius, frameState)      // line 98742
            └─ camera.getPixelSize(boundingSphere, w, h)     // line 202553
                 └─ camera.distanceToBoundingSphere(bs)      // line 202536
                 └─ frustum.getPixelDimensions(w, h, dist, pixelRatio, result) // line 180308
```

### 3b. `updateComputedScale` — the core logic

```js
// line 98587 (simplified)
function updateComputedScale(model, modelMatrix, frameState) {
  let scale = model.scale;

  if (model.minimumPixelSize !== 0) {
    const radius          = model._boundingSphere.radius;
    const metersPerPixel  = scaleInPixels(positionWC, radius, frameState);
    const pixelsPerMeter  = 1 / metersPerPixel;
    const diameterInPixels = pixelsPerMeter * (2 * radius);

    if (diameterInPixels < model.minimumPixelSize) {
      // Solve for scale such that diameter == minimumPixelSize pixels:
      scale = model.minimumPixelSize * metersPerPixel / (2 * model._initialRadius);
    }
  }

  model._computedScale = Math.min(model.maximumScale ?? Infinity, scale);
}
```

The **key formula** to enforce a minimum pixel diameter `P` is:

```
worldDiameter = P × metersPerPixel
scale         = worldDiameter / (2 × initialRadius)
             = P × metersPerPixel / (2 × initialRadius)
```

### 3c. `camera.distanceToBoundingSphere` — projected distance, not Euclidean

```js
// line 202536
Camera.prototype.distanceToBoundingSphere = function(boundingSphere) {
  const toCenter = positionWC - boundingSphere.center;          // vector camera→center
  const proj     = dot(toCenter, camera.directionWC);           // project onto view axis
  return Math.max(0, magnitude(proj) - boundingSphere.radius);  // subtract object radius
};
```

This is **not** a simple `Cartesian3.distance(camera, center)`. It projects the camera-to-center
vector onto the camera's **view direction**, then subtracts the bounding sphere radius. This gives
the distance to the **nearest visible surface** along the viewing axis, not the raw
camera-to-center distance. For objects directly in front of the camera both are nearly equal,
but for off-axis objects or when the camera is inside/very close to the object they diverge.

---

## 4. The Core Math — `metersPerPixel` from the Frustum

### 4a. `frustum.getPixelDimensions` (PerspectiveFrustum)

```js
// line 180063 (PerspectiveOffCenterFrustum — what PerspectiveFrustum delegates to)
const inverseNear = 1 / this.near;

const tanThetaY  = this.top   * inverseNear;  // = tan(fovY / 2)
const pixelHeight = 2 * pixelRatio * distance * tanThetaY / drawingBufferHeight;

const tanThetaX  = this.right * inverseNear;  // = tan(fovX / 2)
const pixelWidth  = 2 * pixelRatio * distance * tanThetaX / drawingBufferWidth;

return Math.max(pixelWidth, pixelHeight);     // the worst (largest) dimension
```

Simplified, ignoring `pixelRatio`:

```
metersPerPixel = 2 × distance × tan(fovY/2) / screenHeight
```

This is just the standard perspective projection relationship:

- The view frustum at distance `d` has a vertical span of `2d·tan(fovY/2)` metres.
- That span maps onto `screenHeight` pixels.
- Therefore one pixel = `2d·tan(fovY/2) / screenHeight` metres.

### 4b. The `sseDenominator` shortcut

Cesium pre-computes and caches a key constant on the frustum object:

```js
// line 180223
frustum._sseDenominator = 2 * Math.tan(0.5 * frustum._fovy);
```

This is `2·tan(fovY/2)`, which makes the formula:

```
metersPerPixel = distance × sseDenominator / screenHeight
```

`sseDenominator` is a property directly accessible at runtime:
`viewer.camera.frustum.sseDenominator`

It is updated whenever `fov` or `aspectRatio` changes, so it is always current.

### 4c. GPU-side equivalent — `czm_metersPerPixel` GLSL

The same formula is available in shaders as the built-in `czm_metersPerPixel(positionEC)` function:

```glsl
// line 38706 in bundle
float czm_metersPerPixel(vec4 positionEC, float pixelRatio)
{
    float distanceToPixel = -positionEC.z;          // eye-space depth
    float inverseNear     = 1.0 / czm_currentFrustum.x;
    float tanTheta        = top * inverseNear;       // tan(fovY/2)
    pixelHeight = 2.0 * distanceToPixel * tanTheta / height;
    // ...
    return max(pixelWidth, pixelHeight) * pixelRatio;
}
```

Identical derivation to the JS version — just operates on eye-space coordinates.

---

## 5. `fovY` Derivation from `fov` and `aspectRatio`

Cesium's `PerspectiveFrustum.fov` is the **horizontal** field of view when `aspectRatio > 1`
and the vertical FOV when `aspectRatio ≤ 1`. The vertical FOV is derived as:

```js
// line 180220
frustum._fovy = frustum.aspectRatio <= 1
  ? frustum.fov
  : Math.atan(Math.tan(frustum.fov * 0.5) / frustum.aspectRatio) * 2;
```

The `sseDenominator = 2·tan(fovY/2)` uses the **vertical** FOV, consistent with
dividing by `drawingBufferHeight`.

---

## 6. Comparison: Current Plugin vs Cesium

| Aspect | Current `getScaledLength` | Cesium `minimumPixelSize` |
|---|---|---|
| Distance computation | `Cartesian3.distance(cameraWC, satelliteWC)` — Euclidean | Project onto view axis, subtract object radius |
| FOV awareness | None — heuristic constants only | Uses `sseDenominator = 2·tan(fovY/2)` |
| Screen size awareness | None | Divides by `drawingBufferHeight` |
| Pixel-accurate | No — output size in pixels changes with window resize and FOV changes | Yes — scale is always expressed in pixel units |
| Formula | `scaleFactor = max(0.01·min(d/2000,1), d/1e6)` | `scale = P·metersPerPixel/(2·r)` |

The most significant gap is that our current formula contains **no reference to the frustum**,
so the rendered pixel size of our cones and arrows will silently change when:
- The user resizes the browser window
- The camera's FOV changes (e.g., the code already changes it for Ground Station POV mode)
- A high-DPI device uses a `pixelRatio > 1`

---

## 7. The Replicable Formula

The exact JavaScript formula to make an object maintain a desired **pixel length** `P` on screen,
matching what Cesium does for `minimumPixelSize`, is:

```
worldLength = P × metersPerPixel
            = P × distance × sseDenominator / screenHeight
```

where:
- `distance` = `Cartesian3.distance(camera.positionWC, objectPositionWC)` (or the projection
  variant that subtracts the object's bounding radius, as Cesium does for models)
- `sseDenominator` = `viewer.camera.frustum.sseDenominator` — pre-cached by Cesium, no trig needed
- `screenHeight` = `viewer.scene.drawingBufferHeight`

All three values are available on the Cesium `viewer` object every frame.

---

## 8. Summary of Findings

1. **`NearFarScalar`** provides a piecewise non-linear interpolation with a `pow(..., 0.2)` ease
   curve. It is GPU-only and not callable from JavaScript — it cannot be directly reused for
   our custom geometry.

2. **`minimumPixelSize`** for models is a CPU-side per-frame scale adjustment.
   Its internal formula (`scale = P·metersPerPixel / (2·r)`) is fully replicable.

3. **The fundamental relationship** is:
   `metersPerPixel = distance × sseDenominator / screenHeight`
   where `sseDenominator = 2·tan(fovY/2)` is already cached on `viewer.camera.frustum`.

4. **Current `getScaledLength`** does not account for FOV or screen resolution — it will produce
   inconsistent pixel sizes across different window sizes and FOV values.

5. A pixel-accurate drop-in replacement for `getScaledLength` can be written using only three
   properties already accessible on the `viewer` object, with no additional Cesium APIs needed.
