# Scenario 4 — Companion Time Series for Star Tracker Anomaly

## Goal

Give the operator a temporal signal that flags "something is wrong with attitude determination" without saying *why* directly, so the celestial-map view becomes the disambiguating tool. Mirrors the Scenario 3 pattern (`link_healthy` + `comm_anomaly`).

## Candidates

1. **Sun-to-Boresight Angle (deg)** — angle between the Star Tracker boresight (body +X under the active attitude) and the Sun direction in ECEF. Pedagogically the strongest: the curve drops smoothly from ~90° down to 0° as the SLERP enters the anomaly window. Crossing a fixed Sun-exclusion threshold (e.g. 30°) is the literal definition of the fault. Computed in the plugin from the same per-frame Sun-ECEF and satellite orientation already present.

2. **Star Tracker Validity (0/1)** — derived from #1 via a threshold. Drops to 0 during the ~4-minute fully-anomalous window. Identical visual pattern to `link_healthy`; can reuse the green/red threshold colouring already wired into the existing time-series panel.

3. **Attitude Estimation Sigma (arcsec)** — quality of the attitude solution. Nominal: ~10 arcsec (typical star-tracker accuracy). When the tracker is invalid the estimator falls back on gyro propagation, so sigma grows with time-since-last-fix at roughly 1°/h ≈ 60 arcsec/min. Recovers exponentially after the tracker comes back. Best for narrative: it shows that the *consequences* outlast the geometric event, motivating "why did the sigma stay degraded after the anomaly cleared?"

4. **Number of Stars Matched** — integer count, nominally 8–15, drops to 0 during the fault. Cheap to fake (constant + noise + zero during anomaly window). More realistic-looking than a pure binary flag.

## Recommended pairing

Show two panels side-by-side, both server-generated and time-aligned with the existing `getScenario3AnchorMs` 30-min cycle:

- **Top**: Sun-to-Boresight Angle, with horizontal threshold line at 30°. Operator sees the dip.
- **Bottom**: Attitude Estimation Sigma, showing the lagged degradation/recovery — telling the operator the impact extends beyond the geometric fault.

The user clicks the dip, jumps to that instant on the celestial map, and sees the red-pink Star Tracker FOV sitting on the ☉ marker — diagnosis complete.
