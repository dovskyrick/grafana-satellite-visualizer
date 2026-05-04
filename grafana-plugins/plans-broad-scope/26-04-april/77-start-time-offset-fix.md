# Clock Start Offset — Fix for Camera Losing Track at T=0

## The Bug

When the Cesium plugin loads and the clock is at the very first tick of the trajectory, zooming in quickly causes the camera to lose the satellite. This never happens mid-trajectory. The most plausible cause: at T=0 the satellite's `SampledPositionProperty` may return `undefined` for the very first sample because Cesium hasn't yet interpolated a valid value — it needs at least one sample on each side of the current time to compute position. At the boundary (first sample), there is no "left neighbour" to interpolate from, so `getValue()` briefly returns `undefined`, and the tracker loses its anchor.

## The Fix — Offset Clock Start by 1 Second

The Cesium `<Viewer>` component (via Resium) accepts a `clockViewModel` or direct `clock` props. The cleanest place to apply the offset is immediately after the viewer is ready, in the `onReady` callback or the `isViewerReady` effect.

### Approach

1. **Find the data start time**: the earliest `JulianDate` across all loaded satellites' `SampledPositionProperty`. This already exists implicitly as `viewer.clock.startTime` since the clock is configured from the data range.

2. **Add 1 second**: use `JulianDate.addSeconds(viewer.clock.startTime, 1, new JulianDate())` to compute the offset start.

3. **Set `currentTime`**: assign `viewer.clock.currentTime = offsetStart`. This does not change `startTime` or `stopTime` — the full trajectory range is preserved — it only moves the playhead forward by one second so interpolation has a valid left neighbour from the first frame.

4. **Guard it**: wrap in `if (viewer.clock.currentTime equals viewer.clock.startTime)` so the offset only applies on initial load, not on every re-render or mode switch.

### Where in Code

In `SatelliteVisualizer.tsx`, in the `useEffect` that watches `isViewerReady` (the one that also handles the celestial overlay clock), after confirming `isViewerReady === true`:

```typescript
const viewer = viewerRef.current?.cesiumElement;
if (viewer) {
  const start = viewer.clock.startTime;
  const offsetStart = JulianDate.addSeconds(start, 1, new JulianDate());
  if (JulianDate.equals(viewer.clock.currentTime, start)) {
    viewer.clock.currentTime = offsetStart;
  }
}
```

`JulianDate` is already imported from Cesium. One-liner fix, zero side effects.
