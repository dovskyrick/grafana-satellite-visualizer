# Scenario 4 — Star Tracker Anomaly (Toggle Test)

**Difficulty: 1.5/10**
**Scope: server + plugin (CallbackProperty only).**

## Understanding

1. **Rename** the existing Z-axis sensor from "Star Tracker" to "Solar Panel Optimal Direction" (kept for reference, deletable later).
2. **Add** a new X-axis sensor called "Star Tracker". Both FOVs render simultaneously.
3. **Default attitude**: body +Z points at the Sun (current behaviour — solar panels nominal).
4. **Anomaly attitude**: body +X points at the Sun → Star Tracker is blinded.
5. **Test step (this one)**: in the plugin's `CallbackProperty`, alternate between the two modes every 60 s based on `JulianDate.toDate(time).getTime()`. Anomaly mode is just `baseQuat * rotY(-90°)`. Real time-window selection comes later.
