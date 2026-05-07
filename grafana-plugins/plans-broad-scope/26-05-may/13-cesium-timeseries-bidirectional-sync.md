# Bidirectional Sync: Cesium Clock ↔ Time Series Crosshair

## Your rationale is sound

The core insight is correct: **a single mouse cursor can only physically hover one panel at a time**. That mutual exclusivity is the natural arbitration mechanism. Using `mouseLeave` on the Cesium panel as the trigger to stop the player is clean and conflict-free by geometry — the moment the mouse crosses into a time series panel, Cesium stops publishing and defers to the hover.

The fight scenario you described (player pushing clock forward while hover insists it should be elsewhere) is a real problem and this design prevents it entirely.

## The proposed state machine

| Mouse location | Clock state | Bus driver |
|---|---|---|
| Inside Cesium | Playing (if play was pressed) | Cesium publishes periodically |
| Outside Cesium | Stopped | Time series hover publishes on move |
| Nowhere (between panels) | Stopped | Nothing — Cesium freezes at last time |

## Edge cases worth noting

**Resuming playback.** When the mouse returns to Cesium, the player does not auto-resume — it stays paused at whatever the time series hover left it at. The user must explicitly press play again. This is correct behaviour: silent auto-resume on `mouseEnter` would be jarring if the user just glanced at the time series.

**`DataHoverClearEvent` on time series mouseLeave.** When the mouse leaves a time series panel, Grafana fires a clear event. The existing implementation listens to this. Make sure the handler does not resume the Cesium player on clear — it should only freeze the clock in place. Resume must always be an explicit user action.

**Throttle granularity vs. animation multiplier.** If the Cesium clock is running at 60× speed (common for orbit demonstrations), a 500 ms publish interval means the crosshair jumps ~30 seconds each tick. Visually coarse but acceptable — the time series resolution is already 1–60 s per point. No functional issue.

**Brief overlap on mouseLeave.** There is a few-millisecond window where the mouse has left Cesium but the last throttled publish hasn't fired yet. At 500 ms throttle this is imperceptible and harmless.

## Difficulty: 4/10

Most of the wiring (event bus, clock listener) already exists. The new work is the `mouseLeave` → pause logic, ensuring the clear-event handler does not resume playback, and adding the throttled publish on clock tick.
