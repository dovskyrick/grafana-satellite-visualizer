/**
 * generate-realtime-window.ts
 *
 * Generates multi-satellite data covering the 9 hours PRIOR to the moment
 * the script is run. Intended for testing time-series hover/click scrubbing
 * against Grafana's "Last 9 hours" time picker window.
 *
 * Output: output/multi-satellite-9h.json
 *
 * Usage:
 *   npx ts-node src/generate-realtime-window.ts
 *   npm run generate:9h
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  generateCircularOrbit,
  generateTumblingOrbit,
  OrbitParams,
  TrajectoryPoint,
} from './orbit-math';

interface SensorDefinition {
  id: string;
  name: string;
  fov: number;
  orientation: { qx: number; qy: number; qz: number; qw: number };
  color?: string;
}

interface GroundStationDefinition {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
}

function generateSatelliteJSON(
  satelliteId: string,
  satelliteName: string,
  trajectoryPoints: TrajectoryPoint[],
  sensors: SensorDefinition[],
  lastObservedTime: number
) {
  return {
    meta: { custom: { satelliteId, satelliteName, lastObservedTime, sensors } },
    columns: [
      { text: 'Time', type: 'time' },
      { text: 'Longitude', type: 'number' },
      { text: 'Latitude', type: 'number' },
      { text: 'Altitude', type: 'number' },
      { text: 'qx', type: 'number' },
      { text: 'qy', type: 'number' },
      { text: 'qz', type: 'number' },
      { text: 'qs', type: 'number' },
      { text: 'cov_xx', type: 'number' },
      { text: 'cov_yy', type: 'number' },
      { text: 'cov_zz', type: 'number' },
      { text: 'cov_xy', type: 'number' },
      { text: 'cov_xz', type: 'number' },
      { text: 'cov_yz', type: 'number' },
    ],
    rows: trajectoryPoints.map(p => [
      p.time, p.longitude, p.latitude, p.altitude,
      p.qx, p.qy, p.qz, p.qs,
      p.cov_xx, p.cov_yy, p.cov_zz, p.cov_xy, p.cov_xz, p.cov_yz,
    ]),
  };
}

function generateSensors(satelliteIdx: number): SensorDefinition[] {
  const satelliteOrientations = [
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
  const orientations = satelliteOrientations[satelliteIdx % satelliteOrientations.length];
  const greenColors = ['#1F5E3B', '#2E8B57', '#4CAF73'];
  const sensorConfigs = [
    { name: 'Main Camera', fov: 10, orientation: orientations[0], color: greenColors[0] },
    { name: 'Nadir Camera', fov: 15, orientation: orientations[1], color: greenColors[1] },
    { name: 'Star Tracker', fov: 20, orientation: orientations[2], color: greenColors[2] },
  ];
  const numSensors = satelliteIdx === 0 ? 3 : satelliteIdx === 1 ? 2 : 1;
  return sensorConfigs.slice(0, numSensors).map((config, idx) => ({
    id: `sat${satelliteIdx}-sens${idx}`,
    ...config,
  }));
}

function generateGroundStations(): GroundStationDefinition[] {
  return [
    { id: 'gs-goldstone', name: 'Goldstone (DSN)', latitude: 35.4267, longitude: -116.8900, altitude: 1005 },
    { id: 'gs-canberra', name: 'Canberra (DSN)', latitude: -35.4014, longitude: 148.9819, altitude: 691 },
    { id: 'gs-madrid', name: 'Madrid (DSN)', latitude: 40.4319, longitude: -4.2481, altitude: 834 },
    { id: 'gs-kourou', name: 'Kourou (ESA)', latitude: 5.2517, longitude: -52.8050, altitude: 26 },
  ];
}

function main() {
  const outputDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // --- Time window: 3 hours before NOW to 3 hours after NOW ---
  const now = new Date();
  const threeHoursMs = 3 * 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() - threeHoursMs);
  const windowEnd = new Date(now.getTime() + threeHoursMs);
  const windowDurationSeconds = 6 * 60 * 60; // 21600 s

  // One point every 5 minutes over 6 hours = 72 points
  const pointIntervalMinutes = 5;
  const numPoints = Math.floor((windowDurationSeconds / 60) / pointIntervalMinutes) + 1; // 73

  console.log('🕐 Realtime window generator');
  console.log(`   Script run at      : ${now.toISOString()}`);
  console.log(`   Window start (−3h) : ${windowStart.toISOString()}`);
  console.log(`   Last observed (now): ${now.toISOString()}`);
  console.log(`   Window end   (+3h) : ${windowEnd.toISOString()}`);
  console.log(`   Duration           : 6 hours (3h past + 3h future)`);
  console.log(`   Points/sat         : ${numPoints} (~1 per ${pointIntervalMinutes} min)\n`);

  const satelliteConfigs = [
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

  const satellitesData = satelliteConfigs.map((config, idx) => {
    const params: OrbitParams = {
      altitude: config.altitude,
      inclination: config.inclination,
      longitudeOfAN: config.longitudeOfAN,
      startTime: windowStart,        // ← 3 hours ago
      numPoints,
      duration: windowDurationSeconds, // ← 6 hours total
      startAnomaly: config.startAnomaly,
    };

    const trajectory = config.type === 'tumbling'
      ? generateTumblingOrbit(params)
      : generateCircularOrbit(params);

    const sensors = generateSensors(idx);
    const satData = generateSatelliteJSON(config.id, config.name, trajectory, sensors, now.getTime());

    const first = new Date(trajectory[0].time).toISOString();
    const last = new Date(trajectory[trajectory.length - 1].time).toISOString();

    console.log(`  🛰️  ${config.name}:`);
    console.log(`     ID        : ${config.id}`);
    console.log(`     Type      : ${config.type}`);
    console.log(`     Points    : ${trajectory.length}`);
    console.log(`     Sensors   : ${sensors.length}`);
    console.log(`     First row : ${first}`);
    console.log(`     Last row  : ${last}`);
    console.log(`     Altitude  : ${config.altitude} km`);
    console.log(`     Incl.     : ${config.inclination}°`);
    console.log('');

    return satData;
  });

  // Ground stations (unchanged from multi-satellite)
  const groundStations = generateGroundStations();
  const groundStationsObject = {
    type: 'groundStations',
    meta: { custom: { groundStations } },
    columns: [],
    rows: [],
  };

  const completeData = [...satellitesData, groundStationsObject];

  const outputPath = path.join(outputDir, 'multi-satellite-9h.json');
  fs.writeFileSync(outputPath, JSON.stringify(completeData, null, 2));

  console.log(`✅ Generated : ${outputPath}`);
  console.log(`   Satellites : ${satellitesData.length}`);
  console.log(`   Gnd stn.   : ${groundStations.length}`);
  console.log('\n💡 In Grafana, set the time picker to "Last 6 hours" to see all data.');
  console.log('   Solid line = past 3h (observed). Dashed line = future 3h (inferred).\n');
  console.log('✨ Done!');
}

main();
