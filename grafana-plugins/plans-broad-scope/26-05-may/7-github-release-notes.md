# GitHub Release Notes — v1.1.0

Copy-paste the block below into the GitHub Release description field.

---

## Release title

```
v1.1.0 — Celestial map, ground station view, uncertainty ellipsoids & scenario dashboards
```

## Release body

```markdown
## What's new in v1.1.0

This release brings the plugin from a proof-of-concept orbit viewer to a full multi-scenario satellite operations dashboard, including a live public demo.

### 🗺️ Celestial Map View
Full 360°×180° SVG equirectangular sky map rendered from the satellite's perspective — sensor FOV rings, Sun/Moon markers, solar exclusion zone (15° keep-out cone), Earth exclusion band, and a zoomed/total-map toggle.

### 📡 Ground Station View
Polar-plot pass perspective centred on a selected ground station. Satellite passes shown as azimuth vs elevation arcs across the local sky.

### 📐 Uncertainty Ellipsoids
3D along-track / cross-track / radial orbital uncertainty rendered directly in the Cesium scene. Configurable opacity (High 70%, Medium 30%, Low 10%) and colour.

### 🛰️ Mock Digital Twin Integration
Six provisioned evaluation scenario dashboards driven by a live TypeScript/Express server deployed on Fly.io (`https://satellite-twin.fly.dev`). Scenario-specific orbital geometry, anomaly injection, and confidence inputs are all supported out of the box.

### ✨ Smaller additions
- Source reliability level slider (Scenario 2) — operator POSTs a source reliability value to the twin server
- Tooltip pinning — click to lock the 3D scene at a specific crosshair moment (Grafana 11+)
- Trajectory solid/dashed split — observed vs predicted segments rendered differently
- Per-satellite sensor cone transparency toggle
- Line-of-sight visibility in ground footprint view

---

## 🌐 Live demo

**[satellite-visualizer-demo.fly.dev](https://satellite-visualizer-demo.fly.dev/)** — no installation required.

## 🚀 Run locally

```bash
git clone https://github.com/dovskyrick/grafana-satellite-visualizer.git
cd grafana-satellite-visualizer/grafana-server
docker compose up -d
```

Open http://localhost:3000 — login `admin` / `admin`. Six scenario dashboards load automatically.

---

**Full changelog**: [CHANGELOG.md](./CHANGELOG.md)
```
