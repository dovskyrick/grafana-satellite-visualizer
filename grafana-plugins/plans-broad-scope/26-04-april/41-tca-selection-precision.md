# TCA Selection Precision: Options and Analysis

## The Core Problem

Grafana's shared crosshair updates on every mouse movement pixel. Even if the user aims at the TCA peak, a 1–2 pixel horizontal drift translates to 1–2 minutes of time error on a 12-hour window, which at 550 km altitude translates to hundreds of kilometres of satellite position error. The single-point marker helped identify TCA visually but didn't prevent the drift.

## Option A — Narrow Gaussian Spike (Implemented)

Replace the single point with a very narrow Gaussian (σ=1.5 min) scaled to 1.2, rendered only within ±6 minutes of TCA. The resulting shape is a thin needle protruding above the risk bell curve. The user now has a visible target to aim at precisely. The improvement is partial: it makes the exact peak clearer and the 1.2 height distinguishes it from the smooth curve below, but pixel-level mouse drift still exists. It reduces the effective target from a 20-minute-wide hill to a 3-minute-wide spike.

## Option B — Time Range Zoom (Most Effective)

Narrow the Grafana time range to ±10 minutes around TCA (drag-select on the time series or manually set the time picker). At this zoom level, 1 pixel of horizontal movement ≈ a few seconds of time, which is negligible for satellite positioning. Both the Gaussian and the spike are now easy to pin precisely. This requires one extra gesture from the operator but gives genuinely sub-minute precision.

## Option C — Grafana Variable + Button Panel

Add a "Jump to TCA" button using a Grafana Text panel with a URL link that sets the time range to `now+50min` to `now+70min`. One click zooms directly to the TCA window without manual drag. Requires no code change on the server.

## Option D — Lock on Click in the Cesium Plugin

Implement a "lock timestamp" button inside the Cesium panel. Once clicked, the plugin ignores subsequent hover events and holds the locked time. The operator hovers approximately near TCA, locks, then fine-tunes if needed. This is the most robust long-term solution and eliminates the problem entirely regardless of window size.

## Recommendation

Options B and C together give immediate relief with zero code. Option D is the right permanent fix when the prototype matures.
