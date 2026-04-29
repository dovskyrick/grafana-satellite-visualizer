# Scenario 3 — Communication Anomaly Injection

**Difficulty: 2/10**

---

## Goal

After generating the normal link health time series, find the second contact window and force the middle third of it to 0, simulating a communication outage during an otherwise healthy pass.

---

## How to find the second contact window

`computeLinkHealthPoints` already returns a flat array sorted by time, each point carrying `link_healthy = 100 or 0`. Finding contact windows is a straightforward linear scan:

1. Walk the array looking for transitions: 0→100 marks the **start** of a window, 100→0 marks the **end**.
2. Collect `{ startIdx, endIdx }` for each window found.
3. Pick index `[1]` — the second window. If fewer than two windows exist in the requested time range, do nothing (no anomaly to inject).

---

## How to inject the outage

With `startIdx` and `endIdx` known for the second window:

- Window length = `endIdx - startIdx` points.
- Middle third: indices `startIdx + floor(length/3)` to `startIdx + floor(2*length/3)`.
- Set `link_healthy = 0` for every point in that range.

The elevation series is untouched — the elevation angle still shows the satellite overhead, making the break look like a genuine anomaly rather than a geometric miss.

---

## Where it lives in the code

All of this happens inside `generateLinkStatus` as a post-processing step after `computeLinkHealthPoints`. The raw computation is unchanged; the anomaly is a pure array mutation on the result before `res.json()` is called. `generateElevation` is not affected at all — elevation stays real.

---

## Summary

Three things: a window-finder loop (~10 lines), an index range calculation (2 lines), a zeroing loop (3 lines). No new dependencies, no changes to orbit math or the elevation endpoint.
