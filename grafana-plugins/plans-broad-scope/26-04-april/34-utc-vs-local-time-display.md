# UTC vs Local Time in Satellite Operations UI

## Industry Standard

Real satellite operations software — GMAT, CCSDS ground systems, ESA's SCOS-2000, NASA's AMMOS — displays all timestamps in **UTC universally**. The reason is operational: a conjunction event happens at a single moment in physics. If the operator in Lisbon sees "23:30 WEST" and the colleague in Houston sees "17:30 CDT" and the flight dynamics report says "22:30 UTC", someone will make an arithmetic error under pressure. UTC eliminates that class of mistake entirely. All TLE epochs, manoeuvre windows, contact windows, and conjunction alerts are published in UTC. Operators in this domain expect UTC and are trained to think in it.

## The Grafana/Cesium Mismatch Problem

The current situation — Grafana showing local time (Portugal WEST = UTC+1) while Cesium shows UTC — is genuinely confusing. If the timeline pointer sits at "20:00" in a Grafana panel and the Cesium clock shows "19:00", a new operator will spend cognitive effort wondering whether there is a data inconsistency or a display bug. There is neither, but the mismatch erodes trust in the tool.

## Recommendation

Set **both Grafana and Cesium to UTC**. In Grafana this means setting the dashboard timezone to UTC (Dashboard Settings → Time options → Timezone → UTC). Cesium already shows UTC by default. Once aligned, the Grafana timeline pointer and the Cesium clock will always agree to the second, which is the correct baseline for a space operations prototype. A small static label in the UI reading "All times UTC" is enough to orient any operator.

Local time can optionally appear in ground station contact windows as a secondary label, but the primary time axis should always be UTC.
