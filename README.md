# 3D Satellite Visualizer for Grafana

Real-time 3D visualization of satellite orbits, attitude, and sensor coverage as a Grafana panel plugin. Built on [CesiumJS](https://cesium.com/platform/cesiumjs/) and developed as part of aerospace engineering research at Instituto Superior Técnico.

**🌐 [Try the live demo](https://satellite-visualizer-demo.fly.dev/)** — no installation required.

![3D Satellite Visualization Demo](./grafana-plugins/3d-orbit-attitude-plugin/src/img/Grafana_Vis_Example.png)

> Built upon the original [Satellite Visualizer Plugin](https://github.com/lucas-bremond/satellite-visualizer) by **Lucas Brémond** (Apache 2.0). Extended with multi-satellite tracking, sensor FOV visualization, attitude displays, uncertainty ellipsoids, and scenario dashboards.

---

## Quick Start (5 minutes)

Requires [Docker & Docker Compose](https://docs.docker.com/get-docker/).

```bash
git clone https://github.com/dovskyrick/grafana-satellite-visualizer.git
cd grafana-satellite-visualizer/grafana-server
docker compose up -d
```

Open **http://localhost:3000** — login `admin` / `admin`. The plugin and six scenario dashboards are provisioned automatically.

> The plugin is pre-built and included in `dist/`. No build step needed.

---

## Repository Layout

```
grafana-satellite-visualizer/
├── grafana-plugins/
│   └── 3d-orbit-attitude-plugin/   # Grafana panel plugin (source + dist/)
├── mockup-digital-twin/            # Scenario API server (TypeScript, Fly.io)
├── satellite-data-generator/       # Optional local JSON test data
├── grafana-server/                 # Docker Compose + provisioned dashboards
└── README.md
```

---

## Documentation

| Component | README |
|-----------|--------|
| Panel plugin — data format, panel options, development | [grafana-plugins/3d-orbit-attitude-plugin/README.md](./grafana-plugins/3d-orbit-attitude-plugin/README.md) |
| Grafana server — Docker Compose, datasources, dashboards | [grafana-server/README.md](./grafana-server/README.md) |
| Mockup digital twin — HTTP API, Fly.io deployment | [mockup-digital-twin/README.md](./mockup-digital-twin/README.md) |
| Test data generator | [satellite-data-generator/README.md](./satellite-data-generator/README.md) |
| Roadmap | [ROADMAP.md](./grafana-plugins/3d-orbit-attitude-plugin/ROADMAP.md) |

---

## License

Apache License 2.0 — see [LICENSE](./grafana-plugins/3d-orbit-attitude-plugin/LICENSE) and [NOTICE](./grafana-plugins/3d-orbit-attitude-plugin/NOTICE).

Original work © 2024 Lucas Brémond. Enhancements © 2025 Ricardo Santos, Instituto Superior Técnico.
