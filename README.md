# 3D Satellite Visualization for Grafana

A comprehensive suite for **real-time 3D visualization of satellite orbits, attitude, and sensor coverage** in Grafana. Built for satellite operations teams, aerospace researchers, and mission control dashboards.

[![Grafana](https://img.shields.io/badge/Grafana-Plugin-orange?logo=grafana)](https://grafana.com)
[![CesiumJS](https://img.shields.io/badge/CesiumJS-Powered-blue?logo=cesium)](https://cesium.com/platform/cesiumjs/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./grafana-plugins/3d-orbit-attitude-plugin/LICENSE)

**🌐 [Try Live Demo](https://satellite-visualizer-demo.fly.dev/)** - No installation required!

![3D Satellite Visualization Demo](./grafana-plugins/3d-orbit-attitude-plugin/src/img/Grafana_Vis_Example.png)

> **⚡ Built Upon**: This project extends and enhances the original [Satellite Visualizer Plugin](https://github.com/lucas-bremond/satellite-visualizer) by **Lucas Brémond** (Apache 2.0 License). We've added multi-satellite tracking, sensor FOV visualization, attitude displays, and advanced camera controls for aerospace research applications.

---

## 🎯 What's Included

### 1. [Satellite Visualization Plugin](./grafana-plugins/3d-orbit-attitude-plugin/)
**Main Grafana panel plugin** for 3D satellite visualization:
- Multi-satellite tracking with independent trajectories
- 3D sensor field-of-view visualization (cones, ground footprints, celestial projections)
- Real-time attitude display (body axes, quaternion orientation)
- Advanced camera controls (tracking mode, free camera, nadir view)
- RA/Dec celestial grid with coordinate labels
- Timeline scrubbing and animation controls

👉 **[Full Documentation](./grafana-plugins/3d-orbit-attitude-plugin/README.md)**

### 2. [Satellite Data Generator](./satellite-data-generator/)
**Standalone test data generator** with realistic Keplerian orbits:
- Generate multi-satellite trajectories with random parameters
- Configurable altitude, inclination, and orbital elements
- Automatic sensor definitions with varied FOV and orientations
- Output in Grafana-compatible JSON format

👉 **[Generator Documentation](./satellite-data-generator/README.md)**

### 3. [Grafana Server Setup](./grafana-server/)
**Docker Compose** stack that starts Grafana and the mock twin side by side:
- 3D plugin mounted from `dist/`
- Six scenario dashboards provisioned from JSON
- TestData and Infinity datasources pre-configured

👉 **[Grafana server guide](./grafana-server/README.md)**

### 4. [Mockup Digital Twin](./mockup-digital-twin/)
**HTTP simulation server** that generates orbital trajectories, collision-risk curves, confidence tables, link-health telemetry, and star-tracker anomaly series for the scenario dashboards. Runs locally in Docker and is deployed publicly on Fly.io.

👉 **[Twin server documentation](./mockup-digital-twin/README.md)**

---

## Thesis Evaluation Scenarios

The hosted demo ships **six provisioned dashboards**, each built for a distinct operator task (described in detail in the thesis text):

| Dashboard | Focus |
|-----------|--------|
| Free Exploration | Browse three satellites and ground stations with full 3D controls |
| Collision Risk Analysis | Conjunction screen — qualitative confidence pre-attributed to sources |
| Confidence Assessment | Same geometry — operator assigns confidence (stored briefly via API) |
| Communication Anomaly | Link telemetry vs attitude/antenna alignment |
| Star Tracker Anomaly | Celestial exclusion context vs attitude quality |
| Ground Station Antenna Anomaly | Pass geometry — anomaly attributed to ground hardware |

No manual data upload is required to run through a scenario.

---

## 🚀 Quick Start

### Option 1: Try Live Demo (Instant!)

**🌐 [satellite-visualizer-demo.fly.dev](https://satellite-visualizer-demo.fly.dev/)**

No installation needed. The deployment includes the scenario dashboards above and the full 3D visualizer (with sensors, attitude, celestial map, and cross-panel time sync where configured).

### Option 2: Run Locally (5 Minutes)

**What you get out-of-the-box:**
- Grafana with the 3D plugin loaded from `dist/`
- Mock digital twin + Grafana via **one** Compose command
- Six scenario dashboards provisioned automatically
- Works with the default Cesium base layer (no Ion token required)

### Prerequisites
- Docker & Docker Compose ([Install Guide](https://docs.docker.com/get-docker/))
- **(Optional)** Cesium Ion account - Only needed for premium base layers/maps ([Free Sign-up](https://cesium.com/ion/signup))

### Step 1: Clone Repository
```bash
git clone https://github.com/dovskyrick/grafana-satellite-visualizer.git
cd grafana-satellite-visualizer
```

> **Note**: The plugin is pre-built and included in the repository. No build step required!

### Step 2: Start Grafana and the mock twin
```bash
cd grafana-server
docker compose up -d
```

**Access Grafana:** http://localhost:3000 — login `admin` / `admin`.

> **Tip:** To watch startup logs, run `docker compose up` (without `-d`).

### Step 3: Open a dashboard

Under **Dashboards**, open **Free Exploration** or any **scenario** dashboard. Scenario panels load data from the public mock twin on Fly.io (`satellite-twin.fly.dev`); ensure your machine has internet access.

> **Optional:** For premium Cesium imagery or terrain, add a Cesium Ion token in the panel options ([signup](https://cesium.com/ion/signup)). The default globe works without it.

👉 **[Grafana server details](./grafana-server/README.md)** · **[Plugin quick start](./grafana-plugins/3d-orbit-attitude-plugin/README.md#-quick-start)**

---

## ✨ Key Features

### Multi-Satellite Support
Track multiple satellites simultaneously with individual control:
- ✅ Independent trajectories and time intervals
- ✅ Per-satellite visibility toggles
- ✅ Sidebar menu for satellite selection
- ✅ Color-coded paths and labels

### Sensor Visualization
Understand what your sensors are observing:
- 📡 **3D FOV Cones**: Attached to satellite body with quaternion orientation
- 🌍 **Ground Footprints**: Project sensor FOV onto Earth with horizon detection
- ⭐ **Celestial Projections**: Show observed sky region on celestial sphere
- 🎨 **Customizable**: Colors, transparency, FOV angles

### Advanced Camera Controls
Navigate the 3D scene with ease:
- 🎯 **Tracking Mode**: Follow selected satellite
- 🌍 **Free Camera**: Orbit Earth with smooth transitions
- 🛰️ **Nadir View**: Quick overhead view of tracked satellite
- 📏 **Dynamic Scaling**: Vectors/cones scale with camera distance

### Attitude Visualization
Real-time orientation display:
- 🧭 Body axes (X, Y, Z) with customizable colors
- 📐 RA/Dec celestial coordinate grid
- 🔄 Quaternion-based orientation updates
- 🎛️ Master toggle for all attitude features

### Grafana Integration
Seamless integration with Grafana ecosystem:
- ⏱️ Native timeline controls
- 🔄 Settings persistence (no timeline reset)
- ⏱️ Cross-panel hover sync with time series (shared crosshair)
- 📊 TestData for local JSON experiments; **Infinity** + mock twin for scenario dashboards
- 🎨 Extensive panel options

---

## 📚 Documentation

- **[Plugin README](./grafana-plugins/3d-orbit-attitude-plugin/README.md)** — Panel plugin (data format, options, development)
- **[Grafana server](./grafana-server/README.md)** — Docker Compose, datasources, provisioned dashboards
- **[Mockup digital twin](./mockup-digital-twin/README.md)** — HTTP API and Fly.io deployment
- **[ROADMAP](./grafana-plugins/3d-orbit-attitude-plugin/ROADMAP.md)** — Planned improvements
- **[Data generator](./satellite-data-generator/README.md)** — Local JSON test data

---

## 🎓 Use Cases

### Satellite Operations
- **Mission Control Dashboards**: Real-time satellite tracking
- **Telemetry Monitoring**: Visualize position, attitude, and sensor status
- **Multi-Satellite Coordination**: Track constellations and formations

### Aerospace Research
- **Orbit Dynamics**: Study orbital mechanics and perturbations
- **Sensor Coverage Analysis**: Evaluate ground coverage and observation windows
- **Attitude Control**: Analyze spacecraft orientation and stability

### Education & Training
- **Orbital Mechanics**: Interactive demonstrations for students
- **Mission Simulation**: Training tools for operators
- **Space Systems Engineering**: Visualize satellite subsystems

---

## 🛠️ Technology Stack

- **[CesiumJS](https://cesium.com/platform/cesiumjs/)** — 3D globe and orbit rendering
- **[Resium](https://resium.reearth.io/)** — React bindings for Cesium
- **[Grafana](https://grafana.com/)** — Dashboard host and time controls
- **[Infinity datasource](https://grafana.com/grafana/plugins/yesoreyeram-infinity-datasource/)** — JSON from the mock twin into panels
- **[React](https://react.dev/)** & **[TypeScript](https://www.typescriptlang.org/)** — Plugin UI
- **Node.js / Express** — Mock digital twin server
- **[Fly.io](https://fly.io/)** — Hosted Grafana + twin for the public demo

---

## 📁 Repository Structure

```
grafana-satellite-visualizer/
├── grafana-plugins/
│   └── 3d-orbit-attitude-plugin/    # 3D panel plugin (source + committed dist/)
├── mockup-digital-twin/             # Scenario API server (TypeScript, Fly.io)
├── satellite-data-generator/        # Optional local JSON test data
├── grafana-server/                  # docker compose + provisioned dashboards
│   ├── docker-compose.yml
│   └── provisioning/
└── README.md
```

---

## 🐛 Troubleshooting

### Common Issues

**Plugin doesn't appear in Grafana:**
- Ensure containers are up: `docker compose ps` (from `grafana-server/`)
- Rebuild the plugin: `cd grafana-plugins/3d-orbit-attitude-plugin && npm run build`
- Restart Grafana: `cd ../../grafana-server && docker compose restart grafana`
- View logs: `docker compose logs grafana`

**"Invalid Access Token" error:**
- This only occurs if you try to use premium Cesium base layers/textures
- The default base layer works without any token
- If you need premium maps: Get token from [Cesium Ion](https://cesium.com/ion/tokens)
- Verify token permissions and paste carefully (no extra spaces)

**Timeline resets when changing settings:**
- Update to latest version (this bug was fixed)
- Run: `git pull && cd grafana-plugins/3d-orbit-attitude-plugin && npm install && npm run build`
- Restart Grafana to load new build

**Satellites don't appear:**
- Verify JSON format matches [specification](./grafana-plugins/3d-orbit-attitude-plugin/README.md#-data-format)
- Check timestamps are Unix milliseconds
- Ensure coordinates are in correct frame (Geodetic/ECEF/ECI)
- Open browser console for parsing errors

👉 **[Full Troubleshooting Guide](./grafana-plugins/3d-orbit-attitude-plugin/README.md#-troubleshooting)**

---

## 🤝 Contributing

This plugin is part of ongoing aerospace engineering research. **Your feedback directly contributes to research!**

### How You Can Help

1. **Try the plugin** with your satellite data
2. **Report issues** and bugs
3. **Request features** you'd find useful
4. **Share use cases** and screenshots
5. **Contribute code** via pull requests

### Development Setup

```bash
# Clone repository
git clone https://github.com/dovskyrick/grafana-satellite-visualizer.git
cd grafana-satellite-visualizer

# Install dependencies for plugin
cd grafana-plugins/3d-orbit-attitude-plugin
npm install

# Build plugin (required for Grafana to use it)
npm run build

# Start Grafana
cd ../../grafana-server
docker compose up
```

**For active development** (if you're modifying plugin code):
```bash
# In the plugin directory, use watch mode for auto-rebuild
cd grafana-plugins/3d-orbit-attitude-plugin
npm run dev

# In another terminal, start Grafana
cd ../../grafana-server
docker compose up
```

With `npm run dev`, changes to plugin source will auto-rebuild. Refresh Grafana to see updates.

---

## 📄 License

This project is licensed under the **Apache License 2.0** - see individual component licenses for details.

### License Information

- **Satellite Visualization Plugin**: Apache License 2.0
  - Original work: Copyright © 2024 Lucas Brémond
  - Enhancements: Copyright © 2025 Ricardo Santos, Instituto Superior Técnico
  - Based on [Satellite Visualizer Plugin](https://github.com/lucas-bremond/satellite-visualizer)
- **Satellite Data Generator**: MIT License (new component)
- **Grafana Server Setup**: Docker configuration (no license required)

See [LICENSE](./grafana-plugins/3d-orbit-attitude-plugin/LICENSE) and [NOTICE](./grafana-plugins/3d-orbit-attitude-plugin/NOTICE) files for full legal details.

---

## 🙏 Acknowledgments

### Original Work

This project is built upon:
- **[Satellite Visualizer Plugin](https://github.com/lucas-bremond/satellite-visualizer)** by **Lucas Brémond**
  - Original CesiumJS-based 3D satellite visualization for Grafana
  - Copyright © 2024 Lucas Brémond, Apache License 2.0
  - Provided the foundation for all 3D rendering and Grafana integration

### Additional Thanks

- **NASA** for providing the ACRIM satellite 3D model
- **CesiumJS** team for the incredible 3D geospatial platform
- **Grafana Labs** for the extensible visualization framework
- **Resium** project for React-CesiumJS integration
- **Aerospace engineering community** for feedback and support

---

## 📧 Contact & Support

**Author**: Ricardo Santos  
**Institution**: Instituto Superior Técnico  
**Email**: feedback@dovsky.com  
**Repository**: https://github.com/dovskyrick/grafana-satellite-visualizer

- **GitHub Issues**: [Report bugs and request features](https://github.com/dovskyrick/grafana-satellite-visualizer/issues)
- **Discussions**: Ask questions and share ideas
- **Email**: feedback@dovsky.com

---

## 🌟 Star This Repository!

If you find this project useful, please ⭐ star the repository to help others discover it!

---

## 📊 Project Status

- ✅ **Production Ready**: Core features stable and tested
- 🔬 **Active Research**: Part of ongoing thesis work
- 🎓 **Academic Use**: Suitable for research and education
- 🚀 **Community Driven**: Seeking feedback for improvements

**Current Version**: 1.2.0  
**Last Updated**: May 6, 2026

---

**Built with ❤️ for the aerospace community**

