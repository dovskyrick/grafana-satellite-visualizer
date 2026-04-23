import express, { Request, Response } from 'express';
import cors from 'cors';
import {
  generateCircularOrbit,
  generateTumblingOrbit,
  OrbitParams,
  TrajectoryPoint,
} from './orbit-math';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const MAX_DURATION_S = 6 * 60 * 60; // 6 hours cap

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
// Core generation — startTime comes from Grafana's "from", duration capped at 6h
// ---------------------------------------------------------------------------
function generateTrajectory(fromMs: number, durationSeconds: number) {
  const startTime = new Date(fromMs);
  // One point every 5 minutes
  const numPoints = Math.floor(durationSeconds / 300) + 1;

  const satellitesData = SATELLITE_CONFIGS.map((config, idx) => {
    const params: OrbitParams = {
      altitude: config.altitude,
      inclination: config.inclination,
      longitudeOfAN: config.longitudeOfAN,
      startAnomaly: config.startAnomaly,
      startTime,
      numPoints,
      duration: durationSeconds,
    };

    const trajectory = config.type === 'tumbling'
      ? generateTumblingOrbit(params)
      : generateCircularOrbit(params);

    const sensors = buildSensors(idx);
    const lastObservedTime = trajectory[Math.floor(trajectory.length / 2)].time;
    return buildSatelliteFrame(config.id, config.name, trajectory, sensors, lastObservedTime);
  });

  const groundStationsFrame = {
    type: 'groundStations',
    meta: { custom: { groundStations: GROUND_STATIONS } },
    columns: [],
    rows: [],
  };

  return [...satellitesData, groundStationsFrame];
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
function handleHealth(_req: Request, res: Response) {
  res.json({ status: 'ok' });
}

function handleSatellites(req: Request, res: Response) {
  const toMs   = req.query.to   ? parseInt(req.query.to   as string) : Date.now();
  const fromMs = req.query.from ? parseInt(req.query.from as string) : toMs - MAX_DURATION_S * 1000;

  const requestedSeconds = (toMs - fromMs) / 1000;
  const durationSeconds  = Math.min(requestedSeconds, MAX_DURATION_S);

  console.log(
    `[${new Date().toISOString()}] GET /api/satellites` +
    `  from=${new Date(fromMs).toISOString()}` +
    `  to=${new Date(toMs).toISOString()}` +
    `  effective=${(durationSeconds / 3600).toFixed(2)}h`
  );

  res.json(generateTrajectory(fromMs, durationSeconds));
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

  app.listen(PORT, () => {
    console.log(`Mockup Digital Twin running on http://localhost:${PORT}`);
    console.log(`  Health : http://localhost:${PORT}/health`);
    console.log(`  Data   : http://localhost:${PORT}/api/satellites?from=<ms>&to=<ms>`);
  });
}

main();
