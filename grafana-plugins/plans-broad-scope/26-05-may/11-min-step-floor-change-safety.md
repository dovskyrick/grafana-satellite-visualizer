# Is It Safe to Drop MIN_STEP_S from 10 to 1?

## The formula

```ts
function adaptiveStepS(durationSeconds: number): number {
  return Math.max(MIN_STEP_S, Math.min(MAX_STEP_S, Math.floor(durationSeconds / MIN_POINTS)));
}
// MIN_POINTS = 120, MAX_STEP_S = 60
```

The computed raw step before clamping is `floor(duration / 120)`. The result is then squeezed between the floor and the ceiling. The floor and ceiling are independent constraints — one governs zoom-in, the other governs zoom-out.

## At the normal 12h window

`floor(43200 / 120)` = `360`. That immediately hits the **ceiling** of 60 s and is clamped down to 60. The floor is never consulted — 360 is already far above both 10 and 1. Result: **720 points, identical to today**.

## At what window does the floor actually matter?

The floor only activates when the raw computed step falls below it:

| Floor | Floor activates when window is narrower than |
|---|---|
| 10 s | 10 × 120 = **1 200 s (20 min)** |
| 1 s | 1 × 120 = **120 s (2 min)** |

Changing the floor from 10 to 1 only affects windows **narrower than 20 minutes**. Anything wider, the floor is irrelevant — the raw step already exceeds it. The zoom-out side is completely unaffected.

## Conclusion

The ceiling (`MAX_STEP_S = 60`) is the sole constraint for wide windows. The floor is the sole constraint for narrow windows. They never interact. Dropping the floor to 1 s is safe.
