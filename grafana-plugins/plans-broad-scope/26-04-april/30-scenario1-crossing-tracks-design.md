# Scenario 1: Crossing Ground Tracks and Safe Array Inversion

---

## Safe Backward Arc Construction

The cleanest approach is to keep `generateCircularOrbit` producing only forward-in-time points but change how `generateScenario1` assembles them. Generate the backward arc by passing `startTime = TCA`, `duration = 3h`, `reverseTime = true`, and negating the anomaly increment inside the function (controlled by a `timeDirection: -1` flag). The loop still runs `i = 0 → N` with positive `t`, but timestamps are `TCA − t` and anomaly decreases. The result is an array already ordered `[TCA, TCA−1min, ..., TCA−3h]`. A single `.reverse()` call produces a clean chronologically ascending array `[TCA−3h, ..., TCA]`. This is not fragile: `.reverse()` is a deterministic array reorder with no floating-point risk. The forward arc is generated normally (`[TCA, ..., TCA+3h]`). Drop `forward[0]` (duplicate TCA point) and concatenate. No timestamp inversion logic lives inside the parser or the plugin — the server always delivers a monotonically ascending time array.

---

## Crossing vs Parallel Ground Tracks

Two satellites with the same inclination and LOAN travel in nearly the same orbital plane, producing parallel ground tracks. For an X-crossing visual, the trick is to use **opposite effective inclinations** while keeping both satellites at the same position at TCA.

A satellite with inclination `53°` and LOAN `0°` at anomaly `0°` is exactly at `(lat=0°, lon=0°)` heading north-east. A satellite with inclination `127°` (the supplementary angle: `180°−53°`) and LOAN `0°` at anomaly `0°` is at **the same lat/lon** heading north-west — the two velocity vectors are mirror images across the meridian. This requires no numerical search: it follows directly from the orbital mechanics rotation matrices. Altitude can differ by 200 m between the two. Their ground tracks form a clean X centred on TCA, and the 6-hour window shows them converging from opposite diagonal directions before and diverging after — exactly the collision geometry needed for the scenario.
