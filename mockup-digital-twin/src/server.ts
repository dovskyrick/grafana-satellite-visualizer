import express, { Request, Response } from 'express';
import cors from 'cors';
import {
  generateCircularOrbit,
  generateTumblingOrbit,
  OrbitParams,
  TrajectoryPoint,
} from './orbit-math';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const MAX_DURATION_S = 12 * 60 * 60; // 12 hours cap

// Returns a stable TCA timestamp quantized to 30-minute slots.
// Every request within the same 30-minute window computes the identical value,
// keeping Cesium and the Infinity panels perfectly in sync.
function getTcaMs(): number {
  const SLOT_MS   = 30 * 60 * 1000;
  const OFFSET_MS = 90 * 60 * 1000; // TCA = slot + 1h30min
  return Math.floor(Date.now() / SLOT_MS) * SLOT_MS + OFFSET_MS;
}

// ---------------------------------------------------------------------------
// Fixed satellite configs — always the same 3 satellites
// ---------------------------------------------------------------------------
const SATELLITE_CONFIGS = [
  {
    id: 'sat-1',
    name: 'Starlink-4021',
    type: 'circular' as const,
    altitude: 550,
    inclination: 53,
    longitudeOfAN: 0,
    startAnomaly: 0,
  },
  {
    id: 'sat-2',
    name: 'Hubble Space Telescope',
    type: 'tumbling' as const,
    altitude: 540,
    inclination: 28.5,
    longitudeOfAN: 90,
    startAnomaly: 120,
  },
  {
    id: 'sat-3',
    name: 'ISS',
    type: 'circular' as const,
    altitude: 420,
    inclination: 51.6,
    longitudeOfAN: 180,
    startAnomaly: 240,
  },
];

const GROUND_STATIONS = [
  { id: 'gs-goldstone', name: 'Goldstone (DSN)', latitude: 35.4267,  longitude: -116.8900, altitude: 1005 },
  { id: 'gs-canberra', name: 'Canberra (DSN)',  latitude: -35.4014, longitude: 148.9819,  altitude: 691  },
  { id: 'gs-madrid',   name: 'Madrid (DSN)',    latitude: 40.4319,  longitude: -4.2481,   altitude: 834  },
  { id: 'gs-kourou',   name: 'Kourou (ESA)',    latitude: 5.2517,   longitude: -52.8050,  altitude: 26   },
];

const SENSOR_ORIENTATIONS = [
  [
    { qx: 0, qy: 0, qz: 0, qw: 1 },
    { qx: 1, qy: 0, qz: 0, qw: 0 },
    { qx: 0, qy: 0.7071, qz: 0, qw: 0.7071 },
  ],
  [
    { qx: 0.3827, qy: 0, qz: 0, qw: 0.9239 },
    { qx: 0, qy: 0.3827, qz: 0, qw: 0.9239 },
    { qx: 0, qy: 0, qz: 0.3827, qw: 0.9239 },
  ],
  [
    { qx: 0.866, qy: 0, qz: 0, qw: 0.5 },
    { qx: 0, qy: 0.866, qz: 0, qw: 0.5 },
    { qx: 0, qy: 0, qz: 0.866, qw: 0.5 },
  ],
];

const GREEN_COLORS = ['#1F5E3B', '#2E8B57', '#4CAF73'];

function buildSensors(satelliteIdx: number) {
  const orientations = SENSOR_ORIENTATIONS[satelliteIdx % SENSOR_ORIENTATIONS.length];
  const numSensors = satelliteIdx === 0 ? 3 : satelliteIdx === 1 ? 2 : 1;
  const configs = [
    { name: 'Main Camera',   fov: 10 },
    { name: 'Nadir Camera',  fov: 15 },
    { name: 'Star Tracker',  fov: 20 },
  ];
  return configs.slice(0, numSensors).map((c, idx) => ({
    id: `sat${satelliteIdx}-sens${idx}`,
    name: c.name,
    fov: c.fov,
    orientation: orientations[idx],
    color: GREEN_COLORS[idx],
  }));
}

function buildSatelliteFrame(
  satelliteId: string,
  satelliteName: string,
  points: TrajectoryPoint[],
  sensors: ReturnType<typeof buildSensors>,
  lastObservedTime: number
) {
  return {
    meta: {
      custom: { satelliteId, satelliteName, lastObservedTime, sensors },
    },
    columns: [
      { text: 'Time',      type: 'time'   },
      { text: 'Longitude', type: 'number' },
      { text: 'Latitude',  type: 'number' },
      { text: 'Altitude',  type: 'number' },
      { text: 'qx',        type: 'number' },
      { text: 'qy',        type: 'number' },
      { text: 'qz',        type: 'number' },
      { text: 'qs',        type: 'number' },
      { text: 'ell_along',  type: 'number' },
      { text: 'ell_cross',  type: 'number' },
      { text: 'ell_radial', type: 'number' },
    ],
    rows: points.map(p => [
      p.time, p.longitude, p.latitude, p.altitude,
      p.qx, p.qy, p.qz, p.qs,
      p.ell_along, p.ell_cross, p.ell_radial,
    ]),
  };
}

