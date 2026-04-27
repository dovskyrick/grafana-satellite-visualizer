# Scenario 1: TCA at now+1h, lastObservedTime at now−1h

**Difficulty: 2/10** — two variable assignments change, the arc duration logic generalises slightly.

---

## The Problem

Currently `generateScenario1` places TCA at the midpoint of the Grafana window (`fromMs + halfDuration`). This means with a 6-hour window the collision is always at hour 3, smack in the middle. The desired behaviour is:

- **TCA = now + 1h** — collision is 1 hour in the future, still ahead of the operator
- **lastObservedTime = now − 1h** — the satellite was last observed 1 hour ago; the uncertainty ellipsoid is small before that point and starts growing after it
- The Grafana panel is set to `now−3h → now+3h` (or any window that contains both points)

With a 6-hour window starting at `now−3h`:
- Backward arc: from TCA back to `fromMs` = **4 hours**
- Forward arc: from TCA forward to `toMs` = **2 hours**

The user's "4 hours backward, 2 hours forward" description is exactly right.

---

## What Changes in `generateScenario1` (server.ts)

**Replace the midpoint TCA with a fixed offset from real clock time:**

```
const nowMs            = Date.now();
const tcaMs            = nowMs + 3600 * 1000;          // now + 1h
const lastObservedMs   = nowMs - 3600 * 1000;          // now − 1h
const toMs             = fromMs + durationSeconds * 1000;

const backwardDurationS = (tcaMs - fromMs) / 1000;     // ~4h in a 6h window
const forwardDurationS  = (toMs  - tcaMs) / 1000;      // ~2h in a 6h window

const numPointsBack = Math.floor(backwardDurationS / 60) + 1;
const numPointsFwd  = Math.floor(forwardDurationS  / 60) + 1;
```

Pass `new Date(lastObservedMs)` as `lastObservedTime` in `baseParams` (instead of `tcaDate`). The ellipsoid growth logic in `generateEllipsoidAxes` already handles any arbitrary `lastObservedTime` — no changes needed there.

Pass `numPointsBack` / `backwardDurationS` to the backward arc call and `numPointsFwd` / `forwardDurationS` to the forward arc call.

**No changes needed anywhere else** — the plugin, the parser, `orbit-math.ts`, and all other scenarios are untouched.

---

## Edge Case

If Grafana's `from` is set later than TCA (e.g. the window starts after `now+1h`), `backwardDurationS` would be negative. A guard `Math.max(backwardDurationS, 0)` keeps the server safe, though in normal use the panel will always show a window that includes both now−1h and now+1h.
