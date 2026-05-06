# 3D Orbit & Attitude Visualization Plugin for Grafana

A powerful Grafana panel plugin for **real-time 3D visualization of satellite orbits, attitude, and sensor field-of-view** projections. Built on [CesiumJS](https://cesium.com/platform/cesiumjs/) for high-performance geospatial rendering.

**🌐 [Try Live Demo](https://satellite-visualizer-demo.fly.dev/)** — No installation required!

![3D Satellite Visualization](./src/img/Grafana_Vis_Example_2.png)

> **⚡ Based On**: This plugin is an **extended and enhanced version** of the original [Satellite Visualizer Plugin](https://github.com/lucas-bremond/satellite-visualizer) by **Lucas Brémond**. We've added multi-satellite support, sensor visualization, attitude displays, and advanced camera controls. All original work remains under **Apache License 2.0** © 2024 Lucas Brémond.

---

## 🎯 Why This Plugin?

Traditional satellite monitoring tools are limited to 2D ground tracks or abstract data plots. This plugin provides:

- **True 3D Visualization**: See satellite position, orientation, and sensor coverage in real-time 3D
- **Multi-Satellite Support**: Track and compare multiple satellites simultaneously
- **Sensor Field-of-View**: Visualize what your sensors are observing (ground footprints & celestial projections)
- **Attitude Awareness**: Display body axes (X/Y/Z) and orientation relative to Earth
- **Time Synchronization**: Scrub through mission timelines with Grafana's native time controls

Perfect for satellite operations teams, aerospace researchers, and mission control dashboards.

---

## ✨ Features

### 🛰️ Multi-Satellite Tracking
- Display multiple satellites with independent trajectories
- Sidebar menu for satellite selection and visibility control
- Individual tracking mode per satellite
- Color-coded trajectories and labels

### 📡 Sensor Visualization
- **3D Sensor Cones**: Render field-of-view as 3D cones attached to satellite body
- **Ground Footprints**: Project sensor FOV onto Earth surface with horizon detection
- **Celestial Projections**: Show observed sky region on celestial sphere
- Configurable colors, transparency, and FOV angles
- Support for unlimited sensors per satellite

### 🎥 Advanced Camera Controls
- **Tracking Mode**: Follow satellite with camera locked to position
- **Free Camera Mode**: Orbit Earth with smooth transitions
- **Nadir View**: Quick jump to overhead view of tracked satellite
- Dynamic camera-distance scaling for vectors and cones

### 🧭 Attitude Visualization
- Display satellite body axes (X, Y, Z) with customizable colors
- Real-time quaternion-based orientation
- RA/Dec celestial grid with coordinate labels
- Master toggle for all attitude-related visualizations

### 🌍 Earth Visualization
- Multiple base layer options (Blue Marble, Satellite, OpenStreetMap)
- Toggle labels and place names
- Terrain visualization support
- Day/night shading

### ⏱️ Timeline & Animation
- Cesium's built-in animation controls
- Timeline scrubber for precise time navigation
- Settings changes don't reset animation timeline
- Persistent camera position across panel updates

### 🔗 Cross-Panel Hover Sync
- Hover over any time series panel to scrub the 3D scene to that exact timestamp
- Satellite position, attitude, and sensor cones all update in real time as you move the cursor
- Works with Grafana's native **Shared Crosshair** feature — no extra plugins needed
- Controlled via the **Subscribe to data hover event** toggle in panel options (on by default)
- **Tooltip pinning**: click the tooltip to lock it at a specific moment while you inspect the 3D view

### 🗺️ Celestial Map View
A 2D equirectangular (360°×180°) star-field map rendered as an SVG overlay, showing the full celestial sphere from the satellite's perspective:
- **RA/Dec grid** with coordinate labels
- **Sensor FOV rings** projected onto the sky — one per sensor, with name labels and colour coding
- **Sun and Moon markers** with position labels
- **Solar exclusion zone** — 15° keep-out cone around the Sun, shown as a dashed gold ring with legend entry
- **Earth exclusion zone** — below-horizon region blocked by the Earth disc, shown as a coloured band
- **Zoomed / total-map toggle** — switch between full 360° overview and a zoomed-in detail view
- Welcome modal on first open explaining the view

### 📡 Ground Station View
A polar-plot perspective centred on a selected ground station:
- Shows satellite passes as arcs across the local sky (azimuth vs elevation)
- Ground station selection and tracking in the sidebar
- Separate settings modal per ground station

### 📐 Uncertainty Ellipsoids
Visualize orbital uncertainty directly in 3D:
- Along-track, cross-track, and radial semi-axes rendered as transparent 3D ellipsoids
- Opacity mode selectable per panel (`High` 70%, `Medium` 30%, `Low` 10%)
- Colour customizable; scales with the data stream over time

### 🛰️ Scenario Mode (Mock Digital Twin Integration)
The plugin can be pointed at a mock digital twin server to drive scenario-specific behaviour:
- **`digitalTwinUrl`** panel option sets the server base URL
- **`scenarioId`** selects scenario-specific satellite data, anomaly injection, and orbital geometry
- Scenarios 3 & 5: antenna orientation automatically overrides body attitude to track the ground station
- Scenario 4: body attitude automatically overrides to sun-pointing; star-tracker exclusion shown on celestial map
- Scenario 2: source reliability level slider in the satellite settings modal POSTs to the server

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Docker & Docker Compose**: For running self-hosted Grafana
  - [Install Docker](https://docs.docker.com/get-docker/)
  - [Install Docker Compose](https://docs.docker.com/compose/install/)
- **Cesium Ion Access Token**: Free account at [Cesium Ion](https://cesium.com/ion/)
  - Sign up at [https://cesium.com/ion/signup](https://cesium.com/ion/signup)
  - Navigate to **Access Tokens** in your account settings
  - Copy your default access token (or create a new one)
- **Basic Terminal Knowledge**: For running setup commands
- **(Optional)** Node.js & npm: For generating custom test data or developing the plugin
- **(Optional)** Cesium Ion Access Token: Only needed for premium base layers/maps

---

## 🚀 Quick Start

### Step 1: Set Up Self-Hosted Grafana

This plugin requires a **self-hosted Grafana instance** because it's not yet published to the official Grafana plugin catalog. Self-hosting allows you to run unsigned/development plugins.

#### 1.1 Clone This Repository

```bash
git clone https://github.com/dovskyrick/grafana-satellite-visualizer.git
cd r3f-test/grafana-server
```

#### 1.2 Start Grafana with Docker Compose

The project includes a pre-configured `docker-compose.yml`:

```bash
docker-compose up -d
```

This starts Grafana on **http://localhost:3000** with:
- Default credentials: `admin` / `admin` (you'll be prompted to change on first login)
- Plugin directory mounted from `../grafana-plugins`
- Unsigned plugins enabled

> **🔄 Live Development**: The plugin's `dist/` folder is mounted directly into the Grafana container. This means you can rebuild the plugin (`npm run build`) and just refresh your browser to see changes - no need to restart the Docker container!

#### 1.3 Access Grafana

Open your browser to [http://localhost:3000](http://localhost:3000) and log in.

---

### Step 2: Install the Plugin

The plugin is automatically loaded if you started Grafana from the project's `docker-compose.yml`. 

To verify:
1. Go to **Configuration** → **Plugins**
2. Search for "Satellite"
3. You should see **"Satellite Visualization"**

> **Note**: If the plugin doesn't appear, ensure the `grafana-plugins/3d-orbit-attitude-plugin/dist` folder exists. You may need to build the plugin first (see Development section).

---

### Step 3: Add Test Data

The plugin uses Grafana's **TestData** data source for easy experimentation.

#### Option A: Use Pre-Generated Data (Fastest)

We provide pre-generated multi-satellite test data in the repository:

1. **Navigate to**: `satellite-data-generator/output/`
2. **Copy contents** of `multi-satellite.json` (3 satellites) or `many-satellites.json` (14 satellites)
3. In Grafana:
   - Go to **Explore** or create a new **Dashboard**
   - Add a **TestData DB** data source (pre-configured by default)
   - Select scenario: **"JSON API"**
   - Paste the copied JSON into the **"JSON"** text area
   - Click **Run Query**

#### Option B: Generate Custom Data

Generate your own trajectories with custom parameters:

```bash
cd satellite-data-generator
npm install
npm run generate          # 3 satellites, 10-30 points each
npm run generate:many     # 14 satellites, 20 points each
npm run generate:single   # 1 satellite
npm run generate:9h       # 3 satellites covering the past 9 hours (for hover sync testing)
```

Generated files appear in `satellite-data-generator/output/`. Then follow **Option A** to load them.

---

### Step 4: Create a 3D Visualization Panel

1. **Create a Dashboard** (or edit an existing one)
2. **Add a Panel**
3. **Select Visualization**: Choose **"Satellite Visualization"**
4. **Configure Data Source**:
   - Select **TestData DB**
   - Scenario: **JSON API**
   - Paste your satellite JSON
5. **Configure Panel Settings** (right sidebar):
   - **Show Trajectory**: Toggle trajectory paths
   - **Show Attitude Visualization**: Enable sensor cones, axes, FOV projections
   - **(Optional) Access Token**: Only needed for premium Cesium base layers/textures
6. **Save Dashboard**

> **💡 Cesium Token**: The plugin works immediately with the default base layer. You only need a Cesium Ion token if you want to use premium satellite imagery or terrain maps.

---

## 📊 Data Format

The plugin expects JSON data with the following structure:

### Multi-Satellite Format (Recommended)

```json
[
  {
    "satelliteId": "sat-1",
    "satelliteName": "Starlink-4021",
    "meta": {
      "custom": {
        "sensors": [
          {
            "id": "sat1-sens0",
            "name": "Main Camera",
            "fov": 15,
            "orientation": { "qx": 0, "qy": 0, "qz": 0, "qw": 1 }  // sensor body-relative quaternion
          }
        ]
      }
    },
    "columns": [
      { "text": "time", "type": "time" },
      { "text": "longitude", "type": "number" },
      { "text": "latitude", "type": "number" },
      { "text": "altitude", "type": "number" },
      { "text": "qx", "type": "number" },
      { "text": "qy", "type": "number" },
      { "text": "qz", "type": "number" },
      { "text": "qs", "type": "number" }
    ],
    "rows": [
      [1734450000000, -120.5, 37.2, 550000, 0, 0, 0, 1],
      [1734450030000, -119.8, 38.1, 552000, 0.01, 0.02, 0.01, 0.9995],
      ...
    ]
  },
  ...
]
```

### Column Descriptions

| Column # | Name      | Type   | Description                                           | Units     |
|----------|-----------|--------|-------------------------------------------------------|-----------|
| 1        | time      | time   | Unix timestamp (milliseconds)                         | ms        |
| 2        | longitude | number | Longitude (geodetic) / x (ECI/ECEF)                   | deg / m   |
| 3        | latitude  | number | Latitude (geodetic) / y (ECI/ECEF)                    | deg / m   |
| 4        | altitude  | number | Altitude above ellipsoid (geodetic) / z (ECI/ECEF)    | m         |
| 5-8      | qx,qy,qz,qs  | number | Orientation quaternion (x, y, z, scalar components)         | unitless  |
| 9        | ell_along    | number | Uncertainty ellipsoid along-track semi-axis (optional)      | m         |
| 10       | ell_cross    | number | Uncertainty ellipsoid cross-track semi-axis (optional)      | m         |
| 11       | ell_radial   | number | Uncertainty ellipsoid radial semi-axis (optional)           | m         |

### Sensor Definitions (Optional)

Sensors are defined in `meta.custom.sensors`:

```json
{
  "id": "unique-sensor-id",
  "name": "Display Name",
  "fov": 15,  // Half-angle in degrees
  "orientation": {
    "qx": 0,
    "qy": 0,
    "qz": 0,
    "qw": 1   // sensor body-relative quaternion (scalar component)
  }
}
```

**Orientation**: Quaternion describing sensor pointing direction **relative to satellite body frame**. The plugin automatically combines this with the satellite's attitude to compute the sensor's inertial orientation.

---

## ⚙️ Panel Settings

### Data Settings

- **Coordinates Type**: Geodetic (default), Cartesian Fixed (ECEF), or Cartesian Inertial (ECI)
- **Model Asset Mode**: Point, 3D Model (Cesium Ion), or 3D Model (URI)
- **Asset ID**: Cesium Ion asset ID for 3D satellite models
- **Access Token**: Cesium Ion token (optional - only needed for premium base layers/textures or Cesium Ion 3D models)

### Trajectory Settings

- **Show Trajectory**: Display satellite path
- **Trajectory Width**: Line thickness
- **Trajectory Color**: Path color
- **Trajectory Dash Length**: Dashed line pattern

### Attitude Visualization (Master Toggle)

- **Show Body Axes**: Display X/Y/Z axes from satellite center
- **X/Y/Z Axis Colors**: Customize axis colors
- **Show Sensor Cones**: Render 3D FOV cones
- **Show FOV Footprint**: Project FOV onto Earth surface
- **Show Celestial FOV**: Project FOV onto celestial sphere
- **Show RA/Dec Grid**: Display celestial coordinate grid
- **Grid Spacing**: RA/Dec grid density
- **Show Grid Labels**: Toggle coordinate labels

### Uncertainty Ellipsoid Settings

- **Show Uncertainty Ellipsoids**: Toggle 3D ellipsoid rendering
- **Uncertainty Opacity Mode**: High (70%), Medium (30%), Low (10%)
- **Uncertainty Color**: Fill colour for all ellipsoids

### Scenario / Digital Twin Settings

- **Digital Twin URL**: Base URL for the mock digital twin server (e.g. `https://satellite-twin.fly.dev`). Leave empty to use only the Grafana datasource data.
- **Scenario ID**: Selects the orbital geometry and scenario-specific behaviour (0 = default, 1–5 = evaluation scenarios)

### Cesium UI Controls

- **Show Animation**: Animation play/pause controls
- **Show Timeline**: Timeline scrubber
- **Show Base Layer Picker**: Earth texture selector
- **Show Scene Mode Picker**: 2D/3D/Columbus view toggle
- **Show Projection Picker**: Perspective/orthographic toggle


---

## 🎮 Using the Plugin

### Camera Modes

**Tracking Mode** (🎯):
- Camera follows the selected satellite
- Vectors/cones scale to fixed size (2m)
- Click satellite in sidebar to switch tracked target

**Free Camera Mode** (🌍):
- Orbit around Earth freely
- Camera-distance-based scaling for visibility
- Smooth transition with nadir view

**Nadir View** (🛰️):
- Jump to overhead view of tracked satellite
- Configurable via panel settings

### Sidebar Menu

- **Toggle Sidebar**: Click the menu button (☰) in top-right
- **Select Satellite**: Click any satellite entry to track it
- **Hide/Show Satellites**: Click the visibility toggle (◉/○) for each satellite
- **Tracking Indicator**: 🎯 shows which satellite is currently tracked
- **Satellite Settings**: Click the ⚙ gear icon on any satellite to open the settings modal (transparent cones, source reliability level slider for Scenario 2)
- **Ground Station entries**: Listed below satellites; click to switch the ground-station polar view

### Camera Modes (top-left buttons)

- **Satellite view**: Standard orbit with camera following / free-roam around Earth
- **Earth view**: Globe-centric orientation
- **Celestial map**: 2D equirectangular all-sky view
- **Ground station view**: Polar pass plot centred on the selected ground station

### Timeline Interaction

- **Scrub**: Drag the timeline slider to navigate through time
- **Play/Pause**: Use animation controls
- **Settings Persistence**: Changing panel settings (colors, toggles) does **NOT** reset the timeline

### Cross-Panel Hover Sync

Hover over a time series panel to instantly seek the 3D visualization to that point in time — useful for correlating telemetry anomalies with orbital position, attitude, or sensor footprint.

**One-time setup (per dashboard):**

1. Go to **Dashboard settings** → **Graph tooltip**
2. Select **Shared crosshair** (or **Shared Tooltip**)
3. Make sure **Subscribe to data hover event** is enabled in the 3D panel's options (it is by default)

That's all. Moving your cursor over any time series on the dashboard will now drive the 3D scene.

> **Tip**: Use `npm run generate:9h` in `satellite-data-generator/` to produce test data aligned to the current clock, then set the Grafana time picker to *Last 9 hours*. This gives you a full time series to hover over with matching orbital positions.

---

## 🛠️ Development

### Building the Plugin

```bash
cd grafana-plugins/3d-orbit-attitude-plugin
npm install
npm run build
```

### Development Mode (Watch)

```bash
npm run dev
```

Changes to source files will auto-rebuild. Refresh Grafana to see updates.

### Development Container

Use the provided Docker setup:

```bash
make dev
```

Access at [http://localhost:3000](http://localhost:3000).

### Project Structure

```
grafana-plugins/3d-orbit-attitude-plugin/
├── src/
│   ├── components/
│   │   └── SatelliteVisualizer.tsx   # Main 3D visualization component
│   ├── parsers/
│   │   ├── satelliteParser.ts        # Data parsing logic
│   │   └── sensorParser.ts           # Sensor definitions parser
│   ├── utils/
│   │   ├── projections.ts            # FOV footprint calculations
│   │   ├── celestialGrid.ts          # RA/Dec grid generation
│   │   ├── sensorCone.ts             # 3D cone mesh generation
│   │   └── cameraScaling.ts          # Dynamic scaling logic
│   ├── types/
│   │   ├── satelliteTypes.ts         # TypeScript interfaces
│   │   └── sensorTypes.ts
│   └── module.ts                     # Grafana plugin entry point
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🆕 What's New in v1.1.0

These features were added after the initial `v1.0.1` release:

- **Celestial map view** — full 360°×180° SVG sky map with sensor FOV rings, Sun/Moon markers, solar and Earth exclusion zones, and legend entry
- **Ground station view** — polar-plot pass perspective per ground station
- **Uncertainty ellipsoids** — 3D orbital uncertainty rendering with configurable opacity and colour
- **Mock digital twin integration** — `digitalTwinUrl` + `scenarioId` panel options drive scenario-specific orbital geometry and anomaly injection
- **Source reliability level slider** — per-satellite input in Scenario 2 POSTs to the twin server
- **Tooltip pinning** — click to lock the crosshair at a specific time (requires Grafana 11+)
- **Trajectory solid/dashed split** — segment before/after last observed time rendered differently
- **Transparency toggle** for sensor cones per satellite
- **Line-of-sight (LoS) visibility** — ground footprint mutual-exclusion with LoS view

---

## 📚 Generating Test Data

The included data generator creates realistic Keplerian orbits with sensors:

### Quick Commands

```bash
cd satellite-data-generator
npm install

# Generate 3 satellites (10-30 points each)
npm run generate

# Generate 14 satellites (stress test for performance)
npm run generate:many

# Generate 1 satellite
npm run generate:single
```

### Output Files

- `output/multi-satellite.json` - 3 satellites (default)
- `output/many-satellites.json` - 14 satellites
- `output/satellite-1.json`, `satellite-2.json`, `satellite-3.json` - Individual files

### Parameters

Generated satellites have randomized:
- **Altitude**: 400-1000 km (LEO)
- **Inclination**: 0-90° (equatorial to polar)
- **Ascending Node**: 0-360°
- **Sensors**: 2-3 per satellite with varied FOV and orientations
- **Duration**: ~1 hour of mission time

See `satellite-data-generator/README.md` for more details.

---

## 🤝 Contributing

We welcome contributions! This plugin is part of a research thesis and we're actively seeking feedback.

### How to Help

1. **Try the plugin** with your satellite data
2. **Report issues** on GitHub
3. **Request features** you'd find useful
4. **Share screenshots/videos** of your use cases
5. **Suggest improvements** to UX/visualization

### Development Contributions

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📖 Additional Documentation

- **[ROADMAP.md](./ROADMAP.md)**: Future features and planned improvements
- **[CHANGELOG.md](./CHANGELOG.md)**: Version history and release notes
- **[satellite-data-generator/README.md](../../satellite-data-generator/README.md)**: Test data generator documentation

---

## 🐛 Troubleshooting

### Plugin Doesn't Appear in Grafana

1. Ensure Docker container started successfully: `docker-compose ps`
2. Check plugin is in correct directory: `grafana-plugins/3d-orbit-attitude-plugin/dist/`
3. Build the plugin: `npm run build`
4. Check Grafana logs: `docker-compose logs grafana`

### "Invalid Access Token" Error

1. **Note**: This error only appears if you try to use premium Cesium base layers/textures or Cesium Ion 3D models
2. The plugin works fine with the default base layer without any token
3. If you need premium features:
   - Get a token at [https://cesium.com/ion/tokens](https://cesium.com/ion/tokens)
   - Ensure token has necessary permissions
   - Paste carefully (no extra spaces)

### Timeline Resets When Changing Settings

- This was a known issue, now **fixed** in the latest version
- Update to the latest commit if you encounter this

### Satellite Doesn't Appear

1. Check data format matches specification above
2. Verify timestamps are Unix milliseconds
3. Ensure coordinates are in correct frame (Geodetic/ECEF/ECI)
4. Check browser console for parsing errors

### Performance Issues with Many Satellites

- Tested with 14 satellites at 6-10 FPS
- Reduce trajectory points or hide unused satellites
- Disable FOV footprints/projections if not needed
- Use the sidebar to hide satellites you're not actively monitoring

---

## 📄 License

This project is licensed under the **Apache License 2.0** - see the [LICENSE](./LICENSE) file for details.

**Original Work**: Copyright © 2024 Lucas Brémond  
**Enhancements**: Copyright © 2025 Ricardo Santos, Instituto Superior Técnico

This plugin is a **derivative work** based on Lucas Brémond's [Satellite Visualizer Plugin](https://github.com/lucas-bremond/satellite-visualizer), licensed under Apache 2.0. All modifications and enhancements are also licensed under Apache 2.0 in compliance with the original license terms.

---

## 🙏 Acknowledgments

### Original Work

This plugin is built upon the excellent foundation of:
- **[Satellite Visualizer Plugin](https://github.com/lucas-bremond/satellite-visualizer)** by **Lucas Brémond**
  - Original 3D satellite visualization with CesiumJS
  - Copyright © 2024 Lucas Brémond
  - Licensed under Apache License 2.0

### Enhancements Added

We've extended the original plugin with:
- Multi-satellite tracking and visualization
- Sensor field-of-view (3D cones, ground footprints, celestial projections)
- Attitude visualization (body axes, RA/Dec celestial grid)
- Advanced camera controls (tracking, free camera, nadir view)
- Sidebar satellite menu with visibility controls
- Timeline persistence across settings changes

### Technology Stack

Built with:
- [CesiumJS](https://cesium.com/platform/cesiumjs/) - 3D geospatial visualization
- [Resium](https://resium.reearth.io/) - React components for CesiumJS
- [Grafana](https://grafana.com/) - Monitoring and visualization platform

---

## 📧 Contact

**Author**: Ricardo Santos  
**Institution**: Instituto Superior Técnico  
**Email**: feedback@dovsky.com  
**Repository**: https://github.com/dovskyrick/grafana-satellite-visualizer

For questions, feedback, or collaboration opportunities:
- Open an issue on [GitHub](https://github.com/dovskyrick/grafana-satellite-visualizer/issues)
- Email: feedback@dovsky.com

**This plugin is part of ongoing aerospace engineering research at Instituto Superior Técnico. Your feedback directly contributes to academic research!**

---

## 🌟 Star This Repository

If you find this plugin useful, please consider starring the repository to help others discover it!

