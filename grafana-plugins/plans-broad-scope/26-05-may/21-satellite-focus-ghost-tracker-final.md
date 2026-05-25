# Plan 21 — Satellite Focus Ghost Tracker (Celestial Map Pattern)

**Difficulty:** 2 / 10  
**Risk of breaking or introducing bugs:** 2 / 10  
**Celestial map code touched:** zero lines.

---

## Reference: How the Celestial Map Does It

In celestial mode the real 3D satellite entity is not rendered (gated by `selectedMode !== 'celestial'`). A separate invisible anchor entity takes its place:

- Gate: `selectedMode === 'celestial'`
- Filtered by `hiddenSatellites` (only rendered when satellite is visible)
- Uses `id={satellite.id}` — same ID as the real entity, safe because the real entity is absent
- `tracked={isThisSatelliteTracked}` — Cesium tracks this point
- Fully transparent `PointGraphics` + `LabelGraphics`

Because only one entity per satellite exists at any time in that mode, Cesium never swaps `trackedEntity` — the anchor is stable.

---

## What We Do for Satellite Focus Mode

We add one new JSX block immediately after the celestial tracker block. It is a direct mirror of the celestial pattern with three differences:

1. **Gate:** `selectedMode === 'satellite'` instead of `'celestial'` — celestial code is never touched.
2. **No `hiddenSatellites` filter** — the ghost tracker persists regardless of visibility, so hiding or unhiding the satellite never changes `viewer.trackedEntity`.
3. **Unique ID:** `id={`${satellite.id}-satellite-tracker`}` — the real satellite model entity is still in the scene simultaneously, so the IDs must not collide.

The real satellite entity (`SatelliteEntityRenderer`) receives `isTracked={false}` from the parent — `isTracked` is still passed for cone-scaling logic inside the renderer, but the `tracked` prop on the Cesium entity becomes `false`. This means the ghost anchor is the sole entity with `tracked={true}` in satellite focus mode, exactly mirroring how the celestial anchor is the sole tracked entity in celestial mode.

Zoom caps (`minimumZoomDistance = 5`, `maximumZoomDistance = 6378137 × 3`) are already applied to satellite mode and remain untouched.

---

## Files Changed

| File | Change |
|------|--------|
| `SatelliteVisualizer.tsx` | Add ~20-line ghost tracker JSX block after celestial tracker block; pass `isTracked={false}` to `SatelliteEntityRenderer` |
| `CesiumEntityRenderers.tsx` | `tracked={isTracked}` → `tracked={false}` (one line; cone scaling unaffected) |

---

## What Does Not Change

- Celestial map tracker block — not touched, not moved, not read by the new code.
- Zoom caps effect — no new dependencies added.
- `hiddenSatellites` logic — unchanged everywhere else.
- All other modes (earth, ground station) — completely unaffected.
