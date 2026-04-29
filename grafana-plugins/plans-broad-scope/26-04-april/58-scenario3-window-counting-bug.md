# Scenario 3 — Window Counting Bug on Zoom

**Difficulty: 1/10**

---

## The problem

`generateLinkStatus` currently receives `fromMs` and `toMs` directly from Grafana's visible time range. It generates orbit points only for that window, then counts contact windows in the resulting array. When the full dashboard is open (e.g. 6–12 hours), both contact windows are present in the data and the second one is correctly identified and broken. 

When the user zooms in to inspect the second broken window, Grafana silently narrows the query to `fromMs ≈ start of second window` and `toMs ≈ end of second window`. The server now only sees one contact window in the data — the very window it should mark as "second" — and because it is position `[0]` in the array it gets treated as the first window and is left untouched. The anomaly disappears.

This is purely a counting problem. The orbit anchor is already stable (same position at any given UTC time regardless of zoom), but the window indexing is relative to whatever data was generated for the visible range, not relative to the absolute history of the orbit.

---

## The fix

The window-finding and anomaly-injection step must always operate on the **full anchor-to-toMs dataset**, not just the zoomed slice. After injecting the anomaly into the full array, filter down to `[fromMs, toMs]` before returning the response — exactly what `generateScenario3` already does for the trajectory.

Concretely, in `generateLinkStatus`:

1. Call `computeLinkHealthPoints(anchorMs, toMs)` — full range from anchor.
2. Find windows and inject anomaly into index `[1]` as now.
3. Filter: `points.filter(p => p.time >= fromMs)` before returning.

`computeLinkHealthPoints` already accepts arbitrary `fromMs`/`toMs` and already filters internally — we just need to pass `anchorMs` as the from argument instead of the caller's `fromMs`, then re-filter at the end. Two lines change, nothing else.

---

## Why this is safe

The anchor is always `floor(now / 30min) * 30min − 6h`, which is at most 6.5 hours before `toMs`. The extra points generated (anchor → fromMs) are computed and discarded, adding negligible CPU cost.
