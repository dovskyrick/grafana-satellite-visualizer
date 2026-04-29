# Scenario 2 — User-Assigned Confidence Levels

## Goal
The operator assigns a confidence score (0–10) to SAT-2-A and SAT-2-B during the exercise. The Cesium plugin already has a per-satellite settings slider for confidence. That value needs to reach the server, be stored, and be returned by `/api/confidence?scenario=2`.

## What Needs to Change

### Server
- Add an in-memory store (a plain JS object): `scenario2Confidence: { 'sat-2a': null, 'sat-2b': null }`
- Add `POST /api/confidence?scenario=2` accepting `{ id: string, confidence: number }` and updating the store
- `GET /api/confidence?scenario=2` reads from the store; cells show `"?"` when null, the number when set

### Plugin (Cesium)
- The existing confidence slider in the satellite settings modal already has a value. On submit/confirm, fire a `POST` to `${digitalTwinUrl}/api/confidence?scenario=${options.scenarioId}` with `{ id: satellite.id, confidence: value }`.
- Only send the POST when `options.scenarioId === ScenarioId.Scenario2` to keep it scenario-scoped.
- No new UI needed — reuse the existing slider and settings modal submit button.

### Grafana Table
- The confidence table panel auto-refreshes on dashboard reload, picking up the stored values. No streaming needed.

## Limitations (Acceptable for Prototype)
- Confidence resets on server restart (in-memory only, no file persistence)
- Only works for scenario 2 IDs — no generalisation needed

## Difficulty: 3/10
The POST endpoint and the conditional send from the plugin are the only new pieces. Everything else (slider, modal, table panel) already exists.
