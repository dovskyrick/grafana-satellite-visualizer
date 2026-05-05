# Fix: Label Collision in Total Map Celestial View

## Problem

In the equirectangular total map SVG (viewBox `0 0 360 180`), several labels are drawn independently and can land on the same pixel area. The candidates are: **Sun**, **Sun excl.**, **Moon**, per-sensor **FOV names** (up to ~3), and **ground station names**. Each is placed by `clampLabel`, which only prevents edge clipping — it has no awareness of sibling labels.

SVG has no layout engine; there is no flexbox equivalent that would automatically spread 2D text labels. The solution must be implemented in JavaScript before render.

## Why at Most Two Labels Overlap

In practice these objects rarely cluster because:
- The Sun and Moon are always on opposite sides of the sky.
- FOV rings span predictable cone sizes.
- The scenario only uses 1–3 sensors.

The single realistic collision is **one sensor FOV label landing on the Sun label** (or Sun excl. label) when the sensor happens to be pointing near the Sun. A two-label nudge is sufficient.

## Proposed Fix — Pairwise Bounding-Box Collision Resolution

**Before any `<text>` element is rendered**, collect all computed label positions into a single array:

```ts
interface LabelSlot { x: number; y: number; w: number; h: number; }
```

Where `w = fontSize × 0.55 × text.length` and `h = fontSize`. Run a simple O(n²) loop (n ≤ ~8, negligible cost) over every pair. If two bounding boxes overlap:

- Keep the one with the **lower x** (leftmost) in place.
- Shift the other **down by `h + 1.5` SVG units** (≈ one line height + gap).
- Re-clamp the shifted label to stay inside the viewBox.
- Only one pass is needed; with n ≤ 8 and at most two labels near each other, cascading is not an issue.

This matches the user's intuition exactly and is fully deterministic.

## Implementation Sketch

1. Add a `resolveCollisions(slots: LabelSlot[]): LabelSlot[]` pure function near `clampLabel` in `SatelliteVisualizer.tsx`.
2. In the SVG rendering block, compute raw positions for all labels first, push them into the resolver, then use the resolved positions when emitting `<text>` elements.
3. No changes to `totalMapProjection.ts` or `celestialGrid.ts` are needed.

## Scope

Changes are confined to `SatelliteVisualizer.tsx` — roughly ~25 lines added (the resolver function + one call-site per label group). No new dependencies.
