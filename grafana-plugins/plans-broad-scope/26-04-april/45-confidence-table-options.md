# Confidence Table Display Options

## The Three Options

### Option A — Static HTML/Markdown in a Text Panel
Paste a hand-written HTML table directly into a Grafana Text panel set to HTML mode. No server changes, no datasource, done in two minutes. The downside is it is completely static: if you later change the scenario parameters (last observed times, satellite names) the table silently goes out of sync with the actual data. For a prototype demo that is acceptable, but it creates a maintenance debt and looks a little cheap next to the dynamic Cesium panel.

### Option B — New API Endpoint + Table Panel
Add a `/api/confidence` endpoint to the mockup server returning a small JSON array — one row per trajectory with fields like `id`, `source`, `confidence`, `last_observed`, `ellipsoid_at_tca`. Wire it to Grafana via Infinity datasource and use a native Table panel. This takes maybe 20 minutes to implement, all data lives in one place (the server), and the table automatically stays consistent with whatever the server returns. It also looks professional and is closer to what a real digital twin would expose. The operator sees a properly styled Grafana table with colour-coded confidence cells if you use field overrides.

### Option C — Grafana Transformations on Existing Data
Derive the table from data already returned by `/api/satellites` using Grafana transformations (extract last observed time, add static confidence as a field override). Clever but fragile and hard to debug.

## Recommendation

**Option B.** The endpoint is trivial to write (a static JSON array, no computation), and the payoff is large: the table becomes a real panel citizen that shares the Grafana time range, can be themed, and demonstrates that your digital twin exposes structured metadata — which is exactly what you would show to evaluators. The 20-minute investment is worth it over a static paste that will inevitably drift.