// ---------------------------------------------------------------------------
// Scenario identifiers — must stay in sync with ScenarioId enum in the plugin
// ---------------------------------------------------------------------------
const enum ScenarioId {
  Default              = 0,
  CollisionRisk1       = 1,
  ConfidenceAssessment = 2,
  CommAnomaly          = 3,
  StarTrackerAnomaly   = 4,
}

// ---------------------------------------------------------------------------
// Scenario 1 — two crossing orbits with TCA at the window midpoint
//
// Sat A: incl=+53°, LOAN=0° → heads NE at TCA, altitude 550 km   (prograde)
// Sat B: incl=+20°, LOAN=0° → heads NE at TCA, altitude 550.2 km  (prograde, shallower angle)
//
// Both satellites are at (lat=0°, lon≈0°) at anomaly=0° and both move eastward,
// producing an X-shaped crossing ground track centred on TCA.  The backward arc
// is generated with
// timeDirection=-1 so timestamps decrease from TCA; .reverse() then makes them
// chronologically ascending before concatenation with the forward arc.
// ---------------------------------------------------------------------------
function generateScenario1(fromMs: number, toMs: number) {
  const tcaMs   = getTcaMs();
  const tcaDate = new Date(tcaMs);

  // Size each arc to exactly cover the requested Grafana window.
  // If TCA falls outside the window one side will be 0 and that arc is skipped.
  const backDurationS = Math.max((tcaMs - fromMs) / 1000, 0);
  const fwdDurationS  = Math.max((toMs  - tcaMs)  / 1000, 0);
  const numPointsBack = backDurationS > 0 ? Math.floor(backDurationS / 60) + 1 : 0;
  const numPointsFwd  = fwdDurationS  > 0 ? Math.floor(fwdDurationS  / 60) + 1 : 0;

  const COLLISION_SATELLITES = [
    {
      id: 'sat-1',   name: 'SAT-1',
      altitude: 549.9, inclination: 53, longitudeOfAN: 0, eccentricity: 0,
      lastObservedMs: tcaMs - 2 * 3600 * 1000,           // TCA − 2h = now − 30min
      ellipsoid: { startM: 50, endM: 600, growthHours: 2 },
    },
    {
      id: 'sat-2a',  name: 'SAT-2-A',
      altitude: 550,   inclination: 20, longitudeOfAN: 0, eccentricity: 0.1,
      lastObservedMs: tcaMs - 3 * 3600 * 1000,           // TCA − 3h
      ellipsoid: { startM: 50, endM: 700, growthHours: 3 },
    },
    {
      id: 'sat-2b',  name: 'SAT-2-B',
      altitude: 550.1, inclination: 20, longitudeOfAN: 0, eccentricity: 0.1,
      startAnomaly: 0.02,                                 // ~0.4s offset → slightly off-centre conjunction
      lastObservedMs: tcaMs - 4.5 * 3600 * 1000,         // TCA − 4h30min
      ellipsoid: { startM: 50, endM: 4000, growthHours: 4.5 },
    },
    {
      id: 'sat-2c',  name: 'SAT-2-C',
      altitude: 550,   inclination: 20, longitudeOfAN: 0, eccentricity: 0.1,
      startAnomaly: 0.11,                                 // ~2s ahead in orbit → ~15 km along-track at TCA → no conjunction
      lastObservedMs: tcaMs - 135 * 60 * 1000,           // TCA − 2h15min
      ellipsoid: { startM: 50, endM: 400, growthHours: 2.25 },
    },
  ];

  const frames = COLLISION_SATELLITES.map((cfg, idx) => {
    const baseParams: Omit<OrbitParams, 'timeDirection' | 'reverseTime' | 'numPoints' | 'duration'> = {
      altitude:         cfg.altitude,
      inclination:      cfg.inclination,
      longitudeOfAN:    cfg.longitudeOfAN,
      eccentricity:     cfg.eccentricity,
      startAnomaly:     cfg.startAnomaly ?? 0,
      startTime:        tcaDate,
      lastObservedTime: new Date(cfg.lastObservedMs),
      ellipsoid:        cfg.ellipsoid,
    };

    // Backward arc: rewind from TCA back to fromMs, then reverse to ascending timestamps.
    const pastArc: TrajectoryPoint[] = numPointsBack > 0
      ? [...generateCircularOrbit({
          ...baseParams,
          numPoints: numPointsBack,
          duration:  backDurationS,
          timeDirection: -1,
          reverseTime:   true,
        })].reverse()
      : [];

    // Forward arc: TCA forward to toMs.
    const futureArc: TrajectoryPoint[] = numPointsFwd > 0
      ? generateCircularOrbit({
          ...baseParams,
          numPoints: numPointsFwd,
          duration:  fwdDurationS,
          timeDirection: 1,
          reverseTime:   false,
        })
      : [];

    // Concatenate, dropping the duplicate TCA point at the start of futureArc.
    const trajectory: TrajectoryPoint[] = [
      ...pastArc,
      ...futureArc.slice(pastArc.length > 0 ? 1 : 0),
    ];

    const sensors = buildSensors(idx);
    return buildSatelliteFrame(cfg.id, cfg.name, trajectory, sensors, cfg.lastObservedMs);
  });

  return frames;
}

