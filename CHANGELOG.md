# Changelog

All notable changes to this project are recorded here. Versioning follows the plugin release — the supporting infrastructure (Grafana server, mockup digital twin, data generator) ships alongside each plugin version.

---

## [1.2.0] — 2026-05-06

### Panel Plugin
See [grafana-plugins/3d-orbit-attitude-plugin/CHANGELOG.md](./grafana-plugins/3d-orbit-attitude-plugin/CHANGELOG.md) for the full plugin changelog.

Highlights:
- Celestial map view (360°×180° SVG sky map with FOV rings, Sun/Moon, exclusion zones)
- Ground station polar-plot pass view
- Orbital uncertainty ellipsoids (3D, configurable opacity/colour)
- Mock digital twin integration (`digitalTwinUrl` + `scenarioId` panel options)
- Confidence slider, tooltip pinning, trajectory solid/dashed split

### Mockup Digital Twin Server
- New TypeScript/Express server serving six evaluation scenarios
- Endpoints: orbital trajectories, uncertainty ellipsoids, collision risk curves, link-health telemetry, star-tracker anomaly series
- Deployed publicly on Fly.io (`https://satellite-twin.fly.dev`)
- Confidence POST endpoint for Scenario 2 operator input

### Grafana Server
- Docker Compose stack starts Grafana + mock twin together
- Six scenario dashboards provisioned automatically from JSON
- TestData and Infinity datasources pre-configured
- No manual setup required to run any scenario

### Satellite Data Generator
- Generates realistic Keplerian multi-satellite test data
- `generate:9h` mode for time-aligned hover-sync testing

---

## [1.0.1] — 2024-12

Initial public release. Single-satellite 3D orbit visualization plugin running in self-hosted Grafana via Docker Compose.
