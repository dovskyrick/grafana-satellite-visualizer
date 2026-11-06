# 03 — PR 1 plan: body axes (attitude visualization)

Status: proposed, not started.

## Why this first

It's the feature Lucas liked most, the smallest slice that shows it, and needs no
data-format change: upstream already has position + orientation per sample.
It sets a pattern for later PRs: a small renderer component, a pure math helper
with unit tests, a panel option, a README section.

## Scope

Three arrows from the satellite, rotated by the existing orientation property.
**Colour: all greyish-white, not red/green/blue** (Ricardo's decision, 2026-11-06).
Since the colours are identical, each arrow needs an `X`/`Y`/`Z` text label to tell
them apart. Per-axis colour options can come later if anyone asks. Panel options: `showBodyAxes` (default **off**, so
existing dashboards look the same), `bodyAxesLength` (metres). Optional: axis colors.
Out of scope: LVLH/ITRF/ICRF frames, legend, sensor cones, multi-satellite.

## Fork source to read

`BodyAxesRenderer` in `src/components/entities/CesiumEntityRenderers.tsx:605–748`,
`attitudeVectors` in `SatelliteVisualizer.tsx:316–326`, and
`utils/cameraScaling.ts` (length scaling with camera distance — maybe a follow-up,
keep PR 1 to a fixed length unless it looks bad).

## Implementation sketch

`src/utils/attitude.ts`: pure function `axisEndpoint(position, orientation, axis, length)`.
`src/components/BodyAxes.tsx`: three Resium `Entity` + `PolylineGraphics` with
`CallbackProperty` reading the entity's position/orientation at the clock time.
Wire it into `SatelliteVisualizer.tsx` behind `options.showBodyAxes`.

## Tests

Unit tests for `axisEndpoint`: identity quaternion gives +X/+Y/+Z; 90° about Z maps
X→Y; output length matches input. Render test (Resium mocked, like the existing
test) checks axes render only when the option is on. Run `lint`, `typecheck`,
`test:ci`, and the Playwright smoke test.

## Open question for Lucas

Body-frame convention: are the axes in the glTF model frame the same as the body
frame in his data? Ask in the PR description and offer a one-line fix if not.
