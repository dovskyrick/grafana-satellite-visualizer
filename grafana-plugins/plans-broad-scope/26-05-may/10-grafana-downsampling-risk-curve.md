# Why the Risk Curve Looks Sparse at 12h Zoom-Out

## Point count at max window

At now−6h to now+6h (43 200 s), `adaptiveStepS` hits the 60 s ceiling: 720 points per satellite, ~2 880 trajectory rows for Scenario 1, 720 risk-curve points. Completely manageable for Fly.io.

## The real culprit: Grafana client-side consolidation

The server is sending the correct 720 risk points. The sparse appearance (5–10 visible points) is **Grafana's own rendering pipeline**, not the server.

Grafana's time series panel has a *Max data points* setting. When set to "auto", Grafana calculates it from the panel's pixel width — a 600 px panel maps to ~600 meaningful screen columns. To render efficiently it consolidates (averages/downsamples) the incoming series to that count. At 12h zoom with a narrow panel, it may consolidate 720 points down to as few as 5–10 rendered points.

The Cesium panel is unaffected because it is a custom plugin that bypasses Grafana's rendering layer entirely — it hands the raw row array directly to CesiumJS's `SampledPositionProperty`, which uses every point.

## Fix

In the Grafana time series panel options for the risk curve, set **Max data points → 1000** (or a specific value like 720). This tells Grafana not to consolidate below that count, and the full resolution Gaussian curve will render correctly at all zoom levels.
