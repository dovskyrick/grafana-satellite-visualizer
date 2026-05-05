import { PanelPlugin } from '@grafana/data';
import { SimpleOptions, AssetMode, CoordinatesType, UncertaintyOpacityMode, ScenarioId } from './types';
import { SatelliteVisualizer } from './components/SatelliteVisualizer';

import { LocationEditor } from './LocationEditor';

export const plugin = new PanelPlugin<SimpleOptions>(SatelliteVisualizer).setPanelOptions((builder) => {
  return builder
    .addTextInput({
      path: 'digitalTwinUrl',
      name: 'Digital Twin Server URL',
      description: 'Fetch trajectory data from this server instead of the datasource (e.g. http://localhost:3001). Leave empty to use the datasource as normal.',
      defaultValue: '',
      category: ['Data Source'],
    })
    .addSelect({
      path: 'scenarioId',
      name: 'Scenario',
      description: 'Select the scenario to request from the Digital Twin server.',
      settings: {
        options: [
          { value: ScenarioId.Default,        label: 'Default (3 satellites)' },
          { value: ScenarioId.CollisionRisk1, label: 'Scenario 1 – Collision Risk' },
          { value: ScenarioId.Scenario2,      label: 'Scenario 2 – Source Reliability Assessment' },
          { value: ScenarioId.Scenario3,      label: 'Scenario 3 – Communication Anomaly' },
          { value: ScenarioId.Scenario4,      label: 'Scenario 4 – Star Tracker Anomaly' },
          { value: ScenarioId.Scenario5,      label: 'Scenario 5 – GS Antenna Anomaly' },
        ],
      },
      defaultValue: ScenarioId.Default,
      category: ['Data Source'],
      showIf: (config) => config.digitalTwinUrl !== '',
    })

    .addRadio({
      path: 'assetMode',
      name: 'Display mode',
      description: 'The display mode of the Asset.',
      settings: {
        options: [
          { value: AssetMode.Point, label: 'Point' },
          { value: AssetMode.Model, label: 'Model' },
        ],
      },
      defaultValue: AssetMode.Model,
    })
    .addRadio({
      path: 'coordinatesType',
      name: 'Coordinates type',
      description: 'The type of coordinates to use.',
      settings: {
        options: [
          { value: CoordinatesType.CartesianFixed, label: 'Cartesian Fixed' },
          { value: CoordinatesType.CartesianInertial, label: 'Cartesian Inertial' },
          { value: CoordinatesType.Geodetic, label: 'Geodetic' },
        ],
      },
      defaultValue: CoordinatesType.Geodetic,
    })

    .addNumberInput({
      path: 'pointSize',
      name: 'Point size',
      description: 'The size (in pixels) of the point.',
      defaultValue: 30,
      showIf: (config) => config.assetMode === AssetMode.Point,
    })
    .addColorPicker({
      path: 'pointColor',
      name: 'Point color',
      description: 'The color of the point.',
      defaultValue: 'red',
      showIf: (config) => config.assetMode === AssetMode.Point,
    })

    .addNumberInput({
      path: 'modelScale',
      name: 'Scale',
      description: 'The linear scale of the model.',
      defaultValue: 1.0,
      showIf: (config) => config.assetMode === AssetMode.Model,
    })
    .addNumberInput({
      path: 'modelMinimumPixelSize',
      name: 'Minimum pixel size',
      description:
        'The approximate minimum pixel size of the model regardless of zoom. When 0.0, no minimum size is enforced.',
      defaultValue: 128,
      showIf: (config) => config.assetMode === AssetMode.Model,
    })
    .addNumberInput({
      path: 'modelMaximumScale',
      name: 'Maximum scale',
      description: 'The maximum scale size of the model (minimum pizel size upper limit).',
      defaultValue: 500,
      showIf: (config) => config.assetMode === AssetMode.Model,
    })
    .addNumberInput({
      path: 'modelAssetId',
      name: 'Asset ID',
      description: 'The model Cesium ion asset id.',
      defaultValue: 0,
      showIf: (config) => config.assetMode === AssetMode.Model,
    })
    .addTextInput({
      path: 'modelAssetUri',
      name: 'Asset URI',
      description: 'The URI of the glTF asset.',
      defaultValue: 'public/plugins/lucasbremond-satellitevisualizer-panel/static/models/ACRIMSAT-A.glb',
      showIf: (config) => config.assetMode === AssetMode.Model,
    })

    .addBooleanSwitch({
      path: 'trajectoryShow',
      name: 'Show trajectory',
      description: 'Show satellite trajectory.',
      defaultValue: true,
    })
    .addNumberInput({
      path: 'trajectoryWidth',
      name: 'Trajectory width',
      description: 'The width (in pixels) of the trajecotry.',
      defaultValue: 1,
      showIf: (config) => config.trajectoryShow,
    })
    .addColorPicker({
      path: 'trajectoryColor',
      name: 'Trajectory color',
      description: 'The color of the trajectory.',
      defaultValue: 'gray',
      showIf: (config) => config.trajectoryShow,
    })
    .addNumberInput({
      path: 'trajectoryDashLength',
      name: 'Trajectory dash length',
      description: 'The dash length (in pixels) of the trajectory.',
      defaultValue: 16.0,
      showIf: (config) => config.trajectoryShow,
    })
    .addNumberInput({
      path: 'trajectoryLeadTime',
      name: 'Trajectory lead time (s)',
      description: 'Seconds of orbit to draw ahead of current time. Default 2700 s ≈ half a LEO orbit.',
      defaultValue: 2700,
      settings: { min: 0 },
      showIf: (config) => config.trajectoryShow,
    })
    .addNumberInput({
      path: 'trajectoryTrailTime',
      name: 'Trajectory trail time (s)',
      description: 'Seconds of orbit to draw behind current time. Default 2700 s ≈ half a LEO orbit.',
      defaultValue: 2700,
      settings: { min: 0 },
      showIf: (config) => config.trajectoryShow,
    })

    // ============================================================
    // 🎯 MASTER ATTITUDE VISUALIZATION TOGGLE
    // ============================================================
    .addBooleanSwitch({
      path: 'showAttitudeVisualization',
      name: '🎯 Attitude Visualization',
      description: 'Enable all attitude-related visualizations (sensors, body axes, celestial grid, projections)',
      defaultValue: true,
    })

    // ============================================================
    // 🛰️ SENSOR CONES
    // ============================================================
    .addBooleanSwitch({
      path: 'showSensorCones',
      name: '🛰️ Show Sensor Cones',
      description: 'Display 3D FOV cones for all sensors attached to satellite',
      defaultValue: true,
      showIf: (config: any) => config.showAttitudeVisualization,
    })

    // ============================================================
    // 📍 SENSOR PROJECTIONS (custom features)
    // ============================================================
    .addBooleanSwitch({
      path: 'showFOVFootprint',
      name: '📍 Show FOV Footprint',
      description: 'Display sensor field-of-view cone projection on Earth surface.',
      defaultValue: true,
      showIf: (config: any) => config.showAttitudeVisualization,
    })

    // ============================================================
    // 🌐 LINE OF SIGHT / VISIBILITY AREA
    // ============================================================
    .addBooleanSwitch({
      path: 'showVisibilityLoS',
      name: '🌐 Show Visibility / Line of Sight',
      description: 'Display the Earth visibility area (line-of-sight coverage) for all satellites. Mutually exclusive with FOV Footprint.',
      defaultValue: false,
      showIf: (config: any) => config.showAttitudeVisualization,
    })
    .addBooleanSwitch({
      path: 'showCelestialFOV',
      name: '🔭 Show Celestial FOV',
      description: 'Project sensor field-of-view onto celestial sphere to show observed sky region.',
      defaultValue: true,
      showIf: (config: any) => config.showAttitudeVisualization,
    })

    // ============================================================
    // 📊 UNCERTAINTY ELLIPSOIDS (position uncertainty)
    // ============================================================
    .addBooleanSwitch({
      path: 'showUncertaintyEllipsoids',
      name: '📊 Show Uncertainty Ellipsoids',
      description: 'Display 3D confidence ellipsoids representing position uncertainty (covariance). Opacity indicates data quality.',
      defaultValue: false,
      showIf: (config: any) => config.showAttitudeVisualization,
    })
    .addSelect({
      path: 'uncertaintyOpacityMode',
      name: '📊 Data Quality Visualization',
      description: 'Opacity level indicates data quality: High (70%) = good, Medium (30%) = fair, Low (10%) = poor',
      settings: {
        options: [
          { value: UncertaintyOpacityMode.High, label: 'High Quality (70% opacity)' },
          { value: UncertaintyOpacityMode.Medium, label: 'Medium Quality (30% opacity)' },
          { value: UncertaintyOpacityMode.Low, label: 'Low Quality (10% opacity)' },
        ],
      },
      defaultValue: UncertaintyOpacityMode.Medium,
      showIf: (config: any) => config.showAttitudeVisualization && config.showUncertaintyEllipsoids,
    })
    .addColorPicker({
      path: 'uncertaintyColor',
      name: '📊 Ellipsoid Color',
      description: 'Color for uncertainty ellipsoids (cyan recommended for consistency)',
      defaultValue: '#00FFFF',  // Cyan
      showIf: (config: any) => config.showAttitudeVisualization && config.showUncertaintyEllipsoids,
    })

    // ============================================================
    // 🌌 CELESTIAL REFERENCE GRID (custom features)
    // ============================================================
    .addBooleanSwitch({
      path: 'showRADecGrid',
      name: '🌌 Show RA/Dec Celestial Grid',
      description: 'Display Right Ascension and Declination reference lines (inertial frame, fixed relative to stars).',
      defaultValue: false,
      showIf: (config: any) => config.showAttitudeVisualization,
    })
    .addNumberInput({
      path: 'raSpacing',
      name: '🌌 RA Spacing (hours)',
      description: 'Spacing between Right Ascension meridians (1h = 15°). 1h gives 24 lines.',
      defaultValue: 1,
      settings: {
        min: 1,
        max: 6,
        step: 1,
      },
      showIf: (config: any) => config.showAttitudeVisualization && config.showRADecGrid,
    })
    .addNumberInput({
      path: 'decSpacing',
      name: '🌌 Dec Spacing (degrees)',
      description: 'Spacing between Declination parallels. 15° gives 12 lines.',
      defaultValue: 15,
      settings: {
        min: 10,
        max: 30,
        step: 5,
      },
      showIf: (config: any) => config.showAttitudeVisualization && config.showRADecGrid,
    })
    .addBooleanSwitch({
      path: 'showGridLabels',
      name: '🌌 Show Grid Labels',
      description: 'Display coordinate labels on RA/Dec grid lines',
      defaultValue: true,
      showIf: (config: any) => config.showAttitudeVisualization && config.showRADecGrid,
    })
    .addNumberInput({
      path: 'gridLabelSize',
      name: '🌌 Grid Label Size (px)',
      description: 'Font size for RA/Dec grid labels',
      defaultValue: 14,
      settings: {
        min: 8,
        max: 32,
        step: 2,
      },
      showIf: (config: any) => config.showAttitudeVisualization && config.showRADecGrid && config.showGridLabels,
    })

    .addCustomEditor({
      id: 'locations',
      path: 'locations',
      name: 'Locations',
      description: 'A list of locations to display.',
      editor: LocationEditor,
      defaultValue: [],
    })
    .addNumberInput({
      path: 'locationPointSize',
      name: 'Location point size',
      description: 'The size (in pixels) of the Location point.',
      defaultValue: 10,
      showIf: (config: any) => config.locations.length > 0,
    })
    .addColorPicker({
      path: 'locationPointColor',
      name: 'Location point color',
      description: 'The color of the Location point.',
      defaultValue: 'white',
      showIf: (config: any) => config.locations.length > 0,
    })

    .addTextInput({
      path: 'accessToken',
      name: 'Access token',
      description: 'A Cesium ion access token.',
      defaultValue: '',
    })

    .addBooleanSwitch({
      path: 'subscribeToDataHoverEvent',
      name: 'Subscribe to data hover event',
      description: 'Hover on another panel to set the current time (required shared crosshair).',
      defaultValue: true,
    })

    .addBooleanSwitch({
      path: 'showAnimation',
      name: 'Show animation',
      description: 'If enabled, the animation controller is displayed.',
      defaultValue: false,
    })
    .addBooleanSwitch({
      path: 'showTimeline',
      name: 'Show timeline',
      description: 'If enabled, the timeline is displayed.',
      defaultValue: false,
    })
    .addBooleanSwitch({
      path: 'showInfoBox',
      name: 'Show info box',
      description: 'If enabled, the info box is displayed.',
      defaultValue: false,
    })
    .addBooleanSwitch({
      path: 'showBaseLayerPicker',
      name: 'Show base layer picker',
      description: 'If enabled, a Base Layer Picker widget will be created.',
      defaultValue: false,
    })
    .addBooleanSwitch({
      path: 'showSceneModePicker',
      name: 'Show scene mode picker',
      description: 'If enabled, a Scene Mode Picker widget will be created.',
      defaultValue: false,
    })
    .addBooleanSwitch({
      path: 'showProjectionPicker',
      name: 'Show projection picker',
      description: 'If enabled, a Projection Picker widget will be created.',
      defaultValue: false,
    })
    .addBooleanSwitch({
      path: 'showCredits',
      name: 'Show credits',
      description: 'Show Cesium credits.',
      defaultValue: true,
    })
    ;
});
