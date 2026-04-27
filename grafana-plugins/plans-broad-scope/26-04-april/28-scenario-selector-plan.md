# Scenario Selector: Plugin Setting and Server Communication

## Goal

Add a panel setting dropdown that lets the operator choose one of six named scenarios. For now implement only two: the existing default three-satellite setup and a reduced two-satellite version. The primary purpose is to verify the round-trip: a setting change in Grafana triggers a different request to the server, and the server returns the appropriate data.

## Encoding: Integer Enum, Not String

The scenario identity should be communicated to the server as an integer index (`scenario=0`, `scenario=1`, etc.), not a string name. Strings introduce case sensitivity, spaces, and serialisation risk. The integer maps directly to a TypeScript enum on both sides. Six scenarios means values `0`–`5`. The plugin sends this integer as a query parameter appended to the existing URL: `/api/satellites?from=…&to=…&scenario=2`.

## Plugin Side (three files)

**`types.ts`** — add a `ScenarioId` numeric enum with six named members (`Default = 0`, `CollisionRisk = 1`, `…`, up to `5`), and add `scenarioId: ScenarioId` to `SimpleOptions`.

**`module.ts`** — inside the `Data Source` category, below the existing `digitalTwinUrl` text input, add a `addSelect` call with six labelled options mapping to the six enum values. Default is `ScenarioId.Default`.

**`SatelliteVisualizer.tsx`** — the URL construction at line 959 currently reads:

```
const url = `${options.digitalTwinUrl}/api/satellites?from=${from}&to=${to}`;
```

Change it to append `&scenario=${options.scenarioId}`. Add `options.scenarioId` to the `useEffect` dependency array at line 980 so the panel re-fetches automatically when the scenario changes.

## Server Side (`server.ts`)

Read `req.query.scenario` and parse it as an integer (default `0` if absent or invalid). Pass it to `generateTrajectory`. Inside `generateTrajectory`, if `scenario === 1`, slice `satellitesData` to only the first two entries before returning. All other values return the full array unchanged. This keeps the branching minimal and localised in one function.

## What This Proves

Changing the dropdown from `Default` to `Scenario 1` causes the plugin to re-fetch, the server receives `scenario=1`, and only two satellite frames are returned and displayed. The data protocol and setting wiring are confirmed before any new trajectory mathematics is introduced.
