# Two UX Problems: TCA Risk Curve and Crosshair Lock

---

## Problem 1: A Time Series with a Peak at TCA

The goal is a bell-curve-like signal centered on TCA that gives the operator an at-a-glance collision risk profile across the timeline, without wiring a new datasource.

**Interpretation:** a Gaussian-shaped timeseries where the peak aligns with TCA, decaying symmetrically to near-zero at the window edges. Useful as a visual anchor — the operator can immediately locate the risk moment on the timeline without reading coordinates.

**Option A — Grafana TestData DB (static, immediate).** The built-in TestData datasource supports a "CSV content" input type where you paste raw `time,value` pairs. You can precompute ~100 points of a Gaussian manually for a fixed TCA timestamp. Limitation: the timestamps are absolute and hardcoded, so the curve doesn't move as "now" advances.

**Option B — Lightweight server endpoint (recommended).** Add a `/api/risk` route to the mockup server that returns a single-frame timeseries of `[timestamp, risk_value]` pairs. The values follow `exp(−((t−TCA)²) / (2σ²))` with `σ ≈ 20 minutes`. The server already knows TCA from the scenario logic, so this is ~15 lines. The Grafana panel queries it as a separate JSON datasource using Infinity plugin or the existing generic JSON plugin. This gives a dynamic curve that tracks TCA in real time and integrates cleanly with the shared crosshair.

**Option C — Grafana transformation on existing data.** Add a calculated field via the Transform tab using a math expression on the satellite altitude data. This is possible but convoluted and fragile.

Option B is the most maintainable and correct.

---

## Problem 2: Locking the Hover Crosshair at a Selected Time

**Interpretation:** the operator hovers over the Gaussian peak to set the Cesium time to TCA, but as they move the mouse toward the Cesium panel they drift horizontally, triggering hover events at adjacent timestamps. The desired behaviour is: click once at TCA to freeze the shared time, then interact freely with Cesium without the time drifting.

**Option A — Pin tooltip in Grafana 10+.** Grafana 10 introduced a "sticky" crosshair — clicking on a timeseries panel pins the tooltip and crosshair at that moment. The crosshair stays fixed until you click elsewhere. This is zero-code and exactly solves the problem. Worth checking first whether the current Grafana version supports it (look for a pin icon appearing on click in a timeseries panel).

**Option B — Lock inside the Cesium plugin.** Add a `lockedTimestamp` state variable to the plugin. On `dataHoverEvent` the plugin updates as normal. On a secondary interaction (e.g. pressing a keyboard shortcut, or clicking a small "lock" button in the panel UI), the plugin stores the current timestamp and stops responding to subsequent hover events until unlocked. This is a small plugin-side addition (~20 lines) and gives precise control.

**Option C — Grafana variable as a time pin.** Use a Grafana dashboard variable `$pinnedTime`. A panel link or URL action on click sets `$pinnedTime` to the clicked timestamp. The Cesium plugin reads `$pinnedTime` via `options` or `replaceVariables`. This decouples the time selection from hover entirely but requires some Grafana variable plumbing.

**Option D — Narrow the time range.** After hovering near TCA, use Grafana's click-and-drag zoom on the timeseries to narrow the window to ±5 minutes around TCA. The plugin re-fetches and renders only that narrow window, effectively locking the view. Simple but changes the data range rather than just the playback time.

Option A costs nothing if the Grafana version supports it. Option B is the fallback with full control.
