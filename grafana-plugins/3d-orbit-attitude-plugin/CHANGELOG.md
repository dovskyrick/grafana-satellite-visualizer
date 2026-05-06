# Changelog

## [1.1.0] — 2026-05-06

### Added
- **Celestial map view** — full 360°×180° SVG equirectangular sky map showing sensor FOV rings, Sun/Moon markers, solar exclusion zone (15° keep-out cone), Earth exclusion band, and a zoomed/total-map toggle
- **Ground station view** — polar-plot pass perspective centred on a selected ground station; satellite arcs shown as azimuth vs elevation
- **Uncertainty ellipsoids** — 3D along-track / cross-track / radial ellipsoids rendered in the scene with configurable opacity (High 70%, Medium 30%, Low 10%) and colour
- **Mock digital twin integration** — `digitalTwinUrl` and `scenarioId` panel options; drives scenario-specific orbital geometry and anomaly injection for all six evaluation scenarios
- **Confidence slider** — per-satellite modal in Scenario 2 POSTs an operator confidence value to the twin server
- **Tooltip pinning** — click a Grafana crosshair tooltip to lock the 3D scene at that moment (Grafana 11+)
- **Trajectory solid/dashed split** — segment before last observed time rendered solid; predicted segment rendered dashed
- **Sensor cone transparency toggle** — per-satellite setting in the sidebar settings modal
- **Line-of-sight visibility** — ground footprint view accounts for mutual LoS exclusion

### Changed
- Multi-satellite sidebar now lists ground stations below satellites with a dedicated polar-view selector
- Camera scaling updated to remain consistent across tracking and free-roam modes

---

## [1.0.1] — 2024-12

### Added
- Initial multi-satellite tracking with independent trajectories and sidebar visibility controls
- 3D sensor FOV cones attached to satellite body with quaternion orientation
- Ground footprint projection with horizon detection
- Celestial FOV projection onto the celestial sphere
- Attitude body-axes (X/Y/Z) with customisable colours
- RA/Dec celestial coordinate grid with labels
- Tracking mode, free camera mode, and nadir view
- Timeline and settings persistence (no timeline reset on panel option changes)
- Cross-panel hover sync via Grafana shared crosshair

---

## [1.0.0] — 2024-12

Initial release based on the original [Satellite Visualizer Plugin](https://github.com/lucas-bremond/satellite-visualizer) by Lucas Brémond (Apache 2.0).
