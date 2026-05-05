# Fix: Tooltip Pin Missing on Deployed Grafana

## Problem

The timeseries tooltip pin (click to lock the crosshair in place) works locally but is absent on the deployed Fly.io instance. The root cause is two-fold:

1. **Feature toggle not in provisioning.** The `newVizTooltips` feature toggle — which enables tooltip pinning — was enabled locally through the Grafana UI (`Administration → Feature Toggles`). That UI state is saved inside the local `grafana-storage` Docker volume, not in any provisioned file, so it never reaches the deployed build.

2. **Grafana version mismatch.** `Dockerfile.fly` pins `grafana/grafana:10.0.3`, while local runs `grafana/grafana:latest` (currently 12.x). The `newVizTooltips` toggle was introduced in 10.2 and made stable in 11.x, so `10.0.3` does not have a reliable implementation of it regardless of the env var.

## Fix

### Step 1 — Add the feature toggle env var to `fly.toml`

```toml
[env]
  # existing vars …
  GF_FEATURE_TOGGLES_ENABLE = "newVizTooltips"
```

### Step 2 — Update the Grafana version in `Dockerfile.fly`

```dockerfile
FROM grafana/grafana:11.6.0
```

Pinning to `11.6.0` (or any stable 11.x release) keeps the build reproducible while guaranteeing the toggle is present and fully supported. Jumping straight to `latest` risks unexpected breaking changes on redeploy.

### Step 3 — Redeploy

```bash
fly deploy
```

No dashboard JSON changes are needed; this is purely infrastructure configuration.

## Why not fix it in the dashboard JSON?

Tooltip pinning is a **viewer interaction feature**, not a panel configuration option. It lives at the Grafana application level and cannot be declared per-panel in provisioned dashboard files.
