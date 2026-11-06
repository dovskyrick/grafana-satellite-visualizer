# Upstreaming: fork → Lucas Brémond's official plugin

Working notes for moving features from this fork into
[open-space-collective/satellite-visualizer](https://github.com/open-space-collective/satellite-visualizer),
one feature per pull request. This branch (`upstreaming`) only holds planning markdowns.

## Files

| File | Purpose |
| --- | --- |
| `01-gap-analysis.md` | How the fork and upstream differ today |
| `02-feature-roadmap.md` | Every feature split into PR-sized pieces, ordered, with difficulty |
| `03-pr1-plan.md` | Detailed plan for the first PR |
| `04-pr-quality-checklist.md` | What "clean for delivery" means for each PR |
| `05-eci-ecef-investigation.md` | Why the fork's quaternion frame differs from Lucas's |
| `06-data-adapter-interfaces.md` | Data interfaces (adapters): verdict and timeline |
| `07-eci-ecef-maths-and-policy.md` | Is ECI→ECEF maths risky? Where conversion should live |

## Two sides, two standards

**Here (fork):** messy is fine. Discussion, dead ends, rough notes.

**Upstream (Lucas):** one feature per PR, small diff, tests, README section,
conventional-commit messages (`feat:`, `fix:`, `test:`), lint + typecheck + tests green.

## Workflow per feature

Read fork code → write a port plan here → re-implement cleanly on a fresh
branch of upstream `main` (never copy the 3 000-line fork component whole) →
add tests → open PR from a GitHub fork of upstream → address Lucas's review →
log what was learned back here.
