# Scenario 2 — Implementation Plan

## What Gets Reused Unchanged
- **SAT-1**: identical circular orbit (incl 53°, alt 549.9 km, lastObserved TCA − 2h, ellipsoid 50→600 m over 2h)
- **SAT-2-B**: identical to scenario 1 (incl 20°, e=0.1, startAnomaly 0.02°, lastObserved TCA − 4h30m, ellipsoid 50→4000 m over 4.5h) — the large-uncertainty "plausible" trajectory that does not indicate dangerous proximity

## What Changes: SAT-2-A (Scenario 2 version)
- **lastObservedMs**: `tcaMs − 5h` (older than scenario 1's 3h, reinforcing the credibility problem)
- **Ellipsoid**: constant 100 m from lastObserved all the way to TCA — no growth whatsoever. This is the "unrealistically frozen" ellipsoid that the user should recognise as suspicious.
- `growthHours` set to a very large number (e.g. 999h) so the quadratic growth is imperceptible within the scenario window, keeping `base ≈ startM = 100`.
- Everything else (inclination, eccentricity, altitude, startAnomaly) stays the same as scenario 1.

## Server Changes
- Add `ScenarioId.Scenario2 = 2` branch inside `generateScenario1` dispatch (rename function later or add `generateScenario2`)
- Add `ScenarioId.Scenario2` branch in `generateConfidenceTable` returning `"?"` for both SAT-2 confidence scores
- Register `ScenarioId.Scenario2` in the server-side `ScenarioId` const enum

## Plugin Changes
- `ScenarioId.Scenario2 = 2` already exists in `types.ts` ✓
- The dropdown in `module.ts` already lists Scenario2 ✓ (verify label says something readable like "Scenario 2 — Unassigned Confidence")
- No other plugin changes needed

## Grafana Side
- Duplicate the Scenario 1 dashboard, change the Cesium panel setting to `Scenario 2`, change the Infinity confidence table URL to `?scenario=2`

## Difficulty: 2/10
