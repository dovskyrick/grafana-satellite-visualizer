\section{Scenario 4: Attitude determination degradation caused by invalid star tracker pointing}

This scenario evaluates the prototype in a diagnostic task where the operator must determine whether an attitude related anomaly is associated with invalid pointing conditions for the spacecraft star trackers. The operational situation is that a time series indicates a deterioration in attitude determination quality during a specific interval, for example through an increase in attitude estimation error, a drop in tracker validity status, or the appearance of a fault flag associated with the attitude determination chain. The purpose of the scenario is to assess whether the user can relate this temporal anomaly to the celestial pointing context of the star trackers and identify that the sensing geometry has entered an invalid condition.

In the proposed data, the spacecraft carries two star trackers whose fields of view are shown on the celestial map as time evolves. During the anomalous interval, one tracker enters the solar exclusion region, while the other points toward the Earth, preventing both instruments from providing reliable star field information at the same time. The time series is therefore configured so that the attitude determination quality degrades precisely when these two invalid pointing conditions occur together. This gives the operator a visually interpretable explanation for the anomaly, since the relevant problem is not hidden in raw telemetry values alone but becomes visible through the relation between the tracker fields of view and the celestial environment.

The expected reasoning process is that the user will first identify the anomalous interval in the time series and then inspect the corresponding instant in the synchronized celestial view. Once there, the user is expected to observe that the field of view of one tracker overlaps the Sun exclusion zone while the second tracker is directed toward the Earth, leaving the spacecraft without a valid star tracker solution. The prototype supports this diagnosis by allowing the user to inspect the temporal and geometric aspects of the event within the same interface, rather than forcing the interpretation to depend on separate tools or on abstract attitude telemetry alone. The scenario therefore emphasizes how exclusion conditions and celestial pointing constraints can become legible as part of a broader diagnostic workflow.

The intended conclusion is that the observed degradation in attitude determination is associated with simultaneous loss of valid star tracker visibility caused by improper pointing geometry. By identifying that one tracker is blinded by the Sun exclusion condition while the other is directed toward the Earth, the user can explain the anomaly as a sensing problem rather than as an unexplained software failure or a generic attitude fault. This scenario therefore evaluates the usefulness of the celestial map view and of field of view visualization for operational diagnosis. It also strengthens the argument that the prototype can support interpretation not only of orbital and Earth referenced context, but also of spacecraft sensing conditions in the celestial domain.

---

# Scenario 4 — Implementation Plan

**Difficulty: 1/10**

---

## Trajectory (server-side)

Identical to Scenario 3. Reuse `getScenario3AnchorMs()` and the same `generateCircularOrbit` call:
- altitude 550 km, inclination 53°, longitudeOfAN 0°, startAnomaly 0°
- anchor = `floor(now / 30min) * 30min − 6h`
- generate from anchor to `toMs`, filter to `fromMs`
- same `lastObservedMs` logic

Add `ScenarioId.StarTrackerAnomaly = 4` to the enum and a `generateScenario4(fromMs, toMs)` function that is literally a copy of `generateScenario3` with two changes:

1. **Static attitude** — replace the spinning quaternion block with a constant:
   ```typescript
   qx: 1, qy: 0, qz: 0, qs: 0   // first try
   ```
   All points get the same quaternion. No per-point angle computation.

2. **Sensor** — rename from `Antenna` to `Star Tracker`, widen FOV to 20°, boresight along **+X body** (−90° around Y):
   ```typescript
   const starTrackerSensor = [{
     id: 'sat-st-x',
     name: 'Star Tracker',
     fov: 20,
     orientation: { qx: 0, qy: -0.7071, qz: 0, qw: 0.7071 }, // boresight = +X body
     color: '#FFD700',
   }];
   ```

No ground station frame needed for this scenario (remove the `gsFrame` return, or keep it empty).

---

## Attitude guesses to try in order

| Try | qx  | qy  | qz  | qs  | What it means in ECEF |
|-----|-----|-----|-----|-----|------------------------|
| 1   | 1   | 0   | 0   | 0   | 180° around X → body +Z points toward ECEF −Z (south pole) |
| 2   | 0   | 1   | 0   | 0   | 180° around Y → body +Z points toward ECEF −Z as well (different handedness) |
| 3   | 0   | 0   | 1   | 0   | 180° around Z → body +Z points toward ECEF −Z |
| 4   | 0   | 0   | 0   | 1   | Identity → body +Z = ECEF +Z (north pole) |

Deploy, look at the celestial map, see where the star tracker FOV circle sits relative to the Sun symbol. Adjust from there.

---

## Plugin-side

No override. No `CallbackProperty`. The `SampledProperty` from the parser is used directly (same as the "STEP 1" state in Scenario 3). Just add `ScenarioId.StarTrackerAnomaly` to the scenario selector and point the data source at `/api/satellites?scenario=4`.

---

## Summary

Copy `generateScenario3`, swap the spinning quaternion for a constant one, rename the sensor. Four lines of change on the server. Zero changes in the plugin.
