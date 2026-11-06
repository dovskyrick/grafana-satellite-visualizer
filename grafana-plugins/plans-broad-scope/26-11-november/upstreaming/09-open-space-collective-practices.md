# 09 — Open Space Collective house practices

From skimming [open-space-toolkit](https://github.com/open-space-collective/open-space-toolkit)
(CONTRIBUTING.md, workflows, notebooks) and the satellite-visualizer history.
Only things *not* already in `08-…`.

## 1. Linear history: rebase and squash

CONTRIBUTING says they "prefer to rebase and squash instead of merge commits".
Upstream confirms it: outside PRs land as one commit, e.g.
`feat: migrate plugin for Grafana 13 / React 19 compatibility (#12)`. So our PR
title becomes the permanent commit message. Write it carefully. Before pushing,
rebase onto latest `main` (`git rebase origin/main`), never merge `main` into the branch.

## 2. Stricter commit message rules

On top of conventional commits: present tense, imperative mood ("add body axes",
not "added"), first line at most 72 characters, and reference issues and PRs after
the first line. Lucas uses the types `feat`, `fix`, `build`, `chore`. Plain version
commits (`1.12.0`) are his release mechanism, so never bump the version in a PR.

## 3. Issue before pull request

Their contribution flow starts with an enhancement issue: clear title,
step-by-step description, current vs expected behaviour, and **why it's useful
to most users**, not only to us. Suggestion: open a short issue "Visualize
attitude with body axes" first, link the PR to it, and let Lucas comment on scope
before code review.

## 4. Frame naming: `X_A_B` reads right to left

OSTk's ECI→ECEF notebook writes `transform_ECEF_ECI = eci.get_transform_to(ecef)`,
meaning "transform *from* ECI *to* ECEF". Lucas's `DCM_ECI_ECEF` follows the same house
convention, so **correction to my earlier chat note**: don't rename to
`R_ecefFromEci`. Use his `X_A_B` naming. Whether OSTk attitude quaternions are
active or passive is still open, which goes with the future rotation-test work.

## 5. "ECI" means a named frame

OSTk never says just "ECI". It picks `Frame.GCRF()` and lists `MOD`, `TOD` and
`TEME` as alternatives, with `ITRF` for ECEF. Write docs and README text the same
way: "attitude given in GCRF (ECI)", "position in ITRF (ECEF)". This also matches
the precision point in `07-…`: the frame name *is* the contract.

## 6. Cross-platform validation

OSTk validates itself against other tools: `Cross Platform Validation` notebooks
compare results with **GMAT** and **Orekit** reference data. This is the answer to
your future "visually check rotations are right" goal. Generate reference
quaternions and positions with OSTk's Python package, commit them as JSON fixtures,
and assert the plugin's conversion matches. That's credible to Lucas because it's his toolkit.

## 7. Explicit "undefined" instead of crashing

Their C++ idioms (named constructors like `MyClass::Undefined()`, `isDefined()`
testers) make "no value" an explicit, checked state. The TypeScript equivalent is
to return `undefined` or a result with a warning and check it, rather than `!` or
throwing mid-render. It fits replacing the `!` on `computeFixedToIcrfMatrix`
in the adapter PR.

## 8. Reproducible dev environment through `make`

Everything runs through Docker and the Makefile: `make dev` starts the dev
container, and OSTk has `make format`, enforced by CI. In satellite-visualizer CI also runs
typecheck, lint, unit tests, build, **signing**, and Playwright E2E on several
Grafana versions. Run the same commands locally before every push, and test the
provisioned dashboard in `make dev` for screenshots.

## 9. Reviewer can ask for more

CONTRIBUTING notes the reviewer "may ask you to complete additional design work,
tests, or other changes before your pull request can be ultimately accepted."
Expect at least one review round. Reply to each comment, push fixes as new
commits during review (squash happens at merge), and don't take scope requests
personally. Lucas's CTO time is the scarce resource, so make each round easy.