// ---------------------------------------------------------------------------
// Scenario 2 — Confidence Assessment
//
// Same orbital geometry as Scenario 1 but the user must assign confidence
// themselves.  SAT-2-A has a very old last observation (TCA − 5h) and a
// frozen ellipsoid (growthHours=999 ≈ no growth) to make it look suspicious.
// SAT-2-B is identical to Scenario 1 — recent obs, large but growing ellipsoid.
// SAT-1 is identical to Scenario 1.
// ---------------------------------------------------------------------------
function generateScenario2(fromMs: number, toMs: number) {
  const tcaMs   = getTcaMs();
  const tcaDate = new Date(tcaMs);

  const backDurationS = Math.max((tcaMs - fromMs) / 1000, 0);
  const fwdDurationS  = Math.max((toMs  - tcaMs)  / 1000, 0);
  const numPointsBack = backDurationS > 0 ? Math.floor(backDurationS / 60) + 1 : 0;
  const numPointsFwd  = fwdDurationS  > 0 ? Math.floor(fwdDurationS  / 60) + 1 : 0;

  const COLLISION_SATELLITES = [
    {
      id: 'sat-1',   name: 'SAT-1',
      altitude: 549.9, inclination: 53, longitudeOfAN: 0, eccentricity: 0,
      lastObservedMs: tcaMs - 2 * 3600 * 1000,
      ellipsoid: { startM: 50, endM: 600, growthHours: 2 },
    },
    {
      id: 'sat-2a',  name: 'SAT-2-A',
      altitude: 550,   inclination: 20, longitudeOfAN: 0, eccentricity: 0.1,
      lastObservedMs: tcaMs - 5 * 3600 * 1000,           // very stale — 5h before TCA
      ellipsoid: { startM: 100, endM: 101, growthHours: 999 }, // frozen: negligible growth
    },
    {
      id: 'sat-2b',  name: 'SAT-2-B',
      altitude: 550.1, inclination: 20, longitudeOfAN: 0, eccentricity: 0.1,
      startAnomaly: 0.02,
      lastObservedMs: tcaMs - 4.5 * 3600 * 1000,
      ellipsoid: { startM: 50, endM: 4000, growthHours: 4.5 },
    },
  ];

  const frames = COLLISION_SATELLITES.map((cfg, idx) => {
    const baseParams: Omit<OrbitParams, 'timeDirection' | 'reverseTime' | 'numPoints' | 'duration'> = {
      altitude:         cfg.altitude,
      inclination:      cfg.inclination,
      longitudeOfAN:    cfg.longitudeOfAN,
      eccentricity:     cfg.eccentricity,
      startAnomaly:     cfg.startAnomaly ?? 0,
      startTime:        tcaDate,
      lastObservedTime: new Date(cfg.lastObservedMs),
      ellipsoid:        cfg.ellipsoid,
    };

    const pastArc: TrajectoryPoint[] = numPointsBack > 0
      ? [...generateCircularOrbit({
          ...baseParams,
          numPoints: numPointsBack,
          duration:  backDurationS,
          timeDirection: -1,
          reverseTime:   true,
        })].reverse()
      : [];

    const futureArc: TrajectoryPoint[] = numPointsFwd > 0
      ? generateCircularOrbit({
          ...baseParams,
          numPoints: numPointsFwd,
          duration:  fwdDurationS,
          timeDirection: 1,
          reverseTime:   false,
        })
      : [];

    const trajectory: TrajectoryPoint[] = [
      ...pastArc,
      ...futureArc.slice(pastArc.length > 0 ? 1 : 0),
    ];

    const sensors = buildSensors(idx);
    return buildSatelliteFrame(cfg.id, cfg.name, trajectory, sensors, cfg.lastObservedMs);
  });

  return frames;
}

