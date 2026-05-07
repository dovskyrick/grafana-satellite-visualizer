# Why the Risk Curve Is Still Sparse at Tight Zoom-Ins

## The remaining bottleneck: the 10s step floor

`adaptiveStepS` targets 120 points but hits a hard floor at 10 seconds. That means the minimum step is fixed regardless of how narrow the window gets:

| Window | Step | Points returned |
|---|---|---|
| 20 min | 10 s | 120 |
| 5 min | 10 s | 30 |
| 2 min | 10 s | 12 |
| 30 s | 10 s | 3 |

Below ~20 minutes the point count drops below 120 and keeps falling. At 2 minutes you get 12 points; at 30 seconds just 3. That is what looks sparse.

## Why does Cesium still look fine?

The orbit trajectory and the risk curve share the same adaptive step logic, but Cesium's `SampledPositionProperty` interpolates between points with a smooth Hermite/Lagrange fit — so even 12 points across 2 minutes produces a visually continuous arc. The Grafana time series panel just draws dots and line segments between exactly the points it receives; it does not interpolate, so sparsity is immediately visible.

## What to do about it

The 10s floor was set as a physical limit for orbit mechanics. For the risk curve it is not a physical limit at all — the Gaussian can be evaluated at any sub-second resolution. The fix is simply to **remove the floor for `generateRiskCurve`** and use a smaller step target there, for example:

```ts
const stepMs = Math.max(1000, Math.floor((toMs - fromMs) / MIN_POINTS)) ;
```

This targets 120 points at any window width, down to a 1-second minimum, keeping the curve smooth regardless of how tightly the user zooms in.
