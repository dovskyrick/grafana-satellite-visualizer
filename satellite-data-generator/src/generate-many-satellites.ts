import * as fs from 'fs';
import * as path from 'path';
import {
  generateCircularOrbit,
  OrbitParams,
  TrajectoryPoint,
} from './orbit-math';

interface SensorDefinition {
  id: string;
  name: string;
  fov: number;
  orientation: {
    qx: number;
    qy: number;
    qz: number;
    qw: number;
  };
  color?: string; // Add color field
}

/**
 * Generate a satellite JSON object.
 */
function generateSatelliteJSON(
  satelliteId: string,
  satelliteName: string,
  trajectoryPoints: TrajectoryPoint[],
  sensors: SensorDefinition[],
  lastObservedTime: number
) {
  return {
    meta: {
      custom: {
        satelliteId,
        satelliteName,
        lastObservedTime,
        sensors,
      },
    },
    columns: [
      { text: 'Time', type: 'time' },
      { text: 'Longitude', type: 'number' },
      { text: 'Latitude', type: 'number' },
      { text: 'Altitude', type: 'number' },
      { text: 'qx', type: 'number' },
      { text: 'qy', type: 'number' },
      { text: 'qz', type: 'number' },
      { text: 'qs', type: 'number' },
      // Position uncertainty ellipsoid semi-axes (LVLH frame, metres)
      { text: 'ell_along',  type: 'number' },
      { text: 'ell_cross',  type: 'number' },
      { text: 'ell_radial', type: 'number' },
    ],
    rows: trajectoryPoints.map(p => [
      p.time,
      p.longitude,
      p.latitude,
      p.altitude,
      p.qx,
      p.qy,
      p.qz,
      p.qs,
      p.ell_along,
      p.ell_cross,
      p.ell_radial,
    ]),
  };
}

/**
 * Generate simple sensors for a satellite with colors.
 */
function generateSensors(satelliteIdx: number): SensorDefinition[] {
  // Cycle through color palette for variety
  const colorPalette = [
    '#00FFFF', // Cyan
    '#FF00FF', // Magenta
    '#FFFF00', // Yellow
    '#FFA500', // Orange
    '#00FF00', // Lime
  ];
  
  const sensorConfigs = [
    { 
      name: 'Main Camera', 
      fov: 10, 
      orientation: { qx: 0, qy: 0, qz: 0, qw: 1 },
      color: colorPalette[satelliteIdx % colorPalette.length]
    },
    { 
      name: 'Nadir Camera', 
      fov: 15, 
      orientation: { qx: 1, qy: 0, qz: 0, qw: 0 },
      color: colorPalette[(satelliteIdx + 1) % colorPalette.length]
    },
  ];

  return sensorConfigs.map((config, idx) => ({
    id: `sat${satelliteIdx}-sens${idx}`,
    ...config,
  }));
}

/**
 * Generate 14 satellites with random initial positions for scroll testing.
 */
function main() {
  const outputDir = path.join(__dirname, '../output');
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🚀 Generating 14 satellites for scroll testing...\n');

  const satelliteNames = [
    'ISS',
    'Hubble',
    'Starlink-4021',
    'GOES-16',
    'Sentinel-1A',
    'TerraSAR-X',
    'Landsat-9',
    'NOAA-20',
    'Meteosat-11',
    'Jason-3',
    'Aqua',
    'Terra',
    'Suomi NPP',
    'Envisat',
  ];

  const commonStartTime = new Date();
  const satellitesData = [];

  for (let i = 0; i < 14; i++) {
    const satelliteId = `sat-${i + 1}`;
    const satelliteName = satelliteNames[i];

    // Random orbital parameters
    const altitude = 400 + Math.random() * 500; // 400-900 km
    const inclination = 20 + Math.random() * 70; // 20-90°
    const longitudeOfAN = Math.random() * 360; // 0-360°
    const startAnomaly = Math.random() * 360; // Random starting position in orbit

    const params: OrbitParams = {
      altitude,
      inclination,
      longitudeOfAN,
      startTime: commonStartTime,
      numPoints: 20,
      duration: 60 * 60, // 1 hour
      startAnomaly,
    };

    const trajectory = generateCircularOrbit(params);
    const sensors = generateSensors(i);

    const lastObservedTime = commonStartTime.getTime() + 30 * 60 * 1000; // midpoint of 1h trajectory
    const satData = generateSatelliteJSON(
      satelliteId,
      satelliteName,
      trajectory,
      sensors,
      lastObservedTime
    );

    console.log(`  🛰️  ${satelliteName}:`);
    console.log(`     ID: ${satelliteId}`);
    console.log(`     Points: ${trajectory.length}`);
    console.log(`     Altitude: ${altitude.toFixed(0)} km`);
    console.log(`     Inclination: ${inclination.toFixed(1)}°`);
    console.log(`     Start Anomaly: ${startAnomaly.toFixed(1)}°`);
    console.log('');

    satellitesData.push(satData);
  }

  // Write combined file
  const outputPath = path.join(outputDir, 'many-satellites.json');
  fs.writeFileSync(outputPath, JSON.stringify(satellitesData, null, 2));

  console.log(`✅ Generated: ${outputPath}`);
  console.log(`📊 Total: 14 satellites, 20 points each`);
  console.log('💡 Use this to test scrolling and performance!');
}

main();

