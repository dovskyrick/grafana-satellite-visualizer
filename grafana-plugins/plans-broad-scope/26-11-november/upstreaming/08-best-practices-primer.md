# 08 — Best-practices primer (for reviewing my work)

What a good engineer would check, applied to this project. Each topic ends with
a question you can ask when reviewing a PR.

## 1. Small PRs, merged often

You read it right. Long-lived branches drift and become painful to merge. The fork
grew for a year before facing upstream, and now everything needs re-implementing.
Upstream PRs should be a few hundred lines, reviewable in one sitting, and merged
before the next starts. If one PR grows past ~400 changed lines, split it.
*Review question: could Lucas review this in 20 minutes?*

## 2. Which tests are the 20% that matter

For us, the high-value tests are **unit tests of pure functions**: maths, parsing,
frame conversion. They're fast, exact and never flaky. Next come **render tests**
with Resium mocked: is the component shown or hidden by its option? Last is one
**E2E smoke test** (upstream's Playwright) proving the panel loads in real Grafana.
Don't test Cesium's pixels or Cesium itself.
*Review question: is every formula covered by a test with a hand-checked number?*

## 3. Testing shapes the design

Code that's hard to test is usually badly structured. The pattern: a
**functional core, imperative shell**. Maths lives in plain functions (input in,
output out, no React, no Cesium viewer), and a thin component wires them to the screen. In
the fork, the maths lives inside a 3 000-line component and can't be tested
without starting Cesium. That's why it has zero tests.
*Review question: can the logic run in a test without a browser?*

## 4. Modular from PR 1? Yes, but don't over-abstract

Yes: body axes goes in its own files (`utils/attitude.ts`, `components/BodyAxes.tsx`)
with only a few lines added to `SatelliteVisualizer.tsx`. That costs nothing now
and shows Lucas you won't bloat his main file. But don't build frameworks for
features that don't exist yet (YAGNI, "you aren't gonna need it"). Rule of three:
only abstract once a pattern has appeared three times.
*Review question: does the main file grow by more than ~20 lines?*

## 5. Match the house style

In someone else's repo, consistency beats personal taste. Use their Prettier,
ESLint and file layout, and copy patterns from existing code: how options are declared
in `module.ts`, how tests mock Resium. Never reformat unrelated files, because
that hides your real change in noise. No new dependencies unless unavoidable.
*Review question: does the diff touch only lines related to the feature?*

## 6. Don't break existing users

Upstream is public, and people have dashboards on it. Every new option defaults
to today's behaviour (body axes **off**). The 8-column data contract stays
exactly as it is. Option names (`path` in `module.ts`) are effectively a public
API: once released, renaming one breaks saved dashboards.
*Review question: does an existing dashboard look identical after upgrading?*

## 7. TypeScript habits

Avoid `any`, which switches the type checker off (the fork uses it a lot).
Avoid `!` unless you can say why it's safe. Handle the `undefined` case instead.
Put units and frames in names: `lengthMeters`, `positionEcef`. Prefer small typed
interfaces at module boundaries, which is exactly what the adapter layer (`06-…`) is.
*Review question: any `any`, `!` or `as` casts? Each needs a reason.*

## 8. React habits

- Effects must list all their dependencies, and the lint rule enforces this.
- Effects that subscribe or start timers must clean up.
- Don't copy props into state: derive them.
- Create Cesium objects (`Color`, `CallbackProperty`, materials) in `useMemo`, not on every render. Otherwise Resium rebuilds entities each frame.
- For per-frame values, use a `CallbackProperty` rather than React state.

*Review question: does anything heavy get recreated on every render?*

## 9. Hygiene

No `console.log`, commented-out code, `.bak` files, or `TODO` without an owner.
Comments explain *why*, not *what*. Commit messages follow conventional commits.
Read your own diff before asking for review. Screenshots in the PR for anything visual.
CI must be green before asking Lucas to look.
*Review question: would I be comfortable if this diff were my public portfolio? (It is.)*

## 10. How to judge if testing is sufficient

1. Every new pure function has at least one test with a known answer.
2. Edge cases: missing data, zero, identity, undefined transform.
3. Each new option is tested on and off.
4. Bugs found later get a test *before* the fix.
5. Coverage of new code is roughly 80%+, but it's a hint, not a goal.

For body axes, that's roughly 6–10 tests.
