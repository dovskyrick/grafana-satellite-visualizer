# Note: Avoiding a Density Seam at TCA

Scenarios 1 & 2 split the window into two arcs — one propagated backward from TCA to `fromMs`, one forward from TCA to `toMs`. If each arc derived its own step from its own duration, a short back-arc and a long forward-arc would get different step sizes, producing a visible density jump right at the conjunction point.

**Solution:** compute `stepS` once from the total window duration before splitting:

```ts
const totalDurationS = backDurationS + fwdDurationS;
const stepS          = adaptiveStepS(totalDurationS);
const numPointsBack  = backDurationS > 0 ? Math.floor(backDurationS / stepS) + 1 : 0;
const numPointsFwd   = fwdDurationS  > 0 ? Math.floor(fwdDurationS  / stepS) + 1 : 0;
```

Both arcs share the same cadence. No seam. Apply identically to `generateScenario1` and `generateScenario2`.
