# TCA Quantized to 30-Minute Slots — Understanding the Goal

## The Two Problems Being Solved

**Problem 1 — Drift during a session.** Currently `tcaMs = Date.now() + 1h`. Every time any panel requests data from the server, `Date.now()` is evaluated fresh. If a user spends 15 minutes on the dashboard, the TCA has moved 15 minutes closer to now compared to when they loaded. The scenario feels like a live countdown rather than a stable exercise, which is disorienting when the user is trying to reason about a fixed conjunction event.

**Problem 2 — Mismatch between panels on reload.** The Cesium plugin and the Infinity timeseries panel make their HTTP requests independently and a few milliseconds apart. Because `Date.now()` is evaluated separately for each request, the TCA computed for the satellite trajectory and the TCA computed for the risk curve can differ by those milliseconds — technically the same moment but in practice causing a visible desynchronisation if the page load happens to straddle a second boundary.

## The Proposed Solution — 30-Minute Quantization

Instead of using raw `Date.now()`, the server rounds the current time down to the nearest 30-minute boundary and adds 1 hour to that. In pseudocode:

```
slot   = floor(Date.now() / 30min) * 30min
tcaMs  = slot + 1h
```

The effect: from 12:00:00 to 12:29:59, every request computes exactly the same `tcaMs = 13:00:00`. At 12:30:00 it advances to `13:30:00`. The TCA is stable for the entire 30-minute window, so a user doing a 15-minute exercise always sees a fixed conjunction time. Cesium and the risk curve both compute the same slot and are guaranteed to agree regardless of which millisecond their requests arrive. The scenario resets every 30 minutes automatically without any manual intervention.
