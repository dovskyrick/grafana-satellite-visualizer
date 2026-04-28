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
  Default        = 0,
  CollisionRisk1 = 1,
  // 2–5 reserved for future scenarios
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
      lastObservedMs: tcaMs - 4 * 3600 * 1000,           // TCA − 4h = now − 2h30min
      ellipsoid: { startM: 50, endM: 700, growthHours: 4 },
    },
    {
      id: 'sat-2b',  name: 'SAT-2-B',
      altitude: 550.1, inclination: 20, longitudeOfAN: 0, eccentricity: 0.1,
      lastObservedMs: tcaMs - 1.5 * 3600 * 1000,         // TCA − 1h30min = ~now
      ellipsoid: { startM: 50, endM: 4000, growthHours: 1.5 },
    },
  ];

  const frames = COLLISION_SATELLITES.map((cfg, idx) => {
    const baseParams: Omit<OrbitParams, 'timeDirection' | 'reverseTime' | 'numPoints' | 'duration'> = {
      altitude:         cfg.altitude,
      inclination:      cfg.inclination,
      longitudeOfAN:    cfg.longitudeOfAN,
      eccentricity:     cfg.eccentricity,
      startAnomaly:     0,
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
// Route handlers
// ---------------------------------------------------------------------------
function handleHealth(_req: Request, res: Response) {
  res.json({ status: 'ok' });
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

  app.get('/health',          handleHealth);
  app.get('/api/satellites',  handleSatellites);
  app.get('/api/risk',        handleRisk);
  app.get('/api/tca-marker',  handleTcaMarker);

  app.listen(PORT, () => {
    console.log(`Mockup Digital Twin running on http://localhost:${PORT}`);
    console.log(`  Health : http://localhost:${PORT}/health`);
    console.log(`  Data   : http://localhost:${PORT}/api/satellites?from=<ms>&to=<ms>`);
  });
}

main();
