# Scenario 1: Remove Duration Cap

Agreed. For scenario 1, bypassing `MAX_DURATION_S` is the right call. The cap exists to protect the default scenario from generating thousands of points for absurdly wide windows, but scenario 1 already sizes its arcs dynamically from the actual `fromMs`/`toMs` — so capping just silently corrupts `toMs` and causes invisible data loss, which is the worst kind of bug. A slow response is always preferable to missing data with no explanation.

The fix is one line: in `generateTrajectory`, pass the raw `toMs` to `generateScenario1` and skip the `durationSeconds` cap entirely for that branch. The cap stays in place for the default scenario, which still benefits from it.