// ---------------------------------------------------------------------------
// Scenario 3 — Communication Anomaly
//
// Single satellite on a 53° circular orbit (same as SAT-1) with one "Antenna"
// sensor pointing along the +Z body axis.  A single fictional ground station
// is returned.  The plugin will override the satellite orientation to track
// the GS in real time; this function only provides the trajectory data.
// ---------------------------------------------------------------------------
const SCENARIO3_GS = {
  id: 'gs-lisbon', name: 'Orbital GS Lisbon',
  latitude: 38.72, longitude: -9.14, altitude: 95,
};

// Returns a stable orbit anchor snapped to the nearest 30-minute boundary
// minus 6 hours — identical logic to getTcaMs so all scenarios stay in sync.
// Every request within the same 30-minute window produces the same anchor,
// keeping the orbit phase consistent across reloads and auto-refreshes.
function getScenario3AnchorMs(): number {
  const SLOT_MS    = 30 * 60 * 1000;
  const OFFSET_MS  = 6  * 60 * 60 * 1000; // start orbit 6 h before the slot
  return Math.floor(Date.now() / SLOT_MS) * SLOT_MS - OFFSET_MS;
}

function generateScenario3(fromMs: number, toMs: number) {
  // Always start propagation from the stable anchor (now−6h snapped to 30-min
  // slots) so that the satellite's ECEF position at any given UTC time is
  // identical across all reloads and auto-refreshes. Earth-rotation correction
  // in orbit-math is relative to startTime, so startTime must equal the anchor.
  //
  // We generate the full arc from anchor → toMs, then discard points that fall
  // before fromMs. Grafana only requested [fromMs, toMs] but the extra points
  // (anchor → fromMs) are necessary to get the Earth-rotation offset right.
  const anchorMs       = getScenario3AnchorMs();
  const fullDurationS  = (toMs - anchorMs) / 1000;
  const fullNumPoints  = Math.floor(fullDurationS / 60) + 1;
  // Pin lastObservedTime to now−1h snapped to 30-min slots so the solid/dashed
  // trajectory split stays stable across reloads and Grafana window changes.
  const lastObservedMs = Math.floor(Date.now() / (30 * 60 * 1000)) * (30 * 60 * 1000) - 60 * 60 * 1000;

  const allPoints = generateCircularOrbit({
    altitude:         550,
    inclination:      53,
    longitudeOfAN:    0,
    startAnomaly:     0,
    startTime:        new Date(anchorMs),
    numPoints:        fullNumPoints,
    duration:         fullDurationS,
    lastObservedTime: new Date(lastObservedMs),
    ellipsoid:        { startM: 30, endM: 80, growthHours: (toMs - fromMs) / 3600000 },
  });

  // Keep only the points that fall within the Grafana-requested window.
  const basePoints = allPoints.filter(p => p.time >= fromMs);
  const numPoints  = basePoints.length;

  // Apply a slow Z-axis rotation: 3 full spins over the entire trajectory.
  // Quaternion for angle θ around Z: (0, 0, sin(θ/2), cos(θ/2)).
  // This makes the spin clearly recognisable in Cesium so the raw server
  // attitude can be verified before the plugin orientation override is enabled.
  const TWO_PI = 2 * Math.PI;
  const points = basePoints.map((p, i) => {
    const angle = (i / Math.max(numPoints - 1, 1)) * TWO_PI * 3; // 3 rotations
    return {
      ...p,
      qx: 0,
      qy: 0,
      qz: Math.sin(angle / 2),
      qs: Math.cos(angle / 2),
    };
  });

  const antennaSensor = [{
    id:          'sat-comm-antenna',
    name:        'Antenna',
    fov:         5,
    orientation: { qx: 0, qy: 0, qz: 0, qw: 1 }, // identity → points along +Z body
    color:       '#00BFFF',
  }];

  const satFrame    = buildSatelliteFrame('sat-comm', 'SAT-COMM', points, antennaSensor, lastObservedMs);
  const gsFrame     = {
    type: 'groundStations',
    meta: { custom: { groundStations: [SCENARIO3_GS] } },
    columns: [],
    rows: [],
  };

  return [satFrame, gsFrame];
}

