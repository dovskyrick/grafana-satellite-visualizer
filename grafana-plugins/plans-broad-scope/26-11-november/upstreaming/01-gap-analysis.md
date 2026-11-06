# 01 — Gap analysis (fork `main` @ 3688e28 vs upstream `main` @ 1.12.0)

Checked 2026-11-06 by reading code, not docs.

## Size

Upstream is small: `SatelliteVisualizer.tsx` 318 lines, `module.ts` 196, one test file.
The fork's component is 2 960 lines plus ~3 000 lines of renderers, parsers and utils,
and zero unit tests. So every feature is a re-implementation, not a cherry-pick.
Git history can't help either: the fork's history starts at 2026-04-30 (50 commits).

## Toolchain drift

| | Fork | Upstream |
| --- | --- | --- |
| Grafana packages | 10.0.3 | ^12.2.0 |
| Cesium / Resium | 1.112 / 1.17 | 1.140 / 1.22 |
| E2E | Cypress | Playwright (`tests/smoke.spec.ts`) |
| ESLint | 8, `.eslintrc` | 9, flat config |

Upstream baseline verified here: `jest` 2/2 pass, `tsc` clean, `eslint` clean.
Code must be written against upstream's versions. Old Resium props may have changed.

## Data contract — the biggest risk

**Upstream:** exactly one frame, exactly 8 positional fields:
time, lon/x, lat/y, alt/z, qx, qy, qz, qs. Quaternion is **body → ECI**, and upstream
converts it to ECEF (`q_B_ECEF = conj(q_ECI_ECEF) · q_B_ECI`).

**Fork:** many frames, fields found by *name* (`Longitude`, `qx`…), quaternion applied
**as-is** (no ECI→ECEF conversion), and satellite name, sensors, ground stations and
`lastObservedTime` read from `frame.meta.custom`.

Why it matters: `meta.custom` is only filled by custom datasources (the mock digital
twin). Normal Grafana datasources (SQL, Infinity, CSV) can't set it. Upstream PRs must
keep the 8-column format working and keep the ECI quaternion meaning. Sensor/station
config must come from panel options or extra fields, not `meta.custom`.

## Fork-only concerns to drop when porting

`console.log` everywhere, `localStorage` state, `.bak`/`.broken` files, digital-twin
fetch path, scenario IDs, review/confidence modals, hard-coded camera distances.
