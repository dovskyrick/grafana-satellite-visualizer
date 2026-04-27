# Scenario 1: Backward-Forward Propagation for Collision Risk

**Difficulty: 4/10**

---

## What Needs to Be Done

### 1. Extend `OrbitParams` with `timeDirection` (`orbit-math.ts`)

Add `timeDirection?: 1 | -1` (default `1`). Inside `generateCircularOrbit`, apply it in two places:

```
timeMs       = startTimeMs + timeDirection * t * 1000
meanAnomaly  = startAnomalyRad + timeDirection * (t / period) * TWO_PI
```

This makes the satellite walk backward along its Keplerian ellipse and produces timestamps that decrease from `startTime`. The existing `reverseTime` flag (already implemented) handles the longitude drift inversion and should be set to `true` whenever `timeDirection = -1`. These two flags can be passed together or linked by a helper.

### 2. Write `generateScenario1` in `server.ts`

Define `TCA = now` (or the midpoint of the requested `from–to` window, same as the existing `lastObservedTime` logic). Define two satellite configs:

- **Sat A**: altitude 550 km, inclination 53°, LOAN 0°, startAnomaly 0°
- **Sat B**: altitude 550.2 km (+200 m), inclination 53°, LOAN 0°, startAnomaly 0°

Both satellites start at almost identical lat/lon/altitude at TCA — the 200 m altitude gap is the only separation, making them effectively co-located to the eye.

For each satellite, generate two arcs from `startTime = TCA`, `duration = 3 h`:

- **Backward arc**: `timeDirection = -1`, `reverseTime = true` → produces `numPoints` timestamped from `TCA` back to `TCA − 3h`. Reverse the returned array so it is chronologically ascending.
- **Forward arc**: `timeDirection = 1`, `reverseTime = false` → produces points from `TCA` to `TCA + 3h`.

Drop the first point of the forward arc (it duplicates the TCA point that ends the backward arc), then concatenate: `[...backward_reversed, ...forward_arc.slice(1)]`. This gives a seamless 6-hour trajectory centred on the closest approach.

### 3. Wire into `server.ts` dispatch

In `generateTrajectory`, when `scenario === ScenarioId.CollisionRisk1`, call `generateScenario1` instead of the existing loop and return its two frames plus the ground stations frame unchanged.

---

## Summary of Files Touched

| File | Change |
|---|---|
| `orbit-math.ts` (server) | Add `timeDirection` to `OrbitParams`, two-line change in loop |
| `server.ts` | New `generateScenario1` function, dispatch in `generateTrajectory` |