// ---------------------------------------------------------------------------
// Scenario 4 — Star Tracker Anomaly
//
// Identical orbit to Scenario 3 (same anchor, same circular orbit params).
// Body attitude is left as identity here — the plugin overrides it per Cesium
// frame to point the body +Z axis at the Sun (mirrors the GS-pointing override
// used in Scenario 3). Sensor mount is identity so boresight = body +Z.
// ---------------------------------------------------------------------------
function generateScenario4(fromMs: number, toMs: number) {
  const anchorMs      = getScenario3AnchorMs(); // same 6-h-before-now snap
  const fullDurationS = (toMs - anchorMs) / 1000;
  const fullNumPoints = Math.floor(fullDurationS / 60) + 1;
  const lastObservedMs = Math.floor(Date.now() / (30 * 60 * 1000)) * (30 * 60 * 1000) - 60 * 60 * 1000;

  const allPoints = generateCircularOrbit({
    altitude:         550,
    inclination:      53,
    longitudeOfAN:    0,
    startAnomaly:     0,
    startTime:        new Date(anchorMs),
    numPoints:        fullNumPoints,
    duration:         fullDurationS,
    lastObservedTime: new Date(lastObservedMs),
    ellipsoid:        { startM: 30, endM: 80, growthHours: (toMs - fromMs) / 3600000 },
  });

  // Identity body attitude — the plugin replaces this with a Sun-pointing
  // CallbackProperty, identical pattern to Scenario 3's GS-pointing override.
  const points = allPoints
    .filter(p => p.time >= fromMs)
    .map(p => ({ ...p, qx: 0, qy: 0, qz: 0, qs: 1 }));

  const starTrackerSensor = [{
    id:          'sat-st-z',
    name:        'Star Tracker',
    fov:         20,
    orientation: { qx: 0, qy: 0, qz: 0, qw: 1 }, // identity → boresight = +Z body
    color:       '#FFD700',
  }];

  const satFrame = buildSatelliteFrame('sat-st', 'SAT-ST', points, starTrackerSensor, lastObservedMs);
  return [satFrame];
}

// ---------------------------------------------------------------------------
// Core generation — startTime comes from Grafana's "from", duration capped at 12h
// ---------------------------------------------------------------------------
function generateTrajectory(fromMs: number, toMs: number, durationSeconds: number, scenario: number) {
  const startTime = new Date(fromMs);
  // One point every 1 minute
  const numPoints = Math.floor(durationSeconds / 60) + 1;
  const lastObservedTime = new Date(fromMs + (durationSeconds / 2) * 1000);

  const satellitesData = SATELLITE_CONFIGS.map((config, idx) => {
    const params: OrbitParams = {
      altitude: config.altitude,
      inclination: config.inclination,
      longitudeOfAN: config.longitudeOfAN,
      startAnomaly: config.startAnomaly,
      startTime,
      numPoints,
      duration: durationSeconds,
      lastObservedTime,
    };

    const trajectory = config.type === 'tumbling'
      ? generateTumblingOrbit(params)
      : generateCircularOrbit(params);

    const sensors = buildSensors(idx);
    return buildSatelliteFrame(config.id, config.name, trajectory, sensors, lastObservedTime.getTime());
  });

  const groundStationsFrame = {
    type: 'groundStations',
    meta: { custom: { groundStations: GROUND_STATIONS } },
    columns: [],
    rows: [],
  };

  if (scenario === ScenarioId.CollisionRisk1) {
    return [...generateScenario1(fromMs, toMs), groundStationsFrame];
  }

  if (scenario === ScenarioId.ConfidenceAssessment) {
    return [...generateScenario2(fromMs, toMs), groundStationsFrame];
  }

  if (scenario === ScenarioId.CommAnomaly) {
    return generateScenario3(fromMs, toMs); // includes its own gsFrame
  }

  if (scenario === ScenarioId.StarTrackerAnomaly) {
    return generateScenario4(fromMs, toMs);
  }

  return [...satellitesData, groundStationsFrame];
}

