# 02 — Feature roadmap and difficulty

Difficulty: **S** ≈ 1–2 days, **M** ≈ 3–5 days, **L** ≈ 1–2 weeks, **XL** = split further.
"Already upstream" = upstream already does part of it.

## Order

| # | PR | Partition | Difficulty | Depends on |
| --- | --- | --- | --- | --- |
| 1 | Body axes (X/Y/Z attitude arrows) | Attitude | S | — |
| 1b | Refactor: data adapters, no behaviour change (see `06-…`) | Foundation | S–M | — |
| 2 | Reference-frame axes (LVLH, ITRF, ICRF) + legend | Attitude | M | 1 |
| 3 | Multi-satellite data (`namedFields` adapter, N tracks) | Multi-object | M | 1b |
| 4 | Sidebar: per-object show/hide + pick tracked object | Multi-object | M | 3 |
| 5 | Sensor cones from body frame | Attitude | L | 1, 3 + data-format talk with Lucas |
| 6 | Sensor FOV ground footprint | Attitude | M | 5 |
| 7 | Camera views (nadir, along-track, cross-track, free) | Multi-object | M | 4 |
| 8 | Cesium → time series sync (play moves the crosshair) | Temporal | S–M | — |
| 9 | Celestial FOV projection + celestial map | Attitude | XL | 5 |
| 10 | Ground station view (polar plot) | Antenna | L | 3, 4, 7 |

Archived: uncertainty ellipsoids, source reliability, digital twin, scenarios.
Progressive disclosure is a rule for every PR, not a PR: new things off by default
or tucked in a panel option category.

## Attitude and sensor orientation (top priority)

Upstream already applies the attitude quaternion to the model, so attitude is
*there* but invisible on a symmetric model. PR 1 makes it visible with body axes.
PR 2 adds frames to compare against. Sensors (PR 5) are the hard part: the fork
reads them from `meta.custom`, which normal datasources can't produce. Propose to
Lucas a panel-option editor (like the existing `LocationEditor`) for sensor FOV
and mounting quaternion.

## Multi-object context (top priority)

Upstream throws an error on anything but one frame with 8 fields. PR 3 rewrites
parsing into a tested pure function: one satellite per frame, name from the frame
name or a `name` field, fields by name when present, positional 8-column fallback
so existing dashboards don't break. Keep upstream's ECI-quaternion conversion.
PR 4 adds the sidebar. Could come before PR 1 if Lucas prefers foundations first.

## Temporal and spatial integration

Upstream already has time series → Cesium (hover sets the clock). Missing is
Cesium → time series: publish `DataHoverEvent` while playing, with a self-echo
guard so the panel doesn't stop its own clock. Small, self-contained, can land any
time. Add a panel option to turn it off. Hardest part is testing the event bus
loop without flakiness.

## Antenna direction at ground station

Upstream already has `locations` (point + label), which can serve as ground
stations — no new data format needed. The polar azimuth/elevation view and LoS
come after multi-object and camera views, as you said. `computeAzEl` and the
polar SVG are fairly isolated, so the port is mostly UI work once the base exists.

## Refactor ledger (so early files don't get left behind)

Not left to memory. Every PR that adds a simple file which a later abstraction
should absorb gets a line here. Each PR plan starts by checking this list
(`04-…` checklist). Tests make the move safe: they must pass unchanged after it.

| Added in | Thing | Revisit in | Expected change |
| --- | --- | --- | --- |
| PR 1 | `BodyAxes` takes `position` + `orientation` props | PR 3 | Call site maps over `SatelliteTrack[]`; component itself likely unchanged |
| PR 1 | Orientation read straight from upstream's parsing | PR 1b | Comes from the adapter's scene model instead |

Renderers like `BodyAxes` sit in the stable layer: the adapter refactor changes
where data comes from, not how it's drawn. So PR 1's files should mostly survive.

## Releases and compatibility

Additive changes never break dashboards: new options with defaults, a sidebar
that only appears with 2+ satellites. Each merged PR is a normal minor release
(Lucas runs `npm version minor`). Only renaming or removing options breaks saved
dashboards. When that's truly needed, Grafana's `setMigrationHandler` converts old
saved options automatically, and the release is a major version. Avoid it when possible.

## Risks across all PRs

Quaternion frame convention (fork uses ECEF as-is, upstream ECI). Resium and
Cesium API changes between versions. Upstream remounts the Viewer on every option
change (`viewerKey`), which resets the camera; the fork fixed this, and that fix
may deserve its own small PR early. The fork's component is a monolith, so split
the code into small files from the start.
