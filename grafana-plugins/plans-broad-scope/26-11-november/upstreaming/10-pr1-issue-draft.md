# 10 — Issue draft for PR 1 (body axes)

Short is right. Lucas already knows the context from your meeting. The issue is
a public record of scope, not a pitch. Paste the block below as is.

---

**Title:** `feat: visualize satellite attitude with body axes`

**Body:**

> Following our conversation, this is the first of a series of small PRs
> bringing features from my thesis fork into this plugin, one at a time.
>
> **Proposal:** an optional overlay of the satellite body X/Y/Z axes, drawn from
> the existing orientation data. No data format change; off by default.
>
> **Why:**
> - Check that the 3D model is oriented consistently with the attitude data.
> - Inspect attitude visually, independent of the model's shape.
> - Groundwork for sensor FOV and footprint features, which depend on correctly
>   rendered body directions.
>
> **Next:** a refactor of data parsing into small adapters (no behaviour change),
> to prepare multi-satellite support.
>
> Happy to adjust scope before I open the PR.

---

## Notes

- One "groundwork" bullet is enough. Justifying features by the roadmap is fine
  when it's short and true, but avoid making the whole case about future work.
- The "Next" line tells Lucas the plan without asking him to approve it now.
- Wait a day or two for a reaction. If none, open the PR and link it with `Closes #<n>`.
