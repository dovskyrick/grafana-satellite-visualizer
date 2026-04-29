/**
 * SatelliteVisualizer.tsx
 * 
 * Main panel component for 3D satellite visualization using CesiumJS.
 * 
 * ARCHITECTURE (Post-Refactoring, Jan 14 2026):
 * This component is now focused on orchestration and state management.
 * 
 * REFACTORING HISTORY:
 * - Dec 31, 2025: Entity Renderers extracted → ./entities/CesiumEntityRenderers.tsx
 * - Jan 14, 2026: Phase 1 - Styles & Constants extracted → ./styles/
 * 
 * CURRENT SIZE: 1726 lines (down from 2589 lines before Phase 1)
 * 
 * RESPONSIBILITIES:
 * ✓ State management (satellites, tracking, visibility, UI toggles)
 * ✓ Cesium viewer initialization and configuration
 * ✓ Camera controls (tracking mode, free camera, nadir view)
 * ✓ UI controls (sidebar, buttons, modals)
 * ✓ Data parsing and preprocessing
 * ✓ Coordinating child renderer components
 * 
 * RENDERING DELEGATION:
 * All 3D entity rendering is delegated to specialized components:
 * - SatelliteEntityRenderer: Main satellite model/point + trajectory
 * - SensorVisualizationRenderer: Sensor cones + FOV projections
 * - BodyAxesRenderer: Satellite body axes (X/Y/Z)
 * - CelestialGridRenderer: RA/Dec celestial coordinate grid
 * - GroundStationRenderer: Ground station markers
 * - UncertaintyEllipsoidRenderer: Uncertainty ellipsoid visualization
 * - CelestialBodiesRenderer: Sun and Earth center symbols for celestial map
 * 
 * STYLES & CONSTANTS:
 * - ./styles/SatelliteVisualizerStyles.ts: All CSS-in-JS styles
 * - ./styles/constants.ts: Color maps and color parsing utilities
 * 
 * See: 
 * - grafana-plugins/plans-broad-scope/25-12-december/31-refactoring-complete-summary.md
 * - grafana-plugins/plans-broad-scope/26-01-january/01-refactoring-analysis-and-strategy.md
 */

import React, { useEffect, useState, useCallback } from 'react';
import { PanelProps, DataHoverEvent, LegacyGraphHoverEvent, DataFrame } from '@grafana/data';
import { SimpleOptions, ScenarioId } from 'types';
import { generateRADecGrid, generateRADecGridLabels } from 'utils/celestialGrid';
import { parseSatellites } from 'parsers/satelliteParser';
import { ParsedSatellite } from 'types/satelliteTypes';
import { parseGroundStations } from 'parsers/groundStationParser';
import { GroundStation } from 'types/groundStationTypes';
import {
  SatelliteEntityRenderer,
  SensorVisualizationRenderer,
  BodyAxesRenderer,
  CelestialGridRenderer,
  GroundStationRenderer,
  UncertaintyEllipsoidRenderer,
  CelestialBodiesRenderer,
} from './entities/CesiumEntityRenderers';
import { css, cx } from '@emotion/css';
import { useStyles2, ColorPicker } from '@grafana/ui';
import { Settings, X, ChevronUp, ChevronDown } from 'lucide-react';
import { getStyles } from './styles/SatelliteVisualizerStyles';
import { computeVisibilityLoS } from 'utils/projections';
import { generateFOVRing, generateEarthDiskRing, generateDirectionDiskRing, filledRingToSvgPath } from 'utils/totalMapProjection';
import { TopLeftControls } from './controls/TopLeftControls';
import { SidebarControls } from './controls/SidebarControls';

import { Viewer, Clock, Entity, PointGraphics, LabelGraphics, EllipseGraphics } from 'resium';
import {
  Ion,
  JulianDate,
  TimeInterval,
  Cartesian3,
  Transforms,
  Color,
  IonResource,
  Cartesian2,
  Ellipsoid,
  UrlTemplateImageryProvider,
  ProviderViewModel,
  buildModuleUrl,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  LabelStyle,
  Matrix3,
  Quaternion,
  SampledProperty,
  CallbackProperty,
  Simon1994PlanetaryPositions,
  SceneMode,
} from 'cesium';

import 'cesium/Build/Cesium/Widgets/widgets.css';

interface Props extends PanelProps<SimpleOptions> {}

