# Confidence Table — Final Column Order

| Trajectory ID | Confidence | Ellipsoid at TCA | Time Since Last Obs | Source |
|---|---|---|---|---|
| SAT-1   | High | 600 m  | 2h 30m | ESA Catalogue    |
| SAT-2-A | Low  | 700 m  | 6h 30m | USSPACECOM TLE   |
| SAT-2-B | Good | 4.0 km | 3h 00m | Commercial Radar |
| SAT-2-C | Good | 400 m  | 2h 15m | ESA OD Service   |

## Notes

- `Ellipsoid at TCA` — the `ell_along` semi-axis value at TCA, formatted as `"m"` below 1000 and `"km"` above (e.g. `"600 m"`, `"4.0 km"`).
- `Time Since Last Obs` — computed server-side as `Date.now() - lastObservedMs` at request time, formatted as `"Xh Ym"`. Refreshes on every dashboard reload.
- `Source` — last column, least operationally urgent, so pushed to the right.
- No color encoding for now — can be added later via Grafana value mappings on the `Confidence` column.
