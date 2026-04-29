# Scenario 3 — Attitude Anomaly in Cesium

**Difficulty: 3/10**

---

## The problem

The GS-pointing attitude override in `SatelliteVisualizer.tsx` runs inside a `CallbackProperty` that fires every Cesium frame. It currently computes the perfect body→ECEF rotation at every timestamp. We want to corrupt this rotation during the anomaly window so the antenna cone visibly drifts off-target — matching the gap in the `link_healthy` time series.

The anomaly window (start and end milliseconds) is already computed deterministically server-side from the same orbit anchor used by the link health endpoints. The plugin does not know these timestamps yet.

---

## Proposed solution

**New endpoint: `GET /api/link-anomaly-window`**

Returns a single JSON object:

```json
{ "start": 1746000000000, "end": 1746001800000 }
```

This is the middle third of the second contact window — the same range zeroed by `generateLinkStatus` and triangulated by `generateCommAnomaly`. No new computation is needed server-side; it reuses `findAnomalyWindow` on the same full anchor-to-now dataset.

**In `SatelliteVisualizer.tsx`**

On Scenario 3 mount, fetch this endpoint once and store `{ anomalyStart, anomalyEnd }` in a `useRef` (so the `CallbackProperty` closure can read it without triggering re-renders). Inside the callback, convert `time` to milliseconds with `JulianDate.toDate(time).getTime()` and check if it falls within the window. If yes, compose the GS-pointing quaternion with a fixed 15° tilt around the body X axis:

```typescript
const tiltQuat = Quaternion.fromAxisAngle(new Cartesian3(1, 0, 0), 15 * Math.PI / 180);
return Quaternion.multiply(gsPointingQuat, tiltQuat, new Quaternion());
```

Multiplying on the right tilts in the body frame — the boresight cone visibly swings 15° off the GS. Body X is a good first guess: it rotates the cone toward the orbital velocity direction, which looks physically plausible. If visually unconvincing, switching to Y rotates it toward nadir/zenith instead.

---

## Why not compute the window client-side?

The window bounds depend on orbit parameters and the anchor timestamp — both currently only in the server. A dedicated endpoint is three lines of server code and keeps the logic in one place.