// ---------------------------------------------------------------------------
// Risk curve generation — Gaussian centred on TCA = window midpoint + 1h
// σ = 20 minutes; one point per minute across the requested window
// ---------------------------------------------------------------------------
function generateRiskCurve(fromMs: number, toMs: number): Array<{ time: number; risk: number; tca_marker: number | null }> {
  const tcaMs  = getTcaMs();
  const sigma  = 20 * 60 * 1000; // 20 minutes in ms
  const stepMs = 60 * 1000;      // one point per minute
  const points = [];

  // Snap TCA to the nearest minute so the marker lands exactly on a grid point
  const tcaSnapped = Math.round(tcaMs / stepMs) * stepMs;

  for (let t = fromMs; t <= toMs; t += stepMs) {
    const diff = t - tcaMs;
    const risk = Math.exp(-(diff * diff) / (2 * sigma * sigma));
    const tca_marker = t === tcaSnapped ? 1 : null;
    points.push({ time: t, risk: Math.round(risk * 1000) / 1000, tca_marker });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Scenario 2 — in-memory confidence store.
// Resets on server restart (prototype only). Keyed by satellite id.
// ---------------------------------------------------------------------------
const scenario2ConfidenceStore: Record<string, number> = {};

// ---------------------------------------------------------------------------
// Confidence table — static metadata per scenario, time-range independent.
// last_observed_iso is derived from getTcaMs() so it stays in sync with
// the Cesium panel and the risk curve across all requests in the same slot.
// ---------------------------------------------------------------------------
function generateConfidenceTable(scenario: number) {
  const tcaMs  = getTcaMs();
  const nowMs  = Date.now();

  const timeSince = (ms: number): string => {
    const totalMin = Math.round((nowMs - ms) / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
  };

  const fmtEll = (m: number): string =>
    m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;

  const row = (id: string, confidence: number, ellM: number | null, lastObsMs: number, source: string) => ({
    'Trajectory ID':       id,
    'Confidence':          confidence,
    'Ellipsoid at TCA':    ellM !== null ? fmtEll(ellM) : '—',
    'Time Since Last Obs': timeSince(lastObsMs),
    'Source':              source,
  });

  if (scenario === ScenarioId.CollisionRisk1) {
    return [
      row('SAT-1',   9, 600,  tcaMs - 2 * 3600 * 1000,    'Helios Catalogue'),
      row('SAT-2-A', 2, 700,  tcaMs - 3 * 3600 * 1000,    'Nadir Systems TLE'),
      row('SAT-2-B', 7, 4000, tcaMs - 4.5 * 3600 * 1000,  'ArcLight Radar'),
      row('SAT-2-C', 8, 400,  tcaMs - 135 * 60 * 1000,    'Sentinel-Track OD'),
    ];
  }

  if (scenario === ScenarioId.ConfidenceAssessment) {
    // -1 = unassigned (Grafana value mapping should display this as "?")
    // Once the operator submits via the plugin, the stored value replaces -1.
    const conf2a = scenario2ConfidenceStore['sat-2a'] ?? -1;
    const conf2b = scenario2ConfidenceStore['sat-2b'] ?? -1;
    return [
      row('SAT-1',   9,       600,  tcaMs - 2 * 3600 * 1000,   'Helios Catalogue'),
      row('SAT-2-A', conf2a,  100,  tcaMs - 5 * 3600 * 1000,   'Nadir Systems TLE'),
      row('SAT-2-B', conf2b,  4000, tcaMs - 4.5 * 3600 * 1000, 'ArcLight Radar'),
    ];
  }

  // Default scenario — no conjunction context
  return [
    row('Starlink-4021',          9, null, nowMs - 30 * 60 * 1000, 'Helios Catalogue'),
    row('Hubble Space Telescope', 8, null, nowMs - 60 * 60 * 1000, 'Sentinel-Track OD'),
    row('ISS',                    9, null, nowMs - 15 * 60 * 1000, 'ArcLight Radar'),
  ];
}

// ---------------------------------------------------------------------------
// Communication link health — Scenario 3
// ---------------------------------------------------------------------------

// Geodetic (lon°, lat°, altM) → ECEF (km).  Spherical approximation; error
// is < 0.2% vs full WGS84, well within the needs of a fictional scenario.
function llaToEcef(lonDeg: number, latDeg: number, altM: number): [number, number, number] {
  const R   = 6371 + altM / 1000; // km
  const lat = latDeg * Math.PI / 180;
  const lon = lonDeg * Math.PI / 180;
  return [
    R * Math.cos(lat) * Math.cos(lon),
    R * Math.cos(lat) * Math.sin(lon),
    R * Math.sin(lat),
  ];
}

const LINK_MASK_DEG = 5; // minimum elevation angle for a healthy link

const LINK_HEALTH_STEP_S = 30; // one point every 30 seconds

// Shared computation for both link-health endpoints.
function computeLinkHealthPoints(fromMs: number, toMs: number) {
  const anchorMs      = getScenario3AnchorMs();
  const fullDurationS = (toMs - anchorMs) / 1000;
  const fullNumPoints = Math.floor(fullDurationS / LINK_HEALTH_STEP_S) + 1;
  const dummyLastObs  = new Date(fromMs + (toMs - fromMs) / 2);

  const allPoints = generateCircularOrbit({
    altitude:         550,
    inclination:      53,
    longitudeOfAN:    0,
    startAnomaly:     0,
    startTime:        new Date(anchorMs),
    numPoints:        fullNumPoints,
    duration:         fullDurationS,
    lastObservedTime: dummyLastObs,
  });

  const [gsX, gsY, gsZ] = llaToEcef(SCENARIO3_GS.longitude, SCENARIO3_GS.latitude, SCENARIO3_GS.altitude);
  const gsMag = Math.sqrt(gsX * gsX + gsY * gsY + gsZ * gsZ);
  const [gnX, gnY, gnZ] = [gsX / gsMag, gsY / gsMag, gsZ / gsMag];

  return allPoints
    .filter(p => p.time >= fromMs)
    .map(p => {
      const [sX, sY, sZ] = llaToEcef(p.longitude, p.latitude, p.altitude);
      const dx = sX - gsX, dy = sY - gsY, dz = sZ - gsZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const dot  = (dx * gnX + dy * gnY + dz * gnZ) / dist;
      const elevDeg = Math.asin(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
      return {
        time:         p.time,
        elevation_deg: Math.round(elevDeg * 100) / 100,
        link_healthy:  elevDeg >= LINK_MASK_DEG ? 100 : 0,
      };
    });
}

function generateElevation(fromMs: number, toMs: number): Array<{ time: number; elevation_deg: number }> {
  return computeLinkHealthPoints(fromMs, toMs).map(p => ({ time: p.time, elevation_deg: Math.max(0, p.elevation_deg) }));
}

// Returns a helper giving the anomaly window boundaries (indices into a full
// anchor-to-toMs points array) so both generateLinkStatus and
// generateCommAnomaly use identical window detection.
function findAnomalyWindow(
  points: Array<{ link_healthy: number }>
): { anomStart: number; anomEnd: number } | null {
  const windows: Array<{ startIdx: number; endIdx: number }> = [];
  let winStart: number | null = null;
  for (let i = 0; i < points.length; i++) {
    if (points[i].link_healthy === 100 && winStart === null) {
      winStart = i;
    } else if (points[i].link_healthy === 0 && winStart !== null) {
      windows.push({ startIdx: winStart, endIdx: i - 1 });
      winStart = null;
    }
  }
  if (winStart !== null) {
    windows.push({ startIdx: winStart, endIdx: points.length - 1 });
  }
  if (windows.length < 2) { return null; }
  const { startIdx, endIdx } = windows[1];
  const len = endIdx - startIdx + 1;
  return {
    anomStart: startIdx + Math.floor(len / 3),
    anomEnd:   startIdx + Math.floor((2 * len) / 3),
  };
}

function generateCommAnomaly(fromMs: number, toMs: number): Array<{ time: number; comm_anomaly: number }> {
  const anchorMs = getScenario3AnchorMs();
  const points   = computeLinkHealthPoints(anchorMs, toMs).map(p => ({ time: p.time, link_healthy: p.link_healthy, comm_anomaly: 0 }));

  const anomaly = findAnomalyWindow(points);
  if (anomaly) {
    const { anomStart, anomEnd } = anomaly;
    const len = anomEnd - anomStart + 1;
    const mid = (anomStart + anomEnd) / 2;
    for (let i = anomStart; i <= anomEnd; i++) {
      // Triangle: peaks at 130 in the centre, tapers to 0 at both edges.
      const t = 1 - Math.abs((i - mid) / (len / 2));
      points[i].comm_anomaly = Math.round(130 * t * 100) / 100;
    }
  }

  return points.filter(p => p.time >= fromMs).map(p => ({ time: p.time, comm_anomaly: p.comm_anomaly }));
}

function generateLinkStatus(fromMs: number, toMs: number): Array<{ time: number; link_healthy: number }> {
  // Always compute from the stable anchor so window counting is relative to the
  // full orbit history — not the zoomed Grafana window.
  const anchorMs = getScenario3AnchorMs();
  const points   = computeLinkHealthPoints(anchorMs, toMs).map(p => ({ time: p.time, link_healthy: p.link_healthy }));

  // Inject anomaly into the middle third of the second contact window.
  const anomaly = findAnomalyWindow(points);
  if (anomaly) {
    for (let i = anomaly.anomStart; i <= anomaly.anomEnd; i++) {
      points[i].link_healthy = 0;
    }
  }

  return points.filter(p => p.time >= fromMs);
}

function generateAnomalyWindow(): { start: number; end: number } | null {
  // Compute over a 12-hour horizon from the anchor so there is always enough
  // orbit to contain at least two contact windows.
  const anchorMs = getScenario3AnchorMs();
  const toMs     = anchorMs + MAX_DURATION_S * 1000;
  const points   = computeLinkHealthPoints(anchorMs, toMs);
  const anomaly  = findAnomalyWindow(points);
  if (!anomaly) { return null; }
  return {
    start: points[anomaly.anomStart].time,
    end:   points[anomaly.anomEnd].time,
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
function handleHealth(_req: Request, res: Response) {
  res.json({ status: 'ok' });
}

function handleConfidence(req: Request, res: Response) {
  const scenario = req.query.scenario ? parseInt(req.query.scenario as string) : ScenarioId.Default;
  console.log(`[${new Date().toISOString()}] GET /api/confidence  scenario=${scenario}`);
  res.json(generateConfidenceTable(scenario));
}

function handleConfidenceUpdate(req: Request, res: Response) {
  const { id, confidence } = req.body as { id: string; confidence: number };
  if (!id || confidence === undefined || confidence === null) {
    res.status(400).json({ error: 'id and confidence are required' });
    return;
  }
  const value = Math.round(Math.min(10, Math.max(0, Number(confidence))) * 100) / 100;
  scenario2ConfidenceStore[id] = value;
  console.log(`[${new Date().toISOString()}] POST /api/confidence  id=${id}  confidence=${value}`);
  res.json({ ok: true, id, confidence: value });
}

function handleTcaMarker(_req: Request, res: Response) {
  // Exact millisecond timestamp — no minute snapping — for maximum crosshair precision
  const tcaMs = getTcaMs();
  res.json([{ time: tcaMs, TCA: 1.1 }]);
}

function handleRisk(req: Request, res: Response) {
  const toMs   = req.query.to   ? parseInt(req.query.to   as string) : Date.now();
  const fromMs = req.query.from ? parseInt(req.query.from as string) : toMs - MAX_DURATION_S * 1000;

  console.log(
    `[${new Date().toISOString()}] GET /api/risk` +
    `  from=${new Date(fromMs).toISOString()}` +
    `  to=${new Date(toMs).toISOString()}`
  );

  res.json(generateRiskCurve(fromMs, toMs));
}

function handleElevation(req: Request, res: Response) {
  const toMs   = req.query.to   ? parseInt(req.query.to   as string) : Date.now();
  const fromMs = req.query.from ? parseInt(req.query.from as string) : toMs - MAX_DURATION_S * 1000;
  console.log(`[${new Date().toISOString()}] GET /api/link-elevation  from=${new Date(fromMs).toISOString()}  to=${new Date(toMs).toISOString()}`);
  res.json(generateElevation(fromMs, toMs));
}

function handleLinkStatus(req: Request, res: Response) {
  const toMs   = req.query.to   ? parseInt(req.query.to   as string) : Date.now();
  const fromMs = req.query.from ? parseInt(req.query.from as string) : toMs - MAX_DURATION_S * 1000;
  console.log(`[${new Date().toISOString()}] GET /api/link-status  from=${new Date(fromMs).toISOString()}  to=${new Date(toMs).toISOString()}`);
  res.json(generateLinkStatus(fromMs, toMs));
}

function handleCommAnomaly(req: Request, res: Response) {
  const toMs   = req.query.to   ? parseInt(req.query.to   as string) : Date.now();
  const fromMs = req.query.from ? parseInt(req.query.from as string) : toMs - MAX_DURATION_S * 1000;
  console.log(`[${new Date().toISOString()}] GET /api/link-anomaly  from=${new Date(fromMs).toISOString()}  to=${new Date(toMs).toISOString()}`);
  res.json(generateCommAnomaly(fromMs, toMs));
}

function handleAnomalyWindow(_req: Request, res: Response) {
  console.log(`[${new Date().toISOString()}] GET /api/link-anomaly-window`);
  const window = generateAnomalyWindow();
  if (!window) {
    res.status(404).json({ error: 'No anomaly window found in current 12h horizon' });
    return;
  }
  res.json(window);
}

function handleSatellites(req: Request, res: Response) {
  const toMs     = req.query.to       ? parseInt(req.query.to       as string) : Date.now();
  const fromMs   = req.query.from     ? parseInt(req.query.from     as string) : toMs - MAX_DURATION_S * 1000;
  const scenario = req.query.scenario ? parseInt(req.query.scenario as string) : ScenarioId.Default;

  const requestedSeconds = (toMs - fromMs) / 1000;
  const durationSeconds  = Math.min(requestedSeconds, MAX_DURATION_S);

  console.log(
    `[${new Date().toISOString()}] GET /api/satellites` +
    `  from=${new Date(fromMs).toISOString()}` +
    `  to=${new Date(toMs).toISOString()}` +
    `  effective=${(durationSeconds / 3600).toFixed(2)}h` +
    `  scenario=${scenario}`
  );

  res.json(generateTrajectory(fromMs, toMs, durationSeconds, scenario));
}

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------
function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health',            handleHealth);
  app.get('/api/satellites',    handleSatellites);
  app.get('/api/risk',          handleRisk);
  app.get('/api/tca-marker',    handleTcaMarker);
  app.get('/api/confidence',    handleConfidence);
  app.post('/api/confidence',   handleConfidenceUpdate);
  app.get('/api/link-elevation',       handleElevation);
  app.get('/api/link-status',          handleLinkStatus);
  app.get('/api/link-anomaly',         handleCommAnomaly);
  app.get('/api/link-anomaly-window',  handleAnomalyWindow);

  app.listen(PORT, () => {
    console.log(`Mockup Digital Twin running on http://localhost:${PORT}`);
    console.log(`  Health : http://localhost:${PORT}/health`);
    console.log(`  Data   : http://localhost:${PORT}/api/satellites?from=<ms>&to=<ms>`);
  });
}

main();
