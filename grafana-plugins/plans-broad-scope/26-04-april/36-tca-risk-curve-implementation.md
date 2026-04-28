# TCA Risk Curve: Gaussian Timeseries Panel

**Difficulty: 3/10** — two small independent pieces with no tricky logic.

---

## New Grafana Plugin Required

Install the **Infinity datasource** — a community plugin that can query any REST JSON endpoint and map it to a Grafana timeseries. Run once on your Grafana container:

```bash
docker exec grafana grafana-cli plugins install yesoreyeram-infinity-datasource
docker restart grafana
```

No other dependencies. Infinity is the standard solution for querying custom APIs in Grafana without writing a full datasource plugin.

---

## Server Side: `/api/risk` Endpoint (`server.ts`)

Add a new route that accepts `from` and `to` query params (same as `/api/satellites`) and returns an array of `{ time: number, risk: number }` points. The risk value at each minute is:

```
risk(t) = exp( −(t − TCA)² / (2 · σ²) )
```

with `σ = 20 minutes` (1200 seconds). TCA is computed from the window midpoint exactly as in `generateScenario1`. One point per minute across the window gives ~720 points for a 12-hour window — lightweight. The response is plain JSON: `[{ time: ms, risk: 0.97 }, ...]`.

---

## Grafana Side

1. Add Infinity as a datasource (Settings → Data sources → Add → Infinity)
2. Create a new **Time series** panel
3. Query type: `JSON`, URL: `http://localhost:3001/api/risk?from=${__from}&to=${__to}`
4. Map `time` column as the time field, `risk` as the value field
5. Grafana's built-in `${__from}` and `${__to}` variables automatically pass the panel's current time range

The curve updates every time the Grafana time range changes and the peak always sits at TCA = window midpoint + 1h. No hardcoded timestamps, no static CSV.
