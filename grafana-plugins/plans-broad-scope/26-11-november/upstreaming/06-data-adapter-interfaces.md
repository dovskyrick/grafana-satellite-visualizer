# 06 — Data interfaces: worth it, and where in the timeline

## Verdict

Your brother is right. You already have two data formats to support: Lucas's
8 fixed columns and the fork's named, multi-frame format. More will come (TLE,
CCSDS OEM/AEM, SQL tables). One small interface now is cheap. Retrofitting it
after five feature PRs means touching all of them. You even sketched this in
Dec 2025 (`25-12-december/16-extensible-data-architecture.md`).

## The idea in plain terms

Split the plugin in two. **Adapters** turn whatever Grafana delivers into one
internal shape, the *scene model*. **Renderers** (body axes, cones, sidebar)
only read the scene model. A new data format then means one new adapter file plus
its tests, and no renderer changes. Frame handling (ECI → ECEF, see `05-…`) lives in
adapters only.

## The interface (kept small)

```ts
interface SceneModel { satellites: SatelliteTrack[]; groundStations: Station[]; warnings: string[] }
interface SatelliteTrack { id; name; position: SampledPositionProperty /* ECEF */;
  orientation?: SampledProperty /* body→ECEF */; availability; sensors: Sensor[] }
interface DataAdapter { id: string; canParse(frame, options): boolean;
  parse(frame, options): SatelliteTrack | null }
```

Adapters are tried in order. The first whose `canParse` says yes wins.

## First two adapters

1. `legacyEightColumn`: Lucas's exact contract (positional fields, ECI quaternion).
   Existing dashboards keep working byte-for-byte.
2. `namedFields`: fields found by name (`Longitude`, `qx`…), one satellite per
   frame, name from the frame name. That's the fork's format, without the
   `meta.custom` dependency.

Sensors come later as their own adapter step once the format is agreed with Lucas.

## Settings that follow the data (Ricardo's idea, 2026-11-06)

Lucas's 8-column data shows exactly today's view. Richer data unlocks new
features: settings for multi-satellite or sensors only appear when the data contains them.
This keeps the settings minimal. **It's technically possible:** Grafana's option
`showIf(currentOptions, data)` receives the panel's data frames (checked in
`@grafana/data` types). The adapter's `canParse` can drive it. Discuss with Lucas.
For PR 1, body axes stay a plain toggle, off by default. Moving toggles into the
panel UI later is a separate design decision.

## What not to build

No plugin registry, no dynamic loading, no class hierarchies, no config UI for
choosing adapters. Plain functions plus one TypeScript interface. This keeps the
PR reviewable for Lucas and avoids building for imaginary formats. Add an
adapter only when a real data source needs one.

## Where it fits in the timeline

- **PR 1 (body axes):** unchanged. Write `BodyAxes` to take `position` and
  `orientation` props, so it already speaks the scene model's language.
- **New PR 2 — `refactor: extract data parsing into adapters`:** move upstream's
  parsing into `legacyEightColumn` with zero behaviour change, plus thorough
  unit tests. That makes it easy to review and safe.
- **PR 3 (multi-satellite):** becomes just "add `namedFields` adapter + render N tracks".

## Why early pays off

Parsing becomes pure functions, so it's testable without WebGL. That's the
cheapest place to get high test coverage, and Lucas will value it. Every later
PR (sensors, ground stations, uncertainty if ever revived) plugs in without
re-touching the parser. The ECI/ECEF convention gets pinned by tests in one place.
