# Infinity Panel Setup and Docker Dev Workflow

## Fixing the "Missing Time Field" in Infinity

The Infinity plugin has two parser modes and the column UI looks different depending on which is active. The most reliable path for a flat JSON array like ours:

1. In the query editor set **Type** to `JSON` and **Parser** to `Backend`
2. Set **Format** to `Time series`
3. Under **Columns**, add two entries:
   - Selector: `time` — Alias: `time` — Type: `Time`
   - Selector: `risk` — Alias: `risk` — Type: `Number`

If you are in **Default** parser mode instead, the UI shows a **Rows/Root** field (leave it empty for a flat array) and a columns table with the same two entries. The "missing time field" error usually means the `time` column type is set to `String` or `Number` instead of `Time` — changing it to `Time` fixes it.

One extra thing to check: our server returns `time` as a Unix millisecond integer. Infinity's `Time` column type handles this correctly as long as the value is in milliseconds. If it still doesn't work, try renaming the column alias to `Time` (capital T) — some Infinity versions are case-sensitive about the special time field name.

---

## Docker Dev Workflow — Do You Have to Restart Grafana?

No. Docker Compose lets you rebuild and restart individual services without touching the others:

```bash
docker-compose up -d --build mockup-twin
```

This rebuilds only the `mockup-twin` image from the Dockerfile, stops the old container, and starts a new one. Grafana never restarts, keeps all its sessions alive, and reconnects to the mockup server automatically on the next request. The private Docker network stays intact between the two containers throughout.

The only time you need `docker-compose down` + `up` for the whole stack is when you change `docker-compose.yml` itself (adding volumes, environment variables, ports, etc.) — those changes require the full stack to restart. Code changes to the mockup server only need `--build mockup-twin`.