// ─── Ground Station POV — az/el helper ───────────────────────────────────────
// Returns azimuth (0–360°, clockwise from North) and elevation (–90–90°) of
// satPos as seen from gsPos, or null if either position is unavailable.
function computeAzEl(
  gsPos: Cartesian3,
  satPos: Cartesian3
): { az: number; el: number } | null {
  const diff = Cartesian3.subtract(satPos, gsPos, new Cartesian3());
  const range = Cartesian3.magnitude(diff);
  if (range === 0) { return null; }

  const up = Ellipsoid.WGS84.geodeticSurfaceNormal(gsPos, new Cartesian3());
  const east = Cartesian3.normalize(
    Cartesian3.cross(Cartesian3.UNIT_Z, up, new Cartesian3()), new Cartesian3()
  );
  const north = Cartesian3.normalize(
    Cartesian3.cross(up, east, new Cartesian3()), new Cartesian3()
  );

  const e = Cartesian3.dot(diff, east);
  const n = Cartesian3.dot(diff, north);
  const u = Cartesian3.dot(diff, up);

  const el = (Math.asin(u / range) * 180) / Math.PI;
  const az = ((Math.atan2(e, n) * 180) / Math.PI + 360) % 360;
  return { az, el };
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clamp a label position so it stays inside the Total Map SVG viewBox (0 0 360 180).
 * charW ≈ fontSize × 0.55 gives a rough per-character width estimate.
 * anchor "middle" offsets by half the estimated width; "start" offsets by the full width.
 */
function clampLabel(
  x: number,
  y: number,
  text: string,
  fontSize: number,
  anchor: 'start' | 'middle' = 'start'
): { x: number; y: number } {
  const W = 360, H = 180, PAD = 2;
  const textW = fontSize * 0.55 * text.length;
  const halfW = textW / 2;
  const minX = anchor === 'middle' ? PAD + halfW : PAD;
  const maxX = anchor === 'middle' ? W - PAD - halfW : W - PAD - textW;
  return {
    x: Math.min(Math.max(x, minX), maxX),
    y: Math.min(Math.max(y, PAD + fontSize), H - PAD),
  };
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Ground Station POV camera settings ──────────────────────────────────────
// Tweak GS_POV_FOV_DEG to change the field of view when in Ground Station mode.
// 180 = full hemisphere view; 90 = normal wide-angle; 60 = Cesium default.
const GS_POV_FOV_DEG = 179;

// ─── Digital Twin helpers ─────────────────────────────────────────────────────
/**
 * Convert the raw JSON array returned by the mockup digital twin server into
 * lightweight DataFrame-compatible objects that the existing parsers can consume.
 * The server returns the same columns/rows/meta structure as TestData DB.
 */
function rawJsonToDataFrames(items: any[]): DataFrame[] {
  return items.map(item => {
    const columns: Array<{ text: string; type: string }> = item.columns || [];
    const rows: any[][] = item.rows || [];
    const fields = columns.map((col, colIdx) => ({
      name: col.text,
      type: col.type,
      values: rows.map(row => row[colIdx]),
      config: {},
    }));
    return {
      name: item.meta?.custom?.satelliteId ?? item.type ?? 'unknown',
      fields,
      length: rows.length,
      meta: item.meta,
    } as DataFrame;
  });
}
// Default reference-frame axis colors — edit here to change startup appearance
const FRAME_COLORS_DEFAULTS = {
  body: 'rgba(245, 245, 250, 0.9)',
  lvlh: 'rgba(180, 180, 185, 0.7)',
  itrf: 'rgba(120, 120, 130, 0.6)',
  icrf: 'rgba(140, 170, 215, 0.6)',
};
type FrameColors = typeof FRAME_COLORS_DEFAULTS;

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export const SatelliteVisualizer: React.FC<Props> = ({ options, onOptionsChange, data, timeRange, width, height, eventBus }) => {
  Ion.defaultAccessToken = options.accessToken;

  const styles = useStyles2(getStyles);

  const [isLoaded, setLoaded] = useState<boolean>(false);
  // Guards Resium entity children from rendering before Cesium's _cesiumWidget is ready.
  // Without this, SPA navigation (e.g. clicking Edit panel) causes a race where React
  // renders entity children in the same pass as <Viewer>, before Cesium has initialized,
  // triggering "can't access property 'scene', _cesiumWidget is undefined".
  const [isViewerReady, setIsViewerReady] = useState<boolean>(false);
  const [viewerKey, setViewerKey] = useState<number>(0);
  const [isTracked, setIsTracked] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const [timestamp, setTimestamp] = useState<JulianDate | null>(null);
  const [overlayClockTime, setOverlayClockTime] = useState<JulianDate | null>(null);
  const [satellites, setSatellites] = useState<ParsedSatellite[]>([]);
  const [groundStations, setGroundStations] = useState<GroundStation[]>([]);
  const [trackedSatelliteId, setTrackedSatelliteId] = useState<string | null>(null);
  const [trackedGroundStationId, setTrackedGroundStationId] = useState<string | null>(null);
  const [hiddenSatellites, setHiddenSatellites] = useState<Set<string>>(new Set());
  const [hiddenGroundStations, setHiddenGroundStations] = useState<Set<string>>(new Set());
  const [settingsModalSatelliteId, setSettingsModalSatelliteId] = useState<string | null>(null);
  const [settingsModalGroundStationId, setSettingsModalGroundStationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'satellites' | 'groundstations'>('satellites');
  
  // New dropdown states for Mode and Camera controls
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState<boolean>(false);
  const [isCameraDropdownOpen, setIsCameraDropdownOpen] = useState<boolean>(false);
  const [isAxesDropdownOpen, setIsAxesDropdownOpen] = useState<boolean>(false);
  const [selectedMode, setSelectedMode] = useState<'satellite' | 'earth' | 'celestial' | 'groundstation'>('satellite');
  
  // Camera view states - different per mode
  const [satelliteCameraView, setSatelliteCameraView] = useState<'nadir' | 'cross-track' | 'along-track' | 'fixed'>('nadir');
  const [celestialCameraView, setCelestialCameraView] = useState<'zoomed-in' | 'total-map'>('zoomed-in');
  const [earthCameraView, setEarthCameraView] = useState<'icrf' | 'itrf' | 'gcrf' | 'teme'>('icrf');
  
  // Reference axes visibility toggles (common to all modes)
  const [showLVLHAxes, setShowLVLHAxes] = useState<boolean>(false);
  const [showBodyAxes, setShowBodyAxes] = useState<boolean>(true); // Default on
  const [showITRFAxes, setShowITRFAxes] = useState<boolean>(false);
  const [showICRFAxes, setShowICRFAxes] = useState<boolean>(false);
  
  // Legend panel state
  const [isLegendCollapsed, setIsLegendCollapsed] = useState<boolean>(false);
  const [frameColors, setFrameColors] = useState<FrameColors>(() => {
    try {
      const stored = localStorage.getItem('grafana_satelliteVisualizer_frameColors');
      if (stored) {
        return { ...FRAME_COLORS_DEFAULTS, ...JSON.parse(stored) };
      }
    } catch {}
    return FRAME_COLORS_DEFAULTS;
  });
  
  // Hover tooltip state
  const [hoveredEntityName, setHoveredEntityName] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  // LoS warning modal state
  const [showLoSWarningModal, setShowLoSWarningModal] = useState<boolean>(false);
  const [showReviewSubmittedModal, setShowReviewSubmittedModal] = useState<boolean>(false);

  // Per-satellite datasource confidence review (UI only — would feed a digital twin)
  const [confidenceValues, setConfidenceValues] = useState<Map<string, number>>(new Map());
  const [confidenceComments, setConfidenceComments] = useState<Map<string, string>>(new Map());
  
  // Per-satellite render settings (for future features like transparent cones)
  const [satelliteRenderSettings, setSatelliteRenderSettings] = useState<Map<string, {
    transparentCones: boolean;
    // Future settings will go here
    setting2: boolean;
    setting3: boolean;
    setting4: boolean;
    setting5: boolean;
    setting6: boolean;
    setting7: boolean;
    setting8: boolean;
    setting9: boolean;
  }>>(new Map());

  // Sensor color overrides (localStorage persistence)
  const [sensorColors, setSensorColors] = useState<Map<string, Map<string, string>>>(new Map());
  
  // Color picker state - REMOVED: No longer needed, pickers always visible
  // const [colorPickerState, setColorPickerState] = useState<{
  //   satelliteId: string;
  //   sensorId: string;
  // } | null>(null);

  const [satelliteResource, setSatelliteResource] = useState<IonResource | string | undefined>(undefined);
  const [raLines, setRALines] = useState<Cartesian3[][]>([]);
  const [decLines, setDecLines] = useState<Cartesian3[][]>([]);
  const [gridLabels, setGridLabels] = useState<Array<{ position: Cartesian3; text: string }>>([]);
  
  // Store viewer reference for imagery setup in useEffect
  const viewerRef = React.useRef<any>(null);

  // Tracks the previous selectedMode so camera transition effects can detect which mode was left
  const prevModeRef = React.useRef<string | null>(null);

  // Modal overlay refs for ESC key handling
  const satelliteModalRef = React.useRef<HTMLDivElement>(null);
  const groundStationModalRef = React.useRef<HTMLDivElement>(null);

  // Scenario 3 attitude anomaly window fetched once from the server.
  // Stored in a ref so the CallbackProperty closure can read it without
  // triggering re-renders on every satellite frame.
  const anomalyWindowRef = React.useRef<{ start: number; end: number } | null>(null);

  // Attitude vector configurations — colors driven by frameColors state (legend color picker)
  // Default fallbacks match the initial frameColors values so startup appearance is identical.
  const attitudeVectors = React.useMemo(() => {
    const color = Color.fromCssColorString(frameColors.body) ?? Color.fromBytes(245, 245, 250, 230);
    return [
      { axis: new Cartesian3(1, 0, 0), color, name: 'Body-X', label: 'X' },
      { axis: new Cartesian3(0, 1, 0), color, name: 'Body-Y', label: 'Y' },
      { axis: new Cartesian3(0, 0, 1), color, name: 'Body-Z', label: 'Z' },
    ];
  }, [frameColors.body]);

  // LVLH Axes — R = Radial, A = Along-track, C = Cross-track
  const lvlhVectors = React.useMemo(() => {
    const color = Color.fromCssColorString(frameColors.lvlh) ?? Color.fromBytes(180, 180, 185, 179);
    return [
      { axis: new Cartesian3(1, 0, 0), color, name: 'Cross-track', label: 'C' },
      { axis: new Cartesian3(0, 1, 0), color, name: 'Along-track', label: 'A' },
      { axis: new Cartesian3(0, 0, 1), color, name: 'Radial',       label: 'R' },
    ];
  }, [frameColors.lvlh]);

  // ITRF Axes — X/Y/Z aligned with ECEF frame
  const itrfVectors = React.useMemo(() => {
    const color = Color.fromCssColorString(frameColors.itrf) ?? Color.fromBytes(120, 120, 130, 153);
    return [
      { axis: new Cartesian3(1, 0, 0), color, name: 'ITRF-X', label: 'X' },
      { axis: new Cartesian3(0, 1, 0), color, name: 'ITRF-Y', label: 'Y' },
      { axis: new Cartesian3(0, 0, 1), color, name: 'ITRF-Z', label: 'Z' },
    ];
  }, [frameColors.itrf]);

  // ICRF Axes — X: vernal equinox, Z: north celestial pole
  const icrfVectors = React.useMemo(() => {
    const color = Color.fromCssColorString(frameColors.icrf) ?? Color.fromBytes(140, 170, 215, 153);
    return [
      { axis: new Cartesian3(1, 0, 0), color, name: 'ICRF-X', label: 'X' },
      { axis: new Cartesian3(0, 1, 0), color, name: 'ICRF-Y', label: 'Y' },
      { axis: new Cartesian3(0, 0, 1), color, name: 'ICRF-Z', label: 'Z' },
    ];
  }, [frameColors.icrf]);

  // Compute LVLH orientation from position and velocity
  const computeLVLHOrientation = React.useCallback((satellite: ParsedSatellite) => {
    const lvlhOrientation = new SampledProperty(Quaternion);
    
    // Sample at same times as position property
    const times = (satellite.position as any)._property?._times || [];
    
    for (let i = 0; i < times.length; i++) {
      const time = times[i];
      const position = satellite.position.getValue(time);
      
      if (!position) {
        continue;
      }
      
      // Compute velocity from consecutive position samples (finite difference)
      let velocity;
      if (i < times.length - 1) {
        const nextTime = times[i + 1];
        const nextPosition = satellite.position.getValue(nextTime);
        if (nextPosition) {
          const dt = JulianDate.secondsDifference(nextTime, time);
          velocity = Cartesian3.subtract(nextPosition, position, new Cartesian3());
          Cartesian3.divideByScalar(velocity, dt, velocity);
        }
      } else if (i > 0) {
        const prevTime = times[i - 1];
        const prevPosition = satellite.position.getValue(prevTime);
        if (prevPosition) {
          const dt = JulianDate.secondsDifference(time, prevTime);
          velocity = Cartesian3.subtract(position, prevPosition, new Cartesian3());
          Cartesian3.divideByScalar(velocity, dt, velocity);
        }
      }
      
      if (position && velocity && Cartesian3.magnitude(velocity) > 0) {
        // LVLH Frame:
        // Z-axis: -radial (towards Earth center, nadir)
        // Y-axis: along velocity (tangent to orbit)
        // X-axis: cross-track (Y × Z, perpendicular to orbital plane)
        
        const zAxis = Cartesian3.normalize(Cartesian3.negate(position, new Cartesian3()), new Cartesian3());
        const yAxis = Cartesian3.normalize(velocity, new Cartesian3());
        const xAxis = Cartesian3.normalize(Cartesian3.cross(yAxis, zAxis, new Cartesian3()), new Cartesian3());
        
        // Recompute Y to ensure orthogonality (Z × X)
        const yAxisOrtho = Cartesian3.cross(zAxis, xAxis, new Cartesian3());
        
        // Create rotation matrix from LVLH frame
        const rotationMatrix = new Matrix3(
          xAxis.x, yAxisOrtho.x, zAxis.x,
          xAxis.y, yAxisOrtho.y, zAxis.y,
          xAxis.z, yAxisOrtho.z, zAxis.z
        );
        
        // Convert to quaternion
        const quaternion = Quaternion.fromRotationMatrix(rotationMatrix);
        lvlhOrientation.addSample(time, quaternion);
      }
    }
    
    return lvlhOrientation;
  }, []);

  // Create LVLH-oriented satellites (same as body satellites but with LVLH orientation)
  const lvlhSatellites = React.useMemo(() => {
    return satellites.map(sat => ({
      ...sat,
      orientation: computeLVLHOrientation(sat),
    }));
  }, [satellites, computeLVLHOrientation]);

  // Compute ITRF orientation (Earth-fixed frame)
  // ITRF is identical to the Cesium/ECEF coordinate system, so no rotation is
  // needed — identity quaternions let BodyAxesRenderer render the axis vectors
  // (1,0,0), (0,1,0), (0,0,1) directly in ECEF, which are the ITRF axes:
  //   X → prime meridian / equator intersection
  //   Y → 90°E on the equator
  //   Z → Earth's mean rotation axis (North Pole)
  const computeITRFOrientation = React.useCallback((satellite: ParsedSatellite) => {
    const itrfOrientation = new SampledProperty(Quaternion);
    const times = (satellite.position as any)._property?._times || [];
    // Use new Quaternion instances (not Quaternion.IDENTITY which is Object.freeze()'d —
    // Cesium's SampledProperty interpolation writes into the stored objects, causing
    // silent failures when the frozen constant is reused across all samples).
    for (let i = 0; i < times.length; i++) {
      itrfOrientation.addSample(times[i], new Quaternion(0, 0, 0, 1));
    }
    return itrfOrientation;
  }, []);

  // Create ITRF-oriented satellites
  const itrfSatellites = React.useMemo(() => {
    return satellites.map(sat => ({
      ...sat,
      orientation: computeITRFOrientation(sat),
    }));
  }, [satellites, computeITRFOrientation]);

  // Compute ICRF orientation (celestial inertial frame → ECEF) at each time step.
  // Transforms.computeIcrfToFixedMatrix rotates a vector from ICRF to ECEF, so
  // applying it as the entity orientation maps the ICRF unit axes to their correct
  // ECEF directions. Returns undefined for times outside EOP data range; those
  // samples are simply skipped and Cesium interpolates across the gap.
  const computeICRFOrientation = React.useCallback((satellite: ParsedSatellite) => {
    const icrfOrientation = new SampledProperty(Quaternion);
    const times = (satellite.position as any)._property?._times || [];
    const scratch = new Matrix3();
    for (let i = 0; i < times.length; i++) {
      const matrix = Transforms.computeIcrfToFixedMatrix(times[i], scratch);
      if (matrix) {
        icrfOrientation.addSample(times[i], Quaternion.fromRotationMatrix(matrix));
      }
    }
    return icrfOrientation;
  }, []);

  // Create ICRF-oriented satellites
  const icrfSatellites = React.useMemo(() => {
    return satellites.map(sat => ({
      ...sat,
      orientation: computeICRFOrientation(sat),
    }));
  }, [satellites, computeICRFOrientation]);

  // Color management helper functions
  // Note: Will be used in Phase 3 (display colors in UI) and Phase 4 (color picker)
  const _getSensorColor = (satelliteId: string, sensorId: string, sensor: any, defaultIndex: number): string => {
    // Priority 1: User override from localStorage
    const override = sensorColors.get(satelliteId)?.get(sensorId);
    if (override) {
      return override;
    }
    
    // Priority 2: Color from sensor JSON
    if (sensor.color) {
      return sensor.color;
    }
    
    // Priority 3: Default color palette
    const defaultColors = ['#00FFFF', '#FF00FF', '#FFFF00', '#FFA500', '#00FF00'];
    return defaultColors[defaultIndex % defaultColors.length];
  };

  const _updateSensorColor = (satelliteId: string, sensorId: string, color: string) => {
    const newColors = new Map(sensorColors);
    if (!newColors.has(satelliteId)) {
      newColors.set(satelliteId, new Map());
    }
    newColors.get(satelliteId)!.set(sensorId, color);
    setSensorColors(newColors);
    
    // Persist to localStorage
    const serialized = JSON.stringify(Array.from(newColors.entries()).map(([satId, sensors]) => [
      satId,
      Array.from(sensors.entries())
    ]));
    localStorage.setItem('grafana_satelliteVisualizer_sensorColors', serialized);
  };

  const _resetSensorColor = (satelliteId: string, sensorId: string) => {
    const newColors = new Map(sensorColors);
    newColors.get(satelliteId)?.delete(sensorId);
    if (newColors.get(satelliteId)?.size === 0) {
      newColors.delete(satelliteId);
    }
    setSensorColors(newColors);
    
    // Update localStorage
    const serialized = JSON.stringify(Array.from(newColors.entries()).map(([satId, sensors]) => [
      satId,
      Array.from(sensors.entries())
    ]));
    localStorage.setItem('grafana_satelliteVisualizer_sensorColors', serialized);
  };

  // Load color overrides from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('grafana_satelliteVisualizer_sensorColors');
      if (stored) {
        const parsed = JSON.parse(stored);
        const restored = new Map<string, Map<string, string>>(
          parsed.map(([satId, sensors]: [string, Array<[string, string]>]) => [
            satId,
            new Map<string, string>(sensors)
          ])
        );
        setSensorColors(restored);
        console.log('✅ Loaded sensor color overrides from localStorage');
      }
    } catch (error) {
      console.warn('Failed to load sensor colors from localStorage:', error);
    }
  }, []);

  // Persist frame colors to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('grafana_satelliteVisualizer_frameColors', JSON.stringify(frameColors));
    } catch (error) {
      console.warn('Failed to save frame colors to localStorage:', error);
    }
  }, [frameColors]);
  
  // ─── View camera distances (metres from satellite) ───────────────────────────
  // Tweak these to control how far out the camera sits for each snap-to-view.
  // One Earth radius ≈ 6 371 000 m gives a wide enough zoom-out to see the globe.
  const VIEW_DISTANCE_NADIR       = 6_371_000; // ~1× Earth radius above satellite
  const VIEW_DISTANCE_CROSS_TRACK = 6_371_000; // ~1× Earth radius to the side
  const VIEW_DISTANCE_ALONG_TRACK = 6_371_000; // ~1× Earth radius behind satellite
  // ─────────────────────────────────────────────────────────────────────────────

  // Fly camera to satellite with "from above" nadir view
  const flyToSatelliteNadirView = useCallback((satelliteId: string, duration = 0.5, distance = VIEW_DISTANCE_NADIR) => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) {
      return;
    }

    const satellite = satellites.find(s => s.id === satelliteId);
    if (!satellite) {
      return;
    }

    // Use current viewer clock time (not the timestamp state which may be stale)
    const currentTime = viewer.clock.currentTime;
    const satPos = satellite.position.getValue(currentTime);
    if (!satPos) {
      return;
    }

    // Pause clock during fly so the satellite doesn't drift while the camera is
    // animating — resume exactly when the flight completes.
    const wasPlaying = viewer.clock.shouldAnimate;
    if (wasPlaying) { viewer.clock.shouldAnimate = false; }

    // Calculate radial direction (Earth center → Satellite)
    const radialDirection = Cartesian3.subtract(satPos, Cartesian3.ZERO, new Cartesian3());
    Cartesian3.normalize(radialDirection, radialDirection);

    // Position camera at specified distance above satellite along radial line
    const cameraPosition = Cartesian3.add(
      satPos,
      Cartesian3.multiplyByScalar(radialDirection, distance, new Cartesian3()),
      new Cartesian3()
    );

    // Camera looks at satellite (down toward Earth)
    viewer.camera.flyTo({
      destination: cameraPosition,
      orientation: {
        direction: Cartesian3.negate(radialDirection, new Cartesian3()),
        up: Cartesian3.UNIT_Z,
      },
      duration: duration,
      complete: () => { if (wasPlaying) { viewer.clock.shouldAnimate = true; } },
    });

    console.log(`🚀 Flying to ${satellite.name} - Nadir View (${distance}m above, ${duration}s)`);
  }, [satellites, viewerRef]);

  const flyToCrossTrackView = useCallback((satelliteId: string, duration = 0.5, distance = VIEW_DISTANCE_CROSS_TRACK) => {
    const viewer = viewerRef.current?.cesiumElement;
    const satellite = satellites.find(s => s.id === satelliteId);
    if (!viewer || !satellite) { return; }

    const currentTime = viewer.clock.currentTime;
    const satPos = satellite.position.getValue(currentTime);
    if (!satPos) { return; }

    const wasPlaying = viewer.clock.shouldAnimate;
    if (wasPlaying) { viewer.clock.shouldAnimate = false; }

    // Cross-track = orbit normal = normalize(position × velocity)
    const nextTime = JulianDate.addSeconds(currentTime, 1, new JulianDate());
    const nextPos = satellite.position.getValue(nextTime);
    if (!nextPos) { return; }
    const velocity = Cartesian3.subtract(nextPos, satPos, new Cartesian3());
    const crossTrack = Cartesian3.normalize(
      Cartesian3.cross(satPos, velocity, new Cartesian3()), new Cartesian3()
    );

    const cameraPosition = Cartesian3.add(
      satPos, Cartesian3.multiplyByScalar(crossTrack, distance, new Cartesian3()), new Cartesian3()
    );
    const radial = Cartesian3.normalize(satPos, new Cartesian3());

    viewer.camera.flyTo({
      destination: cameraPosition,
      orientation: {
        direction: Cartesian3.negate(crossTrack, new Cartesian3()),
        up: radial,
      },
      duration,
      complete: () => { if (wasPlaying) { viewer.clock.shouldAnimate = true; } },
    });
  }, [satellites, viewerRef]);

  const flyToAlongTrackView = useCallback((satelliteId: string, duration = 0.5, distance = VIEW_DISTANCE_ALONG_TRACK) => {
    const viewer = viewerRef.current?.cesiumElement;
    const satellite = satellites.find(s => s.id === satelliteId);
    if (!viewer || !satellite) { return; }

    const currentTime = viewer.clock.currentTime;
    const satPos = satellite.position.getValue(currentTime);
    if (!satPos) { return; }

    const wasPlaying = viewer.clock.shouldAnimate;
    if (wasPlaying) { viewer.clock.shouldAnimate = false; }

    // Along-track = direction of motion
    const nextTime = JulianDate.addSeconds(currentTime, 1, new JulianDate());
    const nextPos = satellite.position.getValue(nextTime);
    if (!nextPos) { return; }
    const alongTrack = Cartesian3.normalize(
      Cartesian3.subtract(nextPos, satPos, new Cartesian3()), new Cartesian3()
    );

    // Place camera behind satellite (opposite to velocity)
    const cameraPosition = Cartesian3.add(
      satPos, Cartesian3.multiplyByScalar(Cartesian3.negate(alongTrack, new Cartesian3()), distance, new Cartesian3()), new Cartesian3()
    );
    const radial = Cartesian3.normalize(satPos, new Cartesian3());

    viewer.camera.flyTo({
      destination: cameraPosition,
      orientation: {
        direction: alongTrack,
        up: radial,
      },
      duration,
      complete: () => { if (wasPlaying) { viewer.clock.shouldAnimate = true; } },
    });
  }, [satellites, viewerRef]);

  const flyToFreeView = useCallback((satelliteId: string, duration = 0.5) => {
    const viewer = viewerRef.current?.cesiumElement;
    const satellite = satellites.find(s => s.id === satelliteId);
    if (!viewer || !satellite) { return; }
    const satPos = satellite.position.getValue(viewer.clock.currentTime);
    if (!satPos) { return; }
    const diagonal = Cartesian3.normalize(new Cartesian3(1, 0 , 1), new Cartesian3());
    const cameraPos = Cartesian3.add(satPos, Cartesian3.multiplyByScalar(diagonal, 5, new Cartesian3()), new Cartesian3());
    viewer.camera.flyTo({
      destination: cameraPos,
      orientation: { direction: Cartesian3.normalize(Cartesian3.subtract(satPos, cameraPos, new Cartesian3()), new Cartesian3()), up: Cartesian3.UNIT_Z },
      duration,
    });
  }, [satellites, viewerRef]);

  // Auto-track satellite and adjust camera based on mode
  useEffect(() => {
    if (selectedMode === 'satellite' || selectedMode === 'celestial') {
      // Reset FOV to Cesium default when leaving Ground Station POV
      const viewer = viewerRef.current?.cesiumElement;
      if (viewer) { viewer.camera.frustum.fov = (60 * Math.PI) / 180; }

      // Enable tracking for Satellite Focus and Celestial Map modes
      if (!isTracked) {
        setIsTracked(true);
        console.log(`🎯 Satellite tracking enabled (${selectedMode === 'satellite' ? 'Satellite Focus' : 'Celestial Map'} mode)`);
      }
    } else if (selectedMode === 'earth') {
      // Reset FOV to Cesium default when leaving Ground Station POV
      const viewer = viewerRef.current?.cesiumElement;
      if (viewer) { viewer.camera.frustum.fov = (60 * Math.PI) / 180; }

      // Earth Focus mode: smooth transition to nadir view then enable free camera
      if (isTracked && trackedSatelliteId) {
        const earthRadius = 6378137; // meters
        const safeDistance = earthRadius * 2; // ~12,756 km (2x Earth radius)
        const duration = 1.5; // Smooth 1.5 second transition

        flyToSatelliteNadirView(trackedSatelliteId, duration, safeDistance);

        // Wait for animation to complete before activating free camera
        setTimeout(() => {
          setIsTracked(false);
          console.log('🌍 Free camera enabled (Earth Focus mode - Nadir view)');
        }, duration * 1000 + 100); // Animation duration + small buffer
      } else if (prevModeRef.current === 'groundstation' && trackedSatelliteId) {
        // Coming from GS POV: isTracked is already false so no setTimeout needed.
        // Fly out to a sane nadir vantage point so the user lands on Earth view,
        // not underground staring at the sky.
        const earthRadius = 6378137;
        flyToSatelliteNadirView(trackedSatelliteId, 1.5, earthRadius * 2);
        console.log('🌍 GS POV → Earth Focus: flying to nadir view');
      }
    } else if (selectedMode === 'groundstation') {
      // Ground Station POV: fly camera to 2m above the GS eye point, looking straight up (zenith)
      setIsTracked(false);
      const viewer = viewerRef.current?.cesiumElement;

      // Auto-select first GS and open sidebar to ground stations tab if none selected
      let effectiveGsId = trackedGroundStationId;
      if (!effectiveGsId && groundStations.length > 0) {
        effectiveGsId = groundStations[0].id;
        setTrackedGroundStationId(effectiveGsId);
        setIsSidebarOpen(true);
        setActiveTab('groundstations');
      }

      const gs = groundStations.find(g => g.id === effectiveGsId);
      if (!viewer || !gs) { return; }

      const eyeHeight = gs.altitude + 5;   // 5 m above GS altitude = focal point
      const camHeight = gs.altitude + 7;   // camera sits 2 m above focal point
      const gsPosition = Cartesian3.fromDegrees(gs.longitude, gs.latitude, camHeight);

      // Radial (outward) direction at this surface point = zenith = "up" for the viewer
      const zenith = Ellipsoid.WGS84.geodeticSurfaceNormal(
        Cartesian3.fromDegrees(gs.longitude, gs.latitude, eyeHeight), new Cartesian3()
      );
      // Camera looks straight up; pick any consistent "right" direction (east)
      const east = Cartesian3.normalize(
        Cartesian3.cross(Cartesian3.UNIT_Z, zenith, new Cartesian3()), new Cartesian3()
      );

      // Widen FOV for immersive sky view
      viewer.camera.frustum.fov = (GS_POV_FOV_DEG * Math.PI) / 180;

      viewer.camera.flyTo({
        destination: gsPosition,
        orientation: {
          direction: zenith,   // looking toward the sky
          up: east,            // "up" on screen = east horizon
        },
        duration: 1.5,
      });
      console.log(`📡 Ground Station POV: ${gs.name} (alt ${gs.altitude}m, FOV ${GS_POV_FOV_DEG}°)`);
    }

    prevModeRef.current = selectedMode;
  }, [selectedMode, isTracked, trackedSatelliteId, trackedGroundStationId, groundStations, flyToSatelliteNadirView, viewerRef]);

  // Re-fly when user picks a different ground station while already in GS POV mode
  useEffect(() => {
    if (selectedMode !== 'groundstation' || !trackedGroundStationId) { return; }
    const viewer = viewerRef.current?.cesiumElement;
    const gs = groundStations.find(g => g.id === trackedGroundStationId);
    if (!viewer || !gs) { return; }

    const camHeight = gs.altitude + 7;
    const gsPosition = Cartesian3.fromDegrees(gs.longitude, gs.latitude, camHeight);
    const zenith = Ellipsoid.WGS84.geodeticSurfaceNormal(
      Cartesian3.fromDegrees(gs.longitude, gs.latitude, gs.altitude + 5), new Cartesian3()
    );
    const east = Cartesian3.normalize(
      Cartesian3.cross(Cartesian3.UNIT_Z, zenith, new Cartesian3()), new Cartesian3()
    );

    viewer.camera.flyTo({
      destination: gsPosition,
      orientation: { direction: zenith, up: east },
      duration: 1.0,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedGroundStationId]);

  // Drive SVG overlay updates via setInterval — fully independent of Cesium's render loop.
  // setInterval cannot be throttled by canvas visibility or trackedEntity camera flies.
  // 100 ms (10 fps) is sufficient for SVG overlays.
  // Active for GS POV polar plot and Celestial Map → Total Map.
  useEffect(() => {
    const isOverlayActive =
      selectedMode === 'groundstation' ||
      (selectedMode === 'celestial' && celestialCameraView === 'total-map');
    if (!isOverlayActive || !isViewerReady) { setOverlayClockTime(null); return; }
    const id = setInterval(() => {
      const viewer = viewerRef.current?.cesiumElement;
      if (viewer) { setOverlayClockTime(JulianDate.clone(viewer.clock.currentTime)); }
    }, 100); // 10 fps — sufficient for SVG overlay, avoids React render overload
    return () => clearInterval(id);
  }, [selectedMode, celestialCameraView, isViewerReady, viewerRef]);

  // Mutual exclusion: turning on LoS turns off FOV Footprint, and vice versa
  useEffect(() => {
    if (options.showVisibilityLoS && options.showFOVFootprint) {
      onOptionsChange({ ...options, showFOVFootprint: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.showVisibilityLoS]);

  useEffect(() => {
    if (options.showFOVFootprint && options.showVisibilityLoS) {
      onOptionsChange({ ...options, showVisibilityLoS: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.showFOVFootprint]);

  // Focus satellite settings modal when it opens (for ESC key handling)
  useEffect(() => {
    if (settingsModalSatelliteId && satelliteModalRef.current) {
      satelliteModalRef.current.focus();
    }
  }, [settingsModalSatelliteId]);

  // Focus ground station settings modal when it opens (for ESC key handling)
  useEffect(() => {
    if (settingsModalGroundStationId && groundStationModalRef.current) {
      groundStationModalRef.current.focus();
    }
  }, [settingsModalGroundStationId]);
  
  // Hover detection for sensor cones
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || !isLoaded) {
      return;
    }
    
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    let hoverTimeout: NodeJS.Timeout | null = null;
    
    handler.setInputAction((movement: any) => {
      // Clear any pending timeout
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }

      // scene.pick() triggers a full pick-render pass. In 2D / Columbus View mode
      // Cesium tries to normalize billboard positions and crashes on any entity
      // sitting at an invalid ECEF coordinate. Skip picking in non-3D modes.
      if (viewer.scene.mode !== SceneMode.SCENE3D) {
        setHoveredEntityName(null);
        setTooltipPosition(null);
        return;
      }

      const pickedObject = viewer.scene.pick(movement.endPosition);
      
      if (pickedObject && pickedObject.id && pickedObject.id.name) {
        const entityName = pickedObject.id.name;
        
        // Filter for sensor-related entities (containing FOV info, Footprint, or Celestial)
        // Sensor cones: "SatName - SensorName (FOV: XX°)"
        // Footprints: "SatName - SensorName Footprint"
        // Celestial: "SatName - SensorName Celestial FOV"
        const isSensorEntity = entityName.includes('FOV') || 
                               entityName.includes('Celestial') || 
                               entityName.includes('Footprint') ||
                               /\(FOV:.*°\)/.test(entityName); // Match "(FOV: XX°)" pattern
        
        if (isSensorEntity) {
          // Add a small delay before showing tooltip (prevents flickering when moving quickly)
          hoverTimeout = setTimeout(() => {
            setHoveredEntityName(entityName);
            setTooltipPosition({ x: movement.endPosition.x, y: movement.endPosition.y });
          }, 300); // 300ms delay
        } else {
          setHoveredEntityName(null);
          setTooltipPosition(null);
        }
      } else {
        setHoveredEntityName(null);
        setTooltipPosition(null);
      }
    }, ScreenSpaceEventType.MOUSE_MOVE);
    
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      handler.destroy();
    };
  }, [viewerRef, isLoaded]);

  useEffect(() => {
    const timeInterval = new TimeInterval({
      start: JulianDate.fromDate(timeRange.from.toDate()),
      stop: JulianDate.addDays(JulianDate.fromDate(timeRange.to.toDate()), 1, new JulianDate()),
    });

    // https://community.cesium.com/t/correct-way-to-wait-for-transform-to-be-ready/24800
    Transforms.preloadIcrfFixed(timeInterval).then(() => setLoaded(true));
  }, [timeRange]);

  // Parse satellite data from DataFrames
  // Main data parsing: extract satellite position, orientation, availability, and sensors.
  // If options.digitalTwinUrl is set, data is fetched from the mockup digital twin server
  // using the panel's current time range and converted before parsing.  On fetch failure,
  // the panel silently falls back to the configured datasource (check F12 console for warnings).
  // Note: parseSatellites() only uses options.coordinatesType internally.
  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    function applyFrames(frames: DataFrame[], panelDataForGs: typeof data) {
      try {
        const parsedSatellites    = parseSatellites(frames, options);
        const parsedGroundStations = parseGroundStations(panelDataForGs);

        // Scenario 3 — orientation override staging area.
        //
        // STEP 1 (current): raw server attitude shown — Z-axis slow spin from server.
        //   No override applied here; the SampledProperty from the parser is used directly.
        //   Verify in Cesium that SAT-COMM's body axes / Antenna cone slowly spins around Z.
        //
        // STEP 2 (next): uncomment the fixed-quaternion block below to confirm the
        //   override mechanism works before enabling GS-pointing maths.
        //
        // STEP 3 (final): replace with CallbackProperty GS-pointing computation.

        // STEP 3: per-frame GS-pointing orientation override.
        //
        // Frame convention used by the manual cone-rendering and footprint code:
        //   - Positions returned by SampledPositionProperty.getValue are ECEF.
        //   - Sensor cone direction is computed as Matrix3.fromQuaternion(q) · [0,0,1]
        //     and added to the ECEF satellite position with NO frame conversion
        //     (see CesiumEntityRenderers.tsx and utils/projections.ts).
        //   - Therefore the orientation quaternion must encode a body→ECEF rotation
        //     so that R · [0,0,1] is the antenna boresight expressed in ECEF.
        //
        // (Cesium's own ModelVisualizer interprets Entity.orientation in its local
        // frame, which for a FIXED-frame position is also ECEF, so the model and
        // the cone agree.)
        if (options.scenarioId === ScenarioId.Scenario3 && parsedGroundStations.length > 0) {
          const targetGs = parsedGroundStations[0];
          const gsEcef   = Cartesian3.fromDegrees(targetGs.longitude, targetGs.latitude, targetGs.altitude);

          parsedSatellites.forEach(sat => {
            (sat as any).orientation = new CallbackProperty((time: JulianDate) => {
              const satEcef = sat.position.getValue(time);
              if (!satEcef) { return Quaternion.IDENTITY; }

              // Body +Z target (antenna boresight) in ECEF: SAT → GS.
              const zEcef = Cartesian3.normalize(
                Cartesian3.subtract(gsEcef, satEcef, new Cartesian3()),
                new Cartesian3()
              );

              // Up hint: satellite radial in ECEF (just the normalised position).
              const radialEcef = Cartesian3.normalize(satEcef, new Cartesian3());

              // X axis: perpendicular to boresight and radial. Falls back to a
              // generic axis when the satellite is exactly above (or below) the GS.
              const xEcef = Cartesian3.cross(radialEcef, zEcef, new Cartesian3());
              if (Cartesian3.magnitude(xEcef) < 1e-6) {
                Cartesian3.cross(Cartesian3.UNIT_Y, zEcef, xEcef);
              }
              Cartesian3.normalize(xEcef, xEcef);

              // Y axis: completes the right-handed frame.
              const yEcef = Cartesian3.normalize(
                Cartesian3.cross(zEcef, xEcef, new Cartesian3()),
                new Cartesian3()
              );

              // Body→ECEF rotation as a column-major flat array so the three basis
              // vectors land in columns 0, 1, 2 respectively. Column 2 = zEcef
              // means R · [0,0,1] = zEcef = SAT→GS direction in ECEF. ✓
              const rEcef = Matrix3.fromColumnMajorArray([
                xEcef.x, xEcef.y, xEcef.z,
                yEcef.x, yEcef.y, yEcef.z,
                zEcef.x, zEcef.y, zEcef.z,
              ]);

              const gsQuat = Quaternion.fromRotationMatrix(rEcef);

              // During the anomaly window smoothly ramp a 20° tilt around body X
              // in and back out — triangle profile matching the comm_anomaly series.
              const win = anomalyWindowRef.current;
              if (win) {
                const tMs = JulianDate.toDate(time).getTime();
                if (tMs >= win.start && tMs <= win.end) {
                  const span = win.end - win.start;
                  const mid  = win.start + span / 2;
                  // t goes 0→1 at the midpoint then 1→0 at the end
                  const t = 1 - Math.abs((tMs - mid) / (span / 2));
                  const tiltAngle = t * 20 * Math.PI / 180;
                  const tiltQuat = Quaternion.fromAxisAngle(
                    new Cartesian3(1, 0, 0),
                    tiltAngle,
                    new Quaternion()
                  );
                  return Quaternion.multiply(gsQuat, tiltQuat, new Quaternion());
                }
              }

              return gsQuat;
            }, false);
          });
        }

        setSatellites(parsedSatellites);
        setGroundStations(parsedGroundStations);
        console.log(`📡 Parsed ${parsedGroundStations.length} ground station(s)`);
        if (parsedSatellites.length > 0) {
          const firstInterval = parsedSatellites[0].availability.get(0);
          if (firstInterval) {
            setTimestamp(firstInterval.start);
          }
        }
      } catch (error) {
        console.error('❌ Failed to parse satellites:', error);
        setSatellites([]);
        setGroundStations([]);
      }
    }

    function fallbackToDatasource() {
      if (data.series.length > 0) {
        console.log(`🛰️ Parsing ${data.series.length} satellite(s) from datasource...`);
        applyFrames(data.series, data);
      } else {
        setSatellites([]);
      }
    }

    if (options.digitalTwinUrl) {
      const from = timeRange.from.valueOf();
      const to = timeRange.to.valueOf();
      const url = `${options.digitalTwinUrl}/api/satellites?from=${from}&to=${to}&scenario=${options.scenarioId ?? 0}`;

      // Fetch the anomaly window for Scenario 3 so the attitude CallbackProperty
      // can apply a tilt offset during the broken contact interval.
      if (options.scenarioId === ScenarioId.Scenario3) {
        fetch(`${options.digitalTwinUrl}/api/link-anomaly-window`)
          .then(r => r.ok ? r.json() : null)
          .then((win: { start: number; end: number } | null) => {
            anomalyWindowRef.current = win;
            console.log(`📡 Anomaly window: ${win ? new Date(win.start).toISOString() + ' → ' + new Date(win.end).toISOString() : 'none'}`);
          })
          .catch(() => { anomalyWindowRef.current = null; });
      } else {
        anomalyWindowRef.current = null;
      }

      fetch(url)
        .then(r => {
          if (!r.ok) { throw new Error(`HTTP ${r.status}`); }
          return r.json();
        })
        .then((rawJson: any[]) => {
          console.log(`🛰️ Digital twin: received ${rawJson.length} frame(s) from ${url}`);
          const frames = rawJsonToDataFrames(rawJson);
          applyFrames(frames, { ...data, series: frames });
        })
        .catch(err => {
          console.warn(`⚠️ Digital twin fetch failed (${url}): ${err.message}. Falling back to datasource.`);
          fallbackToDatasource();
        });
      return;
    }

    fallbackToDatasource();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, options.coordinatesType, options.digitalTwinUrl, options.scenarioId, timeRange.from.valueOf(), timeRange.to.valueOf(), isLoaded]);
  
  // Default to tracking first satellite
  useEffect(() => {
    if (satellites.length > 0 && !trackedSatelliteId) {
      setTrackedSatelliteId(satellites[0].id);
      console.log(`🎯 Defaulting to track: ${satellites[0].name}`);
    }
  }, [satellites, trackedSatelliteId]);

  useEffect(() => {
    Ion.defaultAccessToken = options.accessToken;
  }, [options.accessToken]);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(`.${styles.topLeftControlsContainer}`)) {
        setIsModeDropdownOpen(false);
        setIsCameraDropdownOpen(false);
        setIsAxesDropdownOpen(false);
      }
    };
    
    if (isModeDropdownOpen || isCameraDropdownOpen || isAxesDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    
    return undefined;
  }, [isModeDropdownOpen, isCameraDropdownOpen, isAxesDropdownOpen, styles.topLeftControlsContainer]);

  // Satellite visibility toggle functions
  useEffect(() => {
    if (options.modelAssetId) {
      IonResource.fromAssetId(options.modelAssetId, { accessToken: options.accessToken })
        .then((resource) => {
          setSatelliteResource(resource);
        })
        .catch((error) => {
          throw new Error(`Error loading Ion Resource of Model: [${error}].`);
        });
    } else if (options.modelAssetUri) {
      setSatelliteResource(options.modelAssetUri);
    } else {
      setSatelliteResource(undefined);
    }
  }, [options.modelAssetId, options.modelAssetUri, options.accessToken]);

  // Only remount Viewer when options that affect the Viewer component itself change
  // Entity-level options (projections, trajectory, etc.) don't need a full remount
  useEffect(() => setViewerKey((prevKey) => prevKey + 1), [
    options.showAnimation,
    options.showTimeline,
    options.showInfoBox,
    options.showBaseLayerPicker,
    options.showSceneModePicker,
    options.showProjectionPicker,
    options.accessToken,
  ]);

  // Generate RA/Dec celestial grid
  useEffect(() => {
    if ((!options.showRADecGrid && selectedMode !== 'celestial') || !timestamp) {
      setRALines([]);
      setDecLines([]);
      setGridLabels([]);
      return;
    }

    const celestialRadius = Ellipsoid.WGS84.maximumRadius * 100; // 100x Earth radius

    const { raLines, decLines } = generateRADecGrid({
      raSpacing: options.raSpacing,
      decSpacing: options.decSpacing,
      celestialRadius,
      referenceTime: timestamp,
    });

    setRALines(raLines);
    setDecLines(decLines);

    // Generate labels if enabled
    if (options.showGridLabels) {
      const labels = generateRADecGridLabels({
        raSpacing: options.raSpacing,
        decSpacing: options.decSpacing,
        celestialRadius,
        referenceTime: timestamp,
      });
      setGridLabels(labels);
    } else {
      setGridLabels([]);
    }
  }, [options.showRADecGrid, selectedMode, options.raSpacing, options.decSpacing, options.showGridLabels, timestamp]);

  // Setup default imagery once when Viewer is created (for persistence)
  useEffect(() => {
    // Only run if viewer exists (guard against race conditions)
    if (!viewerRef.current?.cesiumElement) {
      return;
    }
    
    const viewer = viewerRef.current.cesiumElement;
    const imageryLayers = viewer.imageryLayers;
    
    // Remove default imagery
    if (imageryLayers.length > 0) {
      imageryLayers.removeAll();
    }
    
    // Set default to Carto Dark Matter (no labels)
    const cartoNoLabelsProvider = new UrlTemplateImageryProvider({
      url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_nolabels/{z}/{x}/{y}.png',
      credit: 'Map tiles by Carto, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
    });
    imageryLayers.addImageryProvider(cartoNoLabelsProvider);
  }, [viewerKey]); // Run when Viewer is created/remounted

  useEffect(() => {
    if (!options.subscribeToDataHoverEvent) {
      return;
    }

    const dataHoverSubscriber = eventBus.getStream(DataHoverEvent).subscribe((event) => {
      if (event?.payload?.point?.time) {
        setTimestamp(JulianDate.fromDate(new Date(event.payload.point.time)));
      }
    });

    const graphHoverSubscriber = eventBus.getStream(LegacyGraphHoverEvent).subscribe((event) => {
      if (event?.payload?.point?.time) {
        setTimestamp(JulianDate.fromDate(new Date(event.payload.point.time)));
      }
    });

    return () => {
      dataHoverSubscriber.unsubscribe();
      graphHoverSubscriber.unsubscribe();
    };
  }, [eventBus, options.subscribeToDataHoverEvent]);

  return (
    <div
      className={cx(
        styles.wrapper,
        css`
          width: ${width}px;
          height: ${height}px;
        `
      )}
    >
      <div className={styles.panelContainer}>
        {/* Main content area - shrinks when sidebar opens */}
        <div className={cx(styles.mainContent, styles.cesiumControls)}>
          {/* Top-Left Control Panel - Mode & Camera Dropdowns */}
          <TopLeftControls
            isModeDropdownOpen={isModeDropdownOpen}
            setIsModeDropdownOpen={setIsModeDropdownOpen}
            isCameraDropdownOpen={isCameraDropdownOpen}
            setIsCameraDropdownOpen={setIsCameraDropdownOpen}
            isAxesDropdownOpen={isAxesDropdownOpen}
            setIsAxesDropdownOpen={setIsAxesDropdownOpen}
            selectedMode={selectedMode}
            setSelectedMode={setSelectedMode}
            satelliteCameraView={satelliteCameraView}
            setSatelliteCameraView={setSatelliteCameraView}
            celestialCameraView={celestialCameraView}
            setCelestialCameraView={setCelestialCameraView}
            earthCameraView={earthCameraView}
            setEarthCameraView={setEarthCameraView}
            showLVLHAxes={showLVLHAxes}
            setShowLVLHAxes={setShowLVLHAxes}
            showBodyAxes={showBodyAxes}
            setShowBodyAxes={setShowBodyAxes}
            showITRFAxes={showITRFAxes}
            setShowITRFAxes={setShowITRFAxes}
            showICRFAxes={showICRFAxes}
            setShowICRFAxes={setShowICRFAxes}
            onNadirViewClick={() => trackedSatelliteId && flyToSatelliteNadirView(trackedSatelliteId)}
            onCrossTrackViewClick={() => trackedSatelliteId && flyToCrossTrackView(trackedSatelliteId)}
            onAlongTrackViewClick={() => trackedSatelliteId && flyToAlongTrackView(trackedSatelliteId)}
            onFixedViewClick={() => trackedSatelliteId && flyToFreeView(trackedSatelliteId)}
            trackedSatelliteId={trackedSatelliteId}
            styles={styles}
          />
      
          <Viewer
        full
        animation={options.showAnimation}
        timeline={options.showTimeline}
        infoBox={options.showInfoBox}
        baseLayerPicker={options.showBaseLayerPicker}
        sceneModePicker={options.showSceneModePicker}
        projectionPicker={options.showProjectionPicker}
        navigationHelpButton={false}
        fullscreenButton={false}
        geocoder={false}
        homeButton={false}
        key={viewerKey}
        creditContainer="cesium-credits"
        ref={(ref) => {
          // Store ref for use in useEffect (imagery setup)
          viewerRef.current = ref;

          if (!ref?.cesiumElement) {
            // Viewer is unmounting or not yet ready — prevent entity children from rendering
            setIsViewerReady(false);
            return;
          }

          // Cesium Viewer is fully constructed; allow entity children to render
          setIsViewerReady(true);

          {
            const viewer = ref.cesiumElement;
            const controller = viewer.scene.screenSpaceCameraController;
            const camera = viewer.scene.camera;
            
            // WGS84 Earth radius
            const earthRadius = 6378137; // meters
            
            // Controller limit: 3x Earth radius (works smoothly for tracked mode)
            controller.maximumZoomDistance = earthRadius * 3; // ~19,134 km
            controller.minimumZoomDistance = 5; // 5 metres
            controller.enableCollisionDetection = false;
            
            // Hard camera height limit: 5x Earth radius (catches free camera mode)
            // const hardMaxZoomDistance = earthRadius * 5; // ~31,890 km
            
            
            
            // Extend camera far clipping plane for celestial grid visibility
            const celestialDistance = earthRadius * 100;
            camera.frustum.far = celestialDistance * 3;

            // Ensure timeline and animation widgets sit above the GS POV overlay (zIndex 9)
            const tl = viewer.timeline?.container as HTMLElement | undefined;
            const an = viewer.animation?.container as HTMLElement | undefined;
            if (tl) { tl.style.zIndex = '10'; }
            if (an) { an.style.zIndex = '10'; }
            
            // Add Carto options to BaseLayerPicker (runs in ref callback for guaranteed timing)
            // Note: Default imagery setup is in useEffect to prevent reset on re-renders
            if (viewer.baseLayerPicker) {
              const vm = viewer.baseLayerPicker.viewModel;
              
              // Check if already added (avoid duplicates)
              const hasCartoNoLabels = vm.imageryProviderViewModels.some((p: any) => p.name === 'Carto Dark Matter (No Labels)');
              
              if (!hasCartoNoLabels) {
                // Find Stadia Dark icon to reuse
                const stadiaViewModel = vm.imageryProviderViewModels.find(
                  (p: any) => p.name === 'Stadia Alidade Smooth Dark'
                );
                const darkIconUrl = stadiaViewModel?.iconUrl || buildModuleUrl('Widgets/Images/ImageryProviders/openStreetMap.png');
                
                // Create Carto Dark Matter (No Labels) option
                const cartoNoLabelsViewModel = new ProviderViewModel({
                  name: 'Carto Dark Matter (No Labels)',
                  iconUrl: darkIconUrl,
                  tooltip: 'Dark theme map without city/country labels - clean view with borders only',
                  creationFunction: () => new UrlTemplateImageryProvider({
                    url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_nolabels/{z}/{x}/{y}.png',
                    credit: 'Map tiles by Carto, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
                  }),
                });
                
                // Create Carto Dark Matter (With Labels) option
                const cartoWithLabelsViewModel = new ProviderViewModel({
                  name: 'Carto Dark Matter (With Labels)',
                  iconUrl: darkIconUrl,
                  tooltip: 'Dark theme map with city/country labels',
                  creationFunction: () => new UrlTemplateImageryProvider({
                    url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
                    credit: 'Map tiles by Carto, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
                  }),
                });
                
                // Add both options to the picker
                vm.imageryProviderViewModels.push(cartoNoLabelsViewModel, cartoWithLabelsViewModel);
                
                // Set the selected imagery to Carto Dark Matter (No Labels) - only on first add
                const cartoNoLabelsVM = vm.imageryProviderViewModels.find(
                  (p: any) => p.name === 'Carto Dark Matter (No Labels)'
                );
                
                if (cartoNoLabelsVM) {
                  vm.selectedImagery = cartoNoLabelsVM;
                }
              }
            }
          }
        }}
      >
        {timestamp && <Clock currentTime={timestamp} />}

        {/* Entity children are gated on isViewerReady to prevent Resium from accessing
            Cesium's _cesiumWidget before the Viewer has fully initialized. Without this
            guard, SPA navigation (e.g. clicking Edit panel) causes a race condition that
            produces "can't access property 'scene', _cesiumWidget is undefined". */}
        {isViewerReady && <>
        
        {/* Main Satellite Entities - Multiple satellites support */}
        {/* Main Satellite Entities - Hidden in Celestial Map mode */}
        {selectedMode !== 'celestial' && satellites
          .filter(sat => !hiddenSatellites.has(sat.id))
          .map((satellite) => {
            const isThisSatelliteTracked = isTracked && trackedSatelliteId === satellite.id;
            const hasEllipsoidVisible = options.showUncertaintyEllipsoids;
            return (
              <SatelliteEntityRenderer
                key={satellite.id}
                satellite={satellite}
                options={options}
                satelliteResource={satelliteResource}
                isTracked={isThisSatelliteTracked}
                hasEllipsoidVisible={hasEllipsoidVisible}
              />
            );
          })
        }
        
        {/* Visible tracking entity for Celestial Map mode */}
        {/* Provides a tracking anchor point at satellite position when satellite model is hidden */}
        {selectedMode === 'celestial' && satellites
          .filter(sat => !hiddenSatellites.has(sat.id))
          .map((satellite) => {
            const isThisSatelliteTracked = isTracked && trackedSatelliteId === satellite.id;
            return (
              <Entity
                key={`${satellite.id}-celestial-tracker`}
                id={satellite.id} // Use same ID as satellite for proper tracking
                name={`${satellite.name} (Celestial Tracking)`}
                position={satellite.position}
                orientation={satellite.orientation}
                availability={satellite.availability}
                tracked={isThisSatelliteTracked}
              >
                {/* Visible marker for debugging tracking */}
                <PointGraphics 
                  pixelSize={15}
                  color={Color.YELLOW}
                  outlineColor={Color.BLACK}
                  outlineWidth={2}
                />
                <LabelGraphics
                  text={satellite.name}
                  font="14px sans-serif"
                  fillColor={Color.WHITE}
                  outlineColor={Color.BLACK}
                  outlineWidth={2}
                  style={LabelStyle.FILL_AND_OUTLINE}
                  pixelOffset={new Cartesian2(0, -20)}
                />
              </Entity>
            );
          })
        }
        {/* Body Axes (X/Y/Z attitude vectors) - Per-satellite - Hidden in Celestial Map mode */}
        {selectedMode !== 'celestial' && options.showAttitudeVisualization && showBodyAxes && satellites
          .filter(sat => !hiddenSatellites.has(sat.id))
          .map((satellite) => {
            const isThisSatelliteTracked = isTracked && trackedSatelliteId === satellite.id;
            return (
              <BodyAxesRenderer
                key={`${satellite.id}-body-axes`}
                satellite={satellite}
                options={options}
                isTracked={isThisSatelliteTracked}
                viewerRef={viewerRef}
                attitudeVectors={attitudeVectors}
              />
            );
          })
        }

        {/* LVLH Axes (orbit-aligned reference frame: radial/tangent/cross-track) */}
        {selectedMode !== 'celestial' && options.showAttitudeVisualization && showLVLHAxes && lvlhSatellites
          .filter(sat => !hiddenSatellites.has(sat.id))
          .map((satellite) => {
            const isThisSatelliteTracked = isTracked && trackedSatelliteId === satellite.id;
            return (
              <BodyAxesRenderer
                key={`${satellite.id}-lvlh-axes`}
                satellite={satellite}
                options={options}
                isTracked={isThisSatelliteTracked}
                viewerRef={viewerRef}
                attitudeVectors={lvlhVectors}
              />
            );
          })
        }

        {/* ITRF Axes (Earth-fixed frame: X → prime meridian, Y → 90°E, Z → North Pole) */}
        {selectedMode !== 'celestial' && options.showAttitudeVisualization && showITRFAxes && itrfSatellites
          .filter(sat => !hiddenSatellites.has(sat.id))
          .map((satellite) => {
            const isThisSatelliteTracked = isTracked && trackedSatelliteId === satellite.id;
            return (
              <BodyAxesRenderer
                key={`${satellite.id}-itrf-axes`}
                satellite={satellite}
                options={options}
                isTracked={isThisSatelliteTracked}
                viewerRef={viewerRef}
                attitudeVectors={itrfVectors}
              />
            );
          })
        }

        {/* ICRF Axes (celestial inertial frame: X → vernal equinox, Z → north celestial pole) */}
        {selectedMode !== 'celestial' && options.showAttitudeVisualization && showICRFAxes && icrfSatellites
          .filter(sat => !hiddenSatellites.has(sat.id))
          .map((satellite) => {
            const isThisSatelliteTracked = isTracked && trackedSatelliteId === satellite.id;
            return (
              <BodyAxesRenderer
                key={`${satellite.id}-icrf-axes`}
                satellite={satellite}
                options={options}
                isTracked={isThisSatelliteTracked}
                viewerRef={viewerRef}
                attitudeVectors={icrfVectors}
              />
            );
          })
        }
        
        {/* Sensor Visualization (Cones, Footprints, Celestial Projections) */}
        {/* Satellite & Celestial modes: show only tracked satellite's FOVs. Earth mode: show earth footprints only */}
        {options.showAttitudeVisualization && satellites
          .filter(sat => !hiddenSatellites.has(sat.id))
          .filter(sat => {
            // Earth Focus mode: show all visible satellites so footprints render
            if (selectedMode === 'earth') {
              return true;
            }
            
            // Satellite Focus & Celestial Map modes: show only tracked satellite's FOVs
            if (selectedMode === 'satellite' || selectedMode === 'celestial') {
              // Only show if we have a tracked satellite and this is it
              if (!trackedSatelliteId) {
                return false; // No satellite tracked, hide all
              }
              return sat.id === trackedSatelliteId;
            }
            
            // Fallback (shouldn't reach here)
            return false;
          })
          .map((satellite) => {
            const isThisSatelliteTracked = isTracked && trackedSatelliteId === satellite.id;
            return satellite.sensors.map((sensor, idx) => {
              // Get the actual color for this sensor (respecting user overrides)
              const sensorColor = _getSensorColor(satellite.id, sensor.id, sensor, idx);
              
              // Earth Focus mode: only show earth surface footprints (no cones, no celestial projection)
              // Celestial Map mode: hide sensor cones (only show celestial FOV projection)
              const effectiveOptions = selectedMode === 'earth'
                ? { ...options, showSensorCones: false, showCelestialFOV: false }
                : selectedMode === 'celestial' 
                ? { ...options, showSensorCones: false }
                : options;
              
              return (
                <SensorVisualizationRenderer
                  key={`${satellite.id}-sensor-${sensor.id}`}
                  satellite={satellite}
                  sensor={sensor}
                  options={effectiveOptions}
                  isTracked={isThisSatelliteTracked}
                  viewerRef={viewerRef}
                  sensorIndex={idx}
                  transparentMode={satelliteRenderSettings.get(satellite.id)?.transparentCones || false}
                  customColor={sensorColor}
                  selectedMode={selectedMode}
                />
              );
            });
          })
        }
        
        {/* Visibility / Line-of-Sight circles - Earth surface coverage per satellite */}
        {/* Only in Earth & Satellite modes; hidden in Celestial Map */}
        {options.showVisibilityLoS && selectedMode !== 'celestial' && satellites
          .filter(sat => !hiddenSatellites.has(sat.id))
          .map((satellite, satIdx) => {
            const hue = (satIdx * 47) % 360;
            const losFill = Color.fromHsl(hue / 360, 0.7, 0.6, 0.12);
            const losOutline = Color.fromHsl(hue / 360, 0.9, 0.75, 0.85);
            return (
              <Entity
                key={`${satellite.id}-los-visibility`}
                availability={satellite.availability}
                position={satellite.position}
              >
                <EllipseGraphics
                  semiMajorAxis={new CallbackProperty((time) => {
                    const satPos = satellite.position.getValue(time);
                    if (!satPos) { return 0; }
                    return computeVisibilityLoS(satPos) ?? 0;
                  }, false)}
                  semiMinorAxis={new CallbackProperty((time) => {
                    const satPos = satellite.position.getValue(time);
                    if (!satPos) { return 0; }
                    return computeVisibilityLoS(satPos) ?? 0;
                  }, false)}
                  height={1000}
                  material={losFill}
                  outline={true}
                  outlineColor={losOutline}
                  outlineWidth={2}
                />
              </Entity>
            );
          })
        }

        {/* Uncertainty Ellipsoids - Per-satellite - Hidden in Celestial Map mode */}
        {/* Only render if global toggle is ON */}
        {selectedMode !== 'celestial' && options.showAttitudeVisualization && options.showUncertaintyEllipsoids && satellites
          .filter(sat => !hiddenSatellites.has(sat.id))
          .map((satellite) => {
            // Only render if satellite has ellipsoid data
            if (!satellite.ellipsoid || satellite.ellipsoid.length === 0) {
              return null;
            }
            
            return (
              <UncertaintyEllipsoidRenderer
                key={`${satellite.id}-uncertainty`}
                satellite={satellite}
                opacityMode={options.uncertaintyOpacityMode}
                ellipsoidColor={options.uncertaintyColor}
                sigmaScale={1.0}
              />
            );
          })
        }
        
        {/* RA/Dec Celestial Grid */}
        {options.showAttitudeVisualization && (options.showRADecGrid || selectedMode === 'celestial') && (
          <CelestialGridRenderer
            options={options}
            raLines={raLines}
            decLines={decLines}
            gridLabels={gridLabels}
          />
        )}
        
        {/* Celestial Bodies (Sun + Earth Center) — only in celestial mode.
            The Earth Center entity sits at Cartesian3.ZERO which Cesium cannot
            normalize in 2D/Columbus scene modes, causing a crash. */}
        {selectedMode === 'celestial' && (
          <CelestialBodiesRenderer
            options={options}
            viewerRef={viewerRef}
          />
        )}
        {options.locations.map((location, index) => (
          <Entity
            name={location.name}
            position={Cartesian3.fromDegrees(location.longitude, location.latitude, location.altitude)}
            key={index}
          >
            <PointGraphics
              pixelSize={options.locationPointSize}
              color={Color.fromCssColorString(options.locationPointColor)}
            />
            <LabelGraphics text={location.name} pixelOffset={new Cartesian2(30.0, 30.0)} />
          </Entity>
        ))}

        {/* Ground Stations */}
        {groundStations
          .filter(gs => !hiddenGroundStations.has(gs.id))
          .map((gs) => (
            <GroundStationRenderer key={gs.id} groundStation={gs} />
          ))
        }

        </>} {/* end isViewerReady guard */}
      </Viewer>

          <div
            id="cesium-credits"
            className={options.showCredits ? styles.showCesiumCredits : styles.hideCesiumCredits}
          ></div>
          
          {/* Compact Legend Panel - Bottom Right — hidden in Ground Station POV */}
          <div className={`${styles.legendPanel} ${isLegendCollapsed ? 'collapsed' : ''}`} style={selectedMode === 'groundstation' ? { display: 'none' } : {}}>
            <div 
              className={styles.legendHeader}
              onClick={() => setIsLegendCollapsed(!isLegendCollapsed)}
              title={isLegendCollapsed ? 'Expand legend' : 'Collapse legend'}
            >
              <span>Legend</span>
              <button className={styles.legendToggleButton}>
                {isLegendCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
            {!isLegendCollapsed && (
              <div className={styles.legendContent}>
              {/* Reference Frames Section */}
              <div className={styles.legendSection}>
                <div className={styles.legendSectionTitle}>Reference Frames</div>
                
                {/* Body Axes Frame */}
                {showBodyAxes && (
                  <div className={styles.legendItem}>
                    <ColorPicker
                      color={frameColors.body}
                      onChange={(color) => setFrameColors(prev => ({ ...prev, body: color }))}
                    >
                      {({ ref, showColorPicker }) => (
                        <div
                          ref={ref}
                          className={styles.legendColorSwatch}
                          style={{ background: frameColors.body }}
                          onClick={showColorPicker}
                        />
                      )}
                    </ColorPicker>
                    <span className={styles.legendItemName}>Body Axes</span>
                  </div>
                )}

                {/* LVLH Frame */}
                {showLVLHAxes && (
                  <div className={styles.legendItem}>
                    <ColorPicker
                      color={frameColors.lvlh}
                      onChange={(color) => setFrameColors(prev => ({ ...prev, lvlh: color }))}
                    >
                      {({ ref, showColorPicker }) => (
                        <div
                          ref={ref}
                          className={styles.legendColorSwatch}
                          style={{ background: frameColors.lvlh }}
                          onClick={showColorPicker}
                        />
                      )}
                    </ColorPicker>
                    <span className={styles.legendItemName}>LVLH Frame</span>
                  </div>
                )}

                {/* ITRF Frame */}
                {showITRFAxes && (
                  <div className={styles.legendItem}>
                    <ColorPicker
                      color={frameColors.itrf}
                      onChange={(color) => setFrameColors(prev => ({ ...prev, itrf: color }))}
                    >
                      {({ ref, showColorPicker }) => (
                        <div
                          ref={ref}
                          className={styles.legendColorSwatch}
                          style={{ background: frameColors.itrf }}
                          onClick={showColorPicker}
                        />
                      )}
                    </ColorPicker>
                    <span className={styles.legendItemName}>ITRF Frame</span>
                  </div>
                )}

                {/* ICRF Frame */}
                {showICRFAxes && (
                  <div className={styles.legendItem}>
                    <ColorPicker
                      color={frameColors.icrf}
                      onChange={(color) => setFrameColors(prev => ({ ...prev, icrf: color }))}
                    >
                      {({ ref, showColorPicker }) => (
                        <div
                          ref={ref}
                          className={styles.legendColorSwatch}
                          style={{ background: frameColors.icrf }}
                          onClick={showColorPicker}
                        />
                      )}
                    </ColorPicker>
                    <span className={styles.legendItemName}>ICRF Frame</span>
                  </div>
                )}
              </div>
              
              {/* Sensors Section - Show sensors of tracked satellite */}
              {/* Hidden in Earth Focus mode when FOV Footprint is off (sensors invisible, colors irrelevant) */}
              {trackedSatelliteId && options.showSensorCones && !(selectedMode === 'earth' && !options.showFOVFootprint) && (() => {
                const trackedSat = satellites.find(s => s.id === trackedSatelliteId);
                if (!trackedSat || trackedSat.sensors.length === 0) {
                  return null;
                }
                
                return (
                  <div className={styles.legendSection}>
                    <div className={styles.legendSectionTitle}>Sensors ({trackedSat.name})</div>
                    
                    {trackedSat.sensors.map((sensor, idx) => {
                      const sensorColor = _getSensorColor(trackedSat.id, sensor.id, sensor, idx);
                      return (
                        <div key={sensor.id} className={styles.legendItem}>
                          <ColorPicker
                            color={sensorColor}
                            onChange={(color) => _updateSensorColor(trackedSat.id, sensor.id, color)}
                          >
                            {({ ref, showColorPicker }) => (
                              <div
                                ref={ref}
                                className={styles.legendColorSwatch}
                                style={{ background: sensorColor }}
                                onClick={showColorPicker}
                              />
                            )}
                          </ColorPicker>
                          <span className={styles.legendItemName}>{sensor.name}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            )}
          </div>

          {/* Celestial Map — Total Map polar chart overlay */}
          {selectedMode === 'celestial' && celestialCameraView === 'total-map' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: '#000',
                zIndex: 9,
                pointerEvents: 'none',
              }}
            >
              {/* viewBox="0 0 360 180": az 0–360° → x, el +90°→−90° → y 0–180.
                  preserveAspectRatio="none" fills the full panel rectangle. */}
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 360 180"
                preserveAspectRatio="none"
              >
                {/* Sun — equirectangular projection across the full panel */}
                {(() => {
                  if (!overlayClockTime) { return null; }
                  const trackedSat = satellites.find(s => s.id === trackedSatelliteId) ?? satellites[0];
                  if (!trackedSat) { return null; }
                  const satPos = trackedSat.position.getValue(overlayClockTime);
                  if (!satPos) { return null; }

                  const sunECI = Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(
                    overlayClockTime, new Cartesian3()
                  );
                  const icrfToFixed = Transforms.computeIcrfToFixedMatrix(overlayClockTime);
                  const sunECEF = icrfToFixed
                    ? Matrix3.multiplyByVector(icrfToFixed, sunECI, new Cartesian3())
                    : sunECI;

                  const azel = computeAzEl(satPos, sunECEF);
                  if (!azel) { return null; }

                  // Equirectangular: az 0–360° → x 0–360, el +90–(−90)° → y 0–180
                  const x = azel.az;
                  const y = 90 - azel.el;

                  const sunLabel = clampLabel(x + 4.5, y - 1, 'Sun', 4.8);
                  return (
                    <g key="sun">
                      <circle cx={x} cy={y} r="2.2" fill="#FFD700" />
                      <circle cx={x} cy={y} r="3.8" fill="none" stroke="#FFD700" strokeWidth="0.4" opacity="0.5" />
                      <text x={sunLabel.x} y={sunLabel.y} fontSize="4.8" fill="#FFD700" opacity="0.9">Sun</text>
                    </g>
                  );
                })()}

                {/* Sun exclusion zone — 15° keep-out cone around the Sun */}
                {(() => {
                  if (!overlayClockTime) { return null; }
                  const trackedSat = satellites.find(s => s.id === trackedSatelliteId) ?? satellites[0];
                  if (!trackedSat) { return null; }
                  const satPos = trackedSat.position.getValue(overlayClockTime);
                  if (!satPos) { return null; }

                  const sunECI = Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(
                    overlayClockTime, new Cartesian3()
                  );
                  const icrfToFixed = Transforms.computeIcrfToFixedMatrix(overlayClockTime);
                  const sunECEF = icrfToFixed
                    ? Matrix3.multiplyByVector(icrfToFixed, sunECI, new Cartesian3())
                    : sunECI;

                  const ring = generateDirectionDiskRing(satPos, sunECEF, 15);
                  const d = filledRingToSvgPath(ring);
                  if (!d) { return null; }

                  const centerX = ring.reduce((s, p) => s + p.az, 0) / ring.length;
                  const centerY = 90 - ring.reduce((s, p) => s + p.el, 0) / ring.length;
                  const exLabel = clampLabel(centerX, centerY, 'Sun excl.', 3.6, 'middle');
                  return (
                    <g key="sun-exclusion">
                      <path
                        d={d}
                        fill="#FFD700"
                        fillOpacity={0.08}
                        stroke="#FFD700"
                        strokeWidth="0.5"
                        strokeOpacity={0.5}
                        strokeDasharray="2 1.5"
                      />
                      <text x={exLabel.x} y={exLabel.y} fontSize="3.6" fill="#FFD700" opacity="0.6" textAnchor="middle">Sun excl.</text>
                    </g>
                  );
                })()}

                {/* Moon — equirectangular projection across the full panel */}
                {(() => {
                  if (!overlayClockTime) { return null; }
                  const trackedSat = satellites.find(s => s.id === trackedSatelliteId) ?? satellites[0];
                  if (!trackedSat) { return null; }
                  const satPos = trackedSat.position.getValue(overlayClockTime);
                  if (!satPos) { return null; }

                  const moonECI = Simon1994PlanetaryPositions.computeMoonPositionInEarthInertialFrame(
                    overlayClockTime, new Cartesian3()
                  );
                  const icrfToFixed = Transforms.computeIcrfToFixedMatrix(overlayClockTime);
                  const moonECEF = icrfToFixed
                    ? Matrix3.multiplyByVector(icrfToFixed, moonECI, new Cartesian3())
                    : moonECI;

                  const azel = computeAzEl(satPos, moonECEF);
                  if (!azel) { return null; }

                  const x = azel.az;
                  const y = 90 - azel.el;
                  const moonLabel = clampLabel(x + 4.5, y - 1, 'Moon', 4.8);
                  return (
                    <g key="moon">
                      <circle cx={x} cy={y} r="2.2" fill="#C0C0C0" />
                      <circle cx={x} cy={y} r="3.8" fill="none" stroke="#C0C0C0" strokeWidth="0.4" opacity="0.5" />
                      <text x={moonLabel.x} y={moonLabel.y} fontSize="4.8" fill="#C0C0C0" opacity="0.9">Moon</text>
                    </g>
                  );
                })()}

                {/* Earth disk — visible hemisphere boundary from satellite */}
                {(() => {
                  if (!overlayClockTime) { return null; }
                  const trackedSat = satellites.find(s => s.id === trackedSatelliteId) ?? satellites[0];
                  if (!trackedSat) { return null; }
                  const satPos = trackedSat.position.getValue(overlayClockTime);
                  if (!satPos) { return null; }
                  const ring = generateEarthDiskRing(satPos);
                  const d = filledRingToSvgPath(ring);
                  if (!d) { return null; }
                  // Average the ring points for a centroid label position.
                  // Earth disk is always near nadir (y ≈ 180), use ring centroid for x.
                  const centerX = ring.reduce((s, p) => s + p.az, 0) / ring.length;
                  const centerY = 90 - ring.reduce((s, p) => s + p.el, 0) / ring.length;
                  const earthLabel = clampLabel(centerX, centerY, 'Earth', 4.8, 'middle');
                  return (
                    <g key="earth-disk">
                      <path
                        d={d}
                        fill="#4488FF"
                        fillOpacity={0.12}
                        stroke="#4488FF"
                        strokeWidth="0.6"
                        strokeOpacity={0.5}
                      />
                      <text
                        x={earthLabel.x}
                        y={earthLabel.y}
                        fontSize="4.8"
                        fill="#4488FF"
                        opacity="0.7"
                        textAnchor="middle"
                      >Earth</text>
                    </g>
                  );
                })()}

                {/* Ground stations in line-of-sight of the tracked satellite */}
                {(() => {
                  if (!overlayClockTime || groundStations.length === 0) { return null; }
                  const trackedSat = satellites.find(s => s.id === trackedSatelliteId) ?? satellites[0];
                  if (!trackedSat) { return null; }
                  const satPos = trackedSat.position.getValue(overlayClockTime);
                  if (!satPos) { return null; }

                  return groundStations.map(gs => {
                    const gsPos = Cartesian3.fromDegrees(gs.longitude, gs.latitude, gs.altitude);

                    // Visibility: satellite must be above the ground station's horizon
                    const azelFromGs = computeAzEl(gsPos, satPos);
                    if (!azelFromGs || azelFromGs.el < 0) { return null; }

                    // Map position: az/el of the ground station from the satellite's ENU frame
                    const azel = computeAzEl(satPos, gsPos);
                    if (!azel) { return null; }

                    const x = azel.az;
                    const y = 90 - azel.el; // el is negative so y > 90, inside the Earth disk
                    const gsLabel = clampLabel(x + 3.5, y + 1.5, gs.name, 4.8);
                    return (
                      <g key={gs.id}>
                        <circle cx={x} cy={y} r="1.8" fill="#FF8800" opacity="0.9" />
                        <circle cx={x} cy={y} r="3.2" fill="none" stroke="#FF8800" strokeWidth="0.35" opacity="0.5" />
                        <text x={gsLabel.x} y={gsLabel.y} fontSize="4.8" fill="#FF8800" opacity="0.85">{gs.name}</text>
                      </g>
                    );
                  });
                })()}

                {/* Sensor FOV rings — Step 3: filled + seam-cut + pole corners */}
                {(() => {
                  if (!overlayClockTime) { return null; }
                  const trackedSat = satellites.find(s => s.id === trackedSatelliteId) ?? satellites[0];
                  if (!trackedSat || trackedSat.sensors.length === 0) { return null; }

                  const satPos = trackedSat.position.getValue(overlayClockTime);
                  const satOrientation = trackedSat.orientation.getValue(overlayClockTime);
                  if (!satPos || !satOrientation) { return null; }

                  return trackedSat.sensors.map((sensor, idx) => {
                    const color = _getSensorColor(trackedSat.id, sensor.id, sensor, idx);
                    const ring = generateFOVRing(satPos, satOrientation, sensor);
                    const d = filledRingToSvgPath(ring);
                    if (!d) { return null; }

                    // Seam-aware centroid: shift az values crossing the 0/360 seam before averaging.
                    const azVals = ring.map(p => p.az);
                    const maxAz = Math.max(...azVals);
                    const minAz = Math.min(...azVals);
                    const shiftedAz = maxAz - minAz > 180
                      ? azVals.map(a => a < 180 ? a + 360 : a)
                      : azVals;
                    const rawLabelX = (shiftedAz.reduce((s, a) => s + a, 0) / shiftedAz.length) % 360;
                    const rawLabelY = 90 - ring.reduce((s, p) => s + p.el, 0) / ring.length;
                    const fovLabel = clampLabel(rawLabelX, rawLabelY, sensor.name, 4.8, 'middle');

                    return (
                      <g key={sensor.id}>
                        <path
                          d={d}
                          fill={color}
                          fillOpacity={0.18}
                          stroke={color}
                          strokeWidth="0.8"
                        />
                        <text
                          x={fovLabel.x}
                          y={fovLabel.y}
                          fontSize="4.8"
                          fill={color}
                          opacity="0.9"
                          textAnchor="middle"
                        >{sensor.name}</text>
                      </g>
                    );
                  });
                })()}
              </svg>
            </div>
          )}

          {/* Ground Station POV — polar sky chart overlay (Cesium keeps rendering underneath) */}
          {selectedMode === 'groundstation' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: '#000',
                zIndex: 9,
                pointerEvents: 'none',
              }}
            >
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Elevation rings: 0° (horizon), 30°, 60°, zenith dot */}
                <circle cx="50" cy="50" r="40"  fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4" />
                <circle cx="50" cy="50" r="26.7"  fill="none" stroke="rgba(255,255,255,0.3)"  strokeWidth="0.3" />
                <circle cx="50" cy="50" r="13.3"  fill="none" stroke="rgba(255,255,255,0.3)"  strokeWidth="0.3" />
                <circle cx="50" cy="50" r="0.8" fill="rgba(255,255,255,0.5)" />

                {/* Azimuth radials — 6 lines at 30° spacing (N at top, clockwise) */}
                {[0, 30, 60, 90, 120, 150].map((deg) => {
                  const rad = (deg * Math.PI) / 180;
                  const x1 = 50 + 40 * Math.sin(rad);
                  const y1 = 50 - 40 * Math.cos(rad);
                  const x2 = 50 - 40 * Math.sin(rad);
                  const y2 = 50 + 40 * Math.cos(rad);
                  return (
                    <line key={deg}
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="rgba(255,255,255,0.2)" strokeWidth="0.3"
                    />
                  );
                })}

                {/* Cardinal labels just outside horizon ring */}
                <text x="50"   y="7.5"  textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="3.5">N</text>
                <text x="92.5" y="51.5" textAnchor="start"  fill="rgba(255,255,255,0.7)" fontSize="3.5">E</text>
                <text x="50"   y="94.5" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="3.5">S</text>
                <text x="7.5"  y="51.5" textAnchor="end"    fill="rgba(255,255,255,0.7)" fontSize="3.5">W</text>

                {/* Elevation labels */}
                <text x="51.5" y="37.8" textAnchor="start" fill="rgba(255,255,255,0.35)" fontSize="2.5">30°</text>
                <text x="51.5" y="24.5" textAnchor="start" fill="rgba(255,255,255,0.35)" fontSize="2.5">60°</text>

                {/* Orbit tracks — sampled at 1-minute steps so arcs stay smooth regardless of data density */}
                {(() => {
                  const gs = groundStations.find(g => g.id === trackedGroundStationId) ?? groundStations[0];
                  if (!gs) { return null; }
                  const gsPos = Cartesian3.fromDegrees(gs.longitude, gs.latitude, gs.altitude);
                  const R_HORIZON = 40;
                  const STEP_SECONDS = 60; // fine enough for smooth polar arcs at any data density

                  return satellites
                    .filter(sat => !hiddenSatellites.has(sat.id))
                    .map((sat, idx) => {
                      const interval = sat.availability.get(0);
                      if (!interval) { return null; }
                      const duration = JulianDate.secondsDifference(interval.stop, interval.start);
                      const numSteps = Math.ceil(duration / STEP_SECONDS);
                      const hue = (idx * 47) % 360;
                      const trackDots: React.JSX.Element[] = [];

                      // Build SVG path: M to start each above-horizon segment, L to continue
                      let pathD = '';
                      let inSegment = false;
                      for (let i = 0; i <= numSteps; i++) {
                        const t = JulianDate.addSeconds(interval.start, i * STEP_SECONDS, new JulianDate());
                        const satPos = sat.position.getValue(t);
                        if (!satPos) { inSegment = false; continue; }
                        const azel = computeAzEl(gsPos, satPos);
                        if (!azel || azel.el < 0) { inSegment = false; continue; }
                        const r = R_HORIZON * (90 - azel.el) / 90;
                        const azRad = (azel.az * Math.PI) / 180;
                        const x = (50 + r * Math.sin(azRad)).toFixed(2);
                        const y = (50 - r * Math.cos(azRad)).toFixed(2);
                        pathD += inSegment ? ` L${x} ${y}` : ` M${x} ${y}`;
                        inSegment = true;
                      }
                      if (!pathD) { return null; }
                      trackDots.push(
                        <path
                          key={`${sat.id}-track`}
                          d={pathD}
                          fill="none"
                          stroke={`hsla(${hue},80%,65%,0.5)`}
                          strokeWidth="0.4"
                        />
                      );
                      return trackDots;
                    });
                })()}

                {/* Satellite dots — only those above the horizon */}
                {(() => {
                  const gs = groundStations.find(g => g.id === trackedGroundStationId) ?? groundStations[0];
                  if (!gs || !overlayClockTime) { return null; }
                  const gsPos = Cartesian3.fromDegrees(gs.longitude, gs.latitude, gs.altitude);

                  return satellites
                    .filter(sat => !hiddenSatellites.has(sat.id))
                    .map((sat, idx) => {
                      const satPos = sat.position.getValue(overlayClockTime);
                      if (!satPos) { return null; }
                      const azel = computeAzEl(gsPos, satPos);
                      if (!azel || azel.el < 0) { return null; }

                      const R_HORIZON = 40;
                      const r = R_HORIZON * (90 - azel.el) / 90;
                      const azRad = (azel.az * Math.PI) / 180;
                      const x = 50 + r * Math.sin(azRad);
                      const y = 50 - r * Math.cos(azRad);
                      const hue = (idx * 47) % 360;
                      const color = `hsl(${hue},80%,65%)`;

                      return (
                        <g key={sat.id}>
                          <circle cx={x} cy={y} r="1.2" fill={color} />
                          <text x={x + 1.8} y={y - 1.2} fontSize="2.8" fill={color}>{sat.name}</text>
                        </g>
                      );
                    });
                })()}
              </svg>
            </div>
          )}
        </div>

        {/* Sidebar Controls */}
        <SidebarControls
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          satellites={satellites}
          groundStations={groundStations}
          trackedSatelliteId={trackedSatelliteId}
          setTrackedSatelliteId={setTrackedSatelliteId}
          trackedGroundStationId={trackedGroundStationId}
          setTrackedGroundStationId={setTrackedGroundStationId}
          setSelectedMode={setSelectedMode}
          hiddenSatellites={hiddenSatellites}
          setHiddenSatellites={setHiddenSatellites}
          hiddenGroundStations={hiddenGroundStations}
          setHiddenGroundStations={setHiddenGroundStations}
          setSettingsModalSatelliteId={setSettingsModalSatelliteId}
          setSettingsModalGroundStationId={setSettingsModalGroundStationId}
          styles={styles}
        />

        {/* Settings Modal */}
        {settingsModalSatelliteId && (
          <div 
            ref={satelliteModalRef}
            className={styles.modalOverlay}
            onClick={() => setSettingsModalSatelliteId(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();  // Prevent Grafana from handling ESC
                e.preventDefault();    // Cancel default browser behavior
                setSettingsModalSatelliteId(null);  // Close modal
              }
            }}
            tabIndex={-1}  // Make div focusable to receive keyboard events
          >
            <div 
              className={styles.modal}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  <Settings size={18} />
                  {satellites.find(sat => sat.id === settingsModalSatelliteId)?.name || 'Satellite Settings'}
                </h3>
                <button
                  className={styles.modalClose}
                  onClick={() => setSettingsModalSatelliteId(null)}
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <div className={styles.modalContent}>
                {/* Sensor Colors Section */}
                {(() => {
                  const currentSatellite = satellites.find(sat => sat.id === settingsModalSatelliteId);
                  const hasSensors = currentSatellite && currentSatellite.sensors.length > 0;
                  
                  return hasSensors ? (
                    <div className={styles.settingsGroup}>
                      <h4 className={styles.settingsGroupTitle}>Sensor Colors</h4>
                      {currentSatellite!.sensors.map((sensor, idx) => {
                        const color = _getSensorColor(currentSatellite!.id, sensor.id, sensor, idx);
                        
                        return (
                          <div key={sensor.id} className={styles.settingRow}>
                            <div className={styles.sensorColorRowVertical}>
                              <div className={styles.sensorNameRow}>
                                <div className={styles.sensorName}>{sensor.name}</div>
                                <button
                                  className={styles.resetButton}
                                  onClick={() => {
                                    _resetSensorColor(currentSatellite!.id, sensor.id);
                                  }}
                                  title="Reset to default color from JSON"
                                >
                                  Reset
                                </button>
                              </div>
                              <div className={styles.colorPickerWrapper}>
                                <ColorPicker
                                  color={color}
                                  onChange={(newColor) => {
                                    _updateSensorColor(currentSatellite!.id, sensor.id, newColor);
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null;
                })()}

                {/* Render Settings Section */}
                <div className={styles.settingsGroup}>
                  <h4 className={styles.settingsGroupTitle}>Render Settings</h4>
                  
                {/* Setting 1: Transparent Sensor Cones (Functional) */}
                <div className={styles.settingRow}>
                  <div>
                    <label className={styles.settingLabel}>
                      <input
                        type="checkbox"
                        checked={satelliteRenderSettings.get(settingsModalSatelliteId!)?.transparentCones || false}
                        onChange={(e) => {
                          // Show warning when enabling transparent mode
                          if (e.target.checked) {
                            const confirmed = window.confirm(
                              '⚠️ Performance Warning\n\n' +
                              'Transparent sensor cones may significantly impact frame rate, ' +
                              'especially with multiple satellites and sensors.\n\n' +
                              'Lower frame rates are expected when this feature is enabled.\n\n' +
                              'Do you want to activate transparent cones?'
                            );
                            if (!confirmed) {
                              return; // User cancelled, don't change the setting
                            }
                          }
                          
                          const newSettings = new Map(satelliteRenderSettings);
                          const current = newSettings.get(settingsModalSatelliteId!) || {
                            transparentCones: false,
                            setting2: false,
                            setting3: false,
                            setting4: false,
                            setting5: false,
                            setting6: false,
                            setting7: false,
                            setting8: false,
                            setting9: false,
                          };
                          newSettings.set(settingsModalSatelliteId!, {
                            ...current,
                            transparentCones: e.target.checked
                          });
                          setSatelliteRenderSettings(newSettings);
                        }}
                      />
                      <span>Transparent Sensor Cones</span>
                    </label>
                    <div className={styles.settingDescription}>
                      Show filled transparent cones instead of wireframe grid (⚠️ may impact performance)
                    </div>
                  </div>
                </div>

                </div> {/* End Render Settings Group */}

                {/* Datasource Confidence Review Section */}
                <div className={styles.settingsGroup}>
                  <h4 className={styles.settingsGroupTitle}>Datasource Confidence Review</h4>
                  <div className={styles.settingDescription} style={{ marginLeft: 0, marginBottom: 12 }}>
                    Rate your confidence in this datasource and optionally leave a comment for the operations team.
                  </div>

                  {/* Confidence Slider */}
                  <div className={styles.confidenceSliderRow}>
                    <div className={styles.confidenceSliderLabels}>
                      <span className={styles.settingLabel} style={{ cursor: 'default' }}>Confidence Level</span>
                      <span className={styles.confidenceValueBadge}>
                        {(confidenceValues.get(settingsModalSatelliteId!) ?? 5).toFixed(2)} / 10
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.01}
                      value={confidenceValues.get(settingsModalSatelliteId!) ?? 5}
                      className={styles.confidenceSlider}
                      onChange={(e) => {
                        const newMap = new Map(confidenceValues);
                        newMap.set(settingsModalSatelliteId!, Number(e.target.value));
                        setConfidenceValues(newMap);
                      }}
                    />
                    <div className={styles.confidenceSliderTicks}>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <span key={n}>{n}</span>
                      ))}
                    </div>
                  </div>

                  {/* Comment Textarea */}
                  <div className={styles.confidenceCommentRow}>
                    <label className={styles.confidenceCommentLabel}>Comment (optional)</label>
                    <textarea
                      className={styles.confidenceCommentArea}
                      placeholder="Describe any anomalies, data quality concerns, or observations…"
                      rows={3}
                      value={confidenceComments.get(settingsModalSatelliteId!) ?? ''}
                      onChange={(e) => {
                        const newMap = new Map(confidenceComments);
                        newMap.set(settingsModalSatelliteId!, e.target.value);
                        setConfidenceComments(newMap);
                      }}
                    />
                  </div>

                  {/* Submit Button */}
                  <div className={styles.confidenceSubmitRow}>
                    <button
                      className={styles.confidenceSubmitButton}
                      onClick={() => {
                        if (
                          options.scenarioId === ScenarioId.Scenario2 &&
                          options.digitalTwinUrl &&
                          settingsModalSatelliteId
                        ) {
                          const confidence = confidenceValues.get(settingsModalSatelliteId) ?? 5;
                          fetch(`${options.digitalTwinUrl}/api/confidence`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: settingsModalSatelliteId, confidence }),
                          }).catch((err) => console.warn('Failed to submit confidence:', err));
                        }
                        setShowReviewSubmittedModal(true);
                      }}
                    >
                      Submit Review
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Ground Station Settings Modal */}
        {settingsModalGroundStationId && (
          <div 
            ref={groundStationModalRef}
            className={styles.modalOverlay}
            onClick={() => setSettingsModalGroundStationId(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                e.preventDefault();
                setSettingsModalGroundStationId(null);
              }
            }}
            tabIndex={-1}
          >
            <div 
              className={styles.modal}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  <Settings size={18} />
                  {groundStations.find(gs => gs.id === settingsModalGroundStationId)?.name || 'Ground Station Settings'}
                </h3>
                <button
                  className={styles.modalClose}
                  onClick={() => setSettingsModalGroundStationId(null)}
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <div className={styles.modalContent}>
                <div className={styles.emptyState}>
                  Ground station settings coming soon...
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Hover Tooltip for Sensors */}
      {hoveredEntityName && tooltipPosition && (() => {
        console.log('🎨 RENDERING TOOLTIP:', hoveredEntityName, 'at', tooltipPosition);
        return (
          <div
            className={styles.hoverTooltip}
            style={{
              left: `${tooltipPosition.x + 15}px`,
              top: `${tooltipPosition.y + 15}px`,
            }}
          >
            {hoveredEntityName}
          </div>
        );
      })()}

      {/* Visibility / Line-of-Sight warning modal */}
      {showLoSWarningModal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#1c1c2e',
              border: '1px solid #444',
              borderRadius: 8,
              padding: '24px 28px',
              maxWidth: 420,
              color: '#e0e0e0',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, color: '#fff' }}>
              🌐 Visibility / Line of Sight
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 18, color: '#aaa' }}>
              Optimal visualization of the satellite visibility area requires the{' '}
              <strong style={{ color: '#fff' }}>FOV Footprint</strong> layer to be disabled.
              Both layers overlap on the Earth surface and may produce visual clutter.
              <br /><br />
              Disable <em>Show FOV Footprint</em> in the panel settings for the best result.
            </div>
            <button
              onClick={() => setShowLoSWarningModal(false)}
              style={{
                background: '#3b6fd4',
                border: 'none',
                borderRadius: 5,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                padding: '7px 18px',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Datasource Confidence Review — Submitted Confirmation Modal */}
      {showReviewSubmittedModal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
            zIndex: 9999,
          }}
          onClick={() => setShowReviewSubmittedModal(false)}
        >
          <div
            style={{
              background: '#1c1c2e',
              border: '1px solid #444',
              borderRadius: 8,
              padding: '24px 28px',
              maxWidth: 360,
              color: '#e0e0e0',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#fff' }}>
              Review Submitted
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 18, color: '#aaa' }}>
              Your confidence rating and comment have been recorded.
              In a connected digital twin environment, this review would be persisted and
              made available to the operations team.
            </div>
            <button
              onClick={() => setShowReviewSubmittedModal(false)}
              style={{
                background: '#3b6fd4',
                border: 'none',
                borderRadius: 5,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                padding: '7px 18px',
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
