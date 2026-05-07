# Plan: Adaptive Sampling Density for Zoomed-In Time Windows

## The Problem

The mockup digital twin server generates orbit trajectory points at a **fixed cadence of 1 point per minute** (60-second step). This is fine for a 6–12 hour Grafana window — you get 360–720 well-spaced points and Cesium draws a smooth arc.

But when a user zooms in to a very short interval — say, a 5-minute or even 30-second window — the server still generates at 1pt/min, returning only 0–5 points for that slice of time. Cesium's `SampledPositionProperty` needs a minimum cluster of points to interpolate between; with fewer than ~10 points it either:

- Draws nothing (no interpolation range),
- Snaps to the last known position (satellite freezes),
- Or renders a very jagged/discontinuous arc.

The root cause is that `numPoints` is always computed as:

```ts
Math.floor(durationSeconds / 60) + 1
```

so the step is hardcoded to 60 seconds regardless of the window. A 3-minute window produces 3–4 points; a 30-second window produces 0–1.

This is the **opposite problem** from the OOM crash (zoom out too wide → too many points). This is: zoom in too tight → too few points.

**Scope:** This problem only matters for **Scenario 1 (Collision Risk)** and **Scenario 2 (Confidence Assessment)**. These are the only scenarios where tight zoom-ins are meaningful and expected — the user zooms into the TCA window to examine the conjunction geometry closely. All other scenarios (default, Scenario 3/4/5) are not zoomed into in practice and do not need this fix.

---

## Why Only a Minimum Points Fix Is Needed

Zoom-out is already handled by `clampToWindow()` which caps every request to `[now−6h, now+6h]`. That means the upper bound on data volume is already guaranteed — a wide request is already capped to at most 12 hours, producing at most 720 points at 1pt/min.

Therefore the only remaining problem is the **lower bound**: a zoomed-in request produces too few points. We just need to guarantee a minimum number of points is always returned, with no need to worry about a maximum.

---

## Proposed Fix: Minimum Points Guarantee

### Core idea

Replace the fixed 60-second step with a step derived by targeting a minimum number of points for the requested window:

```
MIN_POINTS = 120
STEP_S     = min(60, floor(durationSeconds / MIN_POINTS))
             but at least 10 seconds (physical floor — no value in going finer)
```

So:
| Window size | Step | Points returned |
|---|---|---|
| 6 h (normal) | 60 s | 360 |
| 30 min | 15 s | 120 |
| 10 min | 10 s | 120 |
| 2 min | 10 s | 12 (best effort below the physical floor) |

The ceiling at 60 seconds preserves current behaviour for normal-sized windows. The floor at 10 seconds is physical — at orbital speeds a 550 km LEO satellite moves ~75 km in 10 s, which is more than enough resolution for Cesium.

### Helper function to add

```ts
const MIN_POINTS = 120;
const MIN_STEP_S = 10;
const MAX_STEP_S = 60;

function adaptiveStepS(durationSeconds: number): number {
  return Math.max(MIN_STEP_S, Math.min(MAX_STEP_S, Math.floor(durationSeconds / MIN_POINTS)));
}
```

---

## Where to Apply It — Scenarios 1 & 2 Only

### `generateScenario1` and `generateScenario2`

Both currently compute:
```ts
const numPointsBack = backDurationS > 0 ? Math.floor(backDurationS / 60) + 1 : 0;
const numPointsFwd  = fwdDurationS  > 0 ? Math.floor(fwdDurationS  / 60) + 1 : 0;
```

The step must be consistent between both arcs (no density seam at TCA). Derive it from the total window, then apply to both:

```ts
const totalDurationS = backDurationS + fwdDurationS;
const stepS          = adaptiveStepS(totalDurationS);
const numPointsBack  = backDurationS > 0 ? Math.floor(backDurationS / stepS) + 1 : 0;
const numPointsFwd   = fwdDurationS  > 0 ? Math.floor(fwdDurationS  / stepS) + 1 : 0;
```

### `generateRiskCurve` (collision risk time series, `/api/risk`)

This is the risk Gaussian curve shown in Scenarios 1 & 2. Currently:
```ts
const stepMs = 60 * 1000;
```

Change to:
```ts
const stepMs = adaptiveStepS((toMs - fromMs) / 1000) * 1000;
```

Everything else (`generateTrajectory`, `computeLinkHealthPoints`, `generateStarsMatched`, etc.) stays at its current fixed step — no changes needed outside Scenarios 1 & 2.

---

## What Stays the Same

- `clampToWindow()` — still handles the zoom-out bound, no change needed.
- `orbit-math.ts` — fully parametric, zero changes needed.
- All scenarios other than 1 & 2 — untouched.
- All Cesium/plugin code — the plugin just consumes rows; more rows at tighter intervals is transparent.

---

## Accuracy

The orbit math is an analytical Keplerian propagator — there is no numerical integration that accumulates error. Generating a point every 10 seconds is exactly as accurate as every 60 seconds; it just computes more intermediate positions along the same mathematical orbit.

---

## Difficulty Rating: **2 / 10**

**Why low:** Scope is now just two functions (`generateScenario1`, `generateScenario2`) and one loop (`generateRiskCurve`). Each change is a mechanical one-liner replacement of a hardcoded `/ 60` with a call to the new 3-line helper. No new dependencies, no data model changes, no plugin changes, no cross-cutting concerns.

**What adds the little friction:**
- Scenarios 1 & 2 split the window into two arcs (before/after TCA). The step must come from the *total* window duration so both arcs share the same density and there is no seam at the conjunction point. One extra line of reasoning, not a real obstacle.

Total estimated implementation time: **15–20 minutes**.
