# Plan: Sun Exclusion Zone Legend Entry (Celestial 360 View)

## Difficulty: 2 / 10

Pure JSX + inline SVG, no new state, no hooks, no style file changes needed.

## Problem

The `Sun excl.` label drawn on the equirectangular map is small and hard to read. The legend panel has no entry for it. The standard legend swatch is a solid colored `div` opened by a `ColorPicker` — it cannot represent a dashed stroke with a semi-transparent fill.

## Proposed Solution

Add a single non-editable legend row, visible **only** when `selectedMode === 'celestial' && celestialCameraView === 'total-map'`, inside the existing `legendContent` block. Instead of a `ColorPicker`-wrapped `div`, the swatch is a tiny inline `<svg>` (16 × 16 px) that directly mirrors the visual language used on the map:

```tsx
{selectedMode === 'celestial' && celestialCameraView === 'total-map' && (
  <div className={styles.legendSection}>
    <div className={styles.legendSectionTitle}>Celestial Zones</div>
    <div className={styles.legendItem} style={{ cursor: 'default' }}>
      <svg width="16" height="16" style={{ flexShrink: 0 }}>
        <rect
          x="1" y="1" width="14" height="14" rx="2"
          fill="#FFD700" fillOpacity={0.12}
          stroke="#FFD700" strokeWidth="1.5"
          strokeDasharray="3 2"
        />
      </svg>
      <span className={styles.legendItemName}>Sun excl. zone (15°)</span>
    </div>
  </div>
)}
```

The `rect` uses `strokeDasharray="3 2"` and `fillOpacity={0.12}` — matching the actual path on the map (`fillOpacity={0.08}`, `strokeDasharray="2 1.5"`; slightly more visible at 16 px scale). `cursor: default` on the row prevents the pointer cursor the `legendItem` class normally sets, making it visually non-interactive.

## Where to Insert

Immediately after the closing `})()}` of the Sensors section (line ~2202), still inside `<div className={styles.legendContent}>` — so it sits below sensors in the legend, but before the legend content `</div>`.

## Notes

- No `legendColorSwatch` class used — the inline SVG replaces it.
- No new CSS class needed; `legendItem`, `legendSection`, `legendSectionTitle`, and `legendItemName` are reused as-is.
- The condition `celestialCameraView === 'total-map'` ensures it disappears in zoomed-in celestial mode where the zone isn't shown.
