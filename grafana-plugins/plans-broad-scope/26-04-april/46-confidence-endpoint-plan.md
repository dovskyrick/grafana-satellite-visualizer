# Confidence Endpoint Plan

## Difficulty: 1/10

## Endpoint Design

`GET /api/confidence?scenario=1`

The `scenario` query parameter mirrors exactly what `/api/satellites` already accepts. No `from`/`to` — the confidence table is scenario metadata, not a time series. The time range is completely irrelevant here: last-observed times are absolute timestamps computed from `getTcaMs()` (same quantized slot as everything else), so they stay consistent with the Cesium view regardless of what window Grafana is displaying.

## Response Shape

A flat JSON array, one object per trajectory:

```json
[
  { "id": "SAT-1",   "source": "ESA Catalogue",   "confidence": "High",   "last_observed_offset": "TCA − 2h",  "ellipsoid_at_tca_m": 600  },
  { "id": "SAT-2-A", "source": "USSPACECOM TLE",  "confidence": "Low",    "last_observed_offset": "TCA − 4h",  "ellipsoid_at_tca_m": 700  },
  { "id": "SAT-2-B", "source": "Commercial Radar", "confidence": "Good",   "last_observed_offset": "TCA − 1.5h","ellipsoid_at_tca_m": 4000 },
  { "id": "SAT-2-C", "source": "ESA OD Service",   "confidence": "Good",   "last_observed_offset": "TCA − 45m", "ellipsoid_at_tca_m": 400  }
]
```

For scenario 0 (default 3-satellite view) the endpoint returns a generic single-row table or an empty array — to be decided.

## Grafana Side

- Infinity datasource, Type: JSON, Parser: Backend, Format: Table
- One Table panel, field overrides to colour-code the `confidence` column: High → green, Good → teal, Low → red
- No `from`/`to` needed in the Infinity URL — just `http://mockup-twin:3001/api/confidence?scenario=1`
