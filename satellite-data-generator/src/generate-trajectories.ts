import * as fs from 'fs';
import * as path from 'path';
import {
  generateCircularOrbit,
  generateTumblingOrbit,
  randomOrbitParams,
  OrbitParams,
  TrajectoryPoint,
} from './orbit-math';

/**
 * Sensor definition (matches plugin types).
 */
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
 * Ground station definition.
 */
interface GroundStationDefinition {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number; // meters above ellipsoid
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
      // Position uncertainty covariance (ECEF frame, meters²)
      { text: 'cov_xx', type: 'number' },
      { text: 'cov_yy', type: 'number' },
      { text: 'cov_zz', type: 'number' },
      { text: 'cov_xy', type: 'number' },
      { text: 'cov_xz', type: 'number' },
      { text: 'cov_yz', type: 'number' },
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
      p.cov_xx,
      p.cov_yy,
      p.cov_zz,
      p.cov_xy,
      p.cov_xz,
      p.cov_yz,
    ]),
  };
}

/**
 * Generate example sensors for a satellite with unique orientations AND colors.
 */
function generateSensors(satelliteIdx: number): SensorDefinition[] {
  // Different sensor orientations for each satellite (rotations around different axes)
  const satelliteOrientations = [
    // Satellite 0: Standard orientations (nadir, zenith, side)
    [
      { qx: 0, qy: 0, qz: 0, qw: 1 },           // Identity (body +Z)
      { qx: 1, qy: 0, qz: 0, qw: 0 },           // 180° around X (nadir)
      { qx: 0, qy: 0.7071, qz: 0, qw: 0.7071 }, // 90° around Y (side)
    ],
    // Satellite 1: Rotated 45° differently
    [
      { qx: 0.3827, qy: 0, qz: 0, qw: 0.9239 },     // 45° around X
      { qx: 0, qy: 0.3827, qz: 0, qw: 0.9239 },     // 45° around Y
      { qx: 0, qy: 0, qz: 0.3827, qw: 0.9239 },     // 45° around Z
    ],
    // Satellite 2: Rotated 120° differently
    [
      { qx: 0.866, qy: 0, qz: 0, qw: 0.5 },         // 120° around X
      { qx: 0, qy: 0.866, qz: 0, qw: 0.5 },         // 120° around Y
      { qx: 0, qy: 0, qz: 0.866, qw: 0.5 },         // 120° around Z
    ],
  ];

  const orientations = satelliteOrientations[satelliteIdx % satelliteOrientations.length];

  // Green color palette for sensors
  const greenColors = [
    '#1F5E3B', // Dark forest green
    '#2E8B57', // Sea green
    '#4CAF73', // Light green
  ];

  const sensorConfigs = [
    { name: 'Main Camera', fov: 10, orientation: orientations[0], color: greenColors[0] },
    { name: 'Nadir Camera', fov: 15, orientation: orientations[1], color: greenColors[1] },
    { name: 'Star Tracker', fov: 20, orientation: orientations[2], color: greenColors[2] },
  ];

  // Satellite 0: 3 sensors, Satellite 1: 2 sensors, Satellite 2: 1 sensor
  const numSensors = satelliteIdx === 0 ? 3 : satelliteIdx === 1 ? 2 : 1;
  const selectedSensors = sensorConfigs.slice(0, numSensors);

  return selectedSensors.map((config, idx) => ({
    id: `sat${satelliteIdx}-sens${idx}`,
    ...config,
  }));
}

/**
 * Generate realistic ground station locations (NASA Deep Space Network + ESA)
 */
function generateGroundStations(): GroundStationDefinition[] {
  return [
    {
      id: 'gs-goldstone',
      name: 'Goldstone (DSN)',
      latitude: 35.4267,
      longitude: -116.8900,
      altitude: 1005, // meters
    },
    {
      id: 'gs-canberra',
      name: 'Canberra (DSN)',
      latitude: -35.4014,
      longitude: 148.9819,
      altitude: 691,
    },
    {
      id: 'gs-madrid',
      name: 'Madrid (DSN)',
      latitude: 40.4319,
      longitude: -4.2481,
      altitude: 834,
    },
    {
      id: 'gs-kourou',
      name: 'Kourou (ESA)',
      latitude: 5.2517,
      longitude: -52.8050,
      altitude: 26,
    },
  ];
}

/**
 * Main script entry point.
 */
function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--multi'; // Default: generate multiple satellites

  const outputDir = path.join(__dirname, '../output');
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🚀 Generating satellite test data...\n');

  if (mode === '--single') {
    // Generate single satellite
    console.log('Mode: Single Satellite');
    const params = randomOrbitParams(12345); // Seeded for reproducibility
    const trajectory = generateCircularOrbit(params);
    const sensors = generateSensors(0);
    
    const lastObservedTime = trajectory[Math.floor(trajectory.length / 2)].time;
    const satelliteData = generateSatelliteJSON(
      'sat-1',
      'Starlink-4021',
      trajectory,
      sensors,
      lastObservedTime
    );

    const outputPath = path.join(outputDir, 'single-satellite.json');
    fs.writeFileSync(outputPath, JSON.stringify(satelliteData, null, 2));
    
    console.log(`✅ Generated: ${outputPath}`);
    console.log(`   Points: ${trajectory.length}`);
    console.log(`   Sensors: ${sensors.length}`);
    console.log(`   Time range: ${new Date(trajectory[0].time).toISOString()} to ${new Date(trajectory[trajectory.length - 1].time).toISOString()}`);
    
  } else if (mode === '--multi') {
    // Generate multiple satellites
    console.log('Mode: Multiple Satellites\n');
    
    // Explicitly different orbits for visual distinction
    const satelliteConfigs = [
      { 
        id: 'sat-1', 
        name: 'Starlink-4021', 
        type: 'circular',
        altitude: 550,        // Low LEO
        inclination: 53,      // Typical Starlink
        longitudeOfAN: 0,
        startAnomaly: 0,      // Start at 0°
      },
      { 
        id: 'sat-2', 
        name: 'Hubble Space Telescope', 
        type: 'tumbling',
        altitude: 540,        // Slightly lower
        inclination: 28.5,    // Low inclination
        longitudeOfAN: 90,    // 90° offset
        startAnomaly: 120,    // Start at 120°
      },
      { 
        id: 'sat-3', 
        name: 'ISS', 
        type: 'circular',
        altitude: 420,        // ISS altitude
        inclination: 51.6,    // ISS inclination
        longitudeOfAN: 180,   // 180° offset
        startAnomaly: 240,    // Start at 240°
      },
    ];

    const commonStartTime = new Date();  // All satellites start at same time

    const satellitesData = satelliteConfigs.map((config, idx) => {
      // Create explicit orbit parameters (not random)
      const params: OrbitParams = {
        altitude: config.altitude,
        inclination: config.inclination,
        longitudeOfAN: config.longitudeOfAN,
        startTime: commonStartTime,
        numPoints: 15 + idx * 5,  // 15, 20, 25 points
        duration: 60 * 60,  // 1 hour
      };
      
      const trajectory = config.type === 'tumbling'
        ? generateTumblingOrbit(params)
        : generateCircularOrbit(params);
      
      const sensors = generateSensors(idx);
      
      const lastObservedTime = trajectory[Math.floor(trajectory.length / 2)].time;
      const satData = generateSatelliteJSON(
        config.id,
        config.name,
        trajectory,
        sensors,
        lastObservedTime
      );

      console.log(`  🛰️  ${config.name}:`);
      console.log(`     ID: ${config.id}`);
      console.log(`     Type: ${config.type}`);
      console.log(`     Points: ${trajectory.length}`);
      console.log(`     Sensors: ${sensors.length}`);
      console.log(`     Start: ${new Date(trajectory[0].time).toISOString()}`);
      console.log(`     End: ${new Date(trajectory[trajectory.length - 1].time).toISOString()}`);
      console.log(`     Altitude: ${params.altitude.toFixed(0)} km`);
      console.log(`     Inclination: ${params.inclination.toFixed(1)}°`);
      console.log('');
      
      return satData;
    });

    // Write combined multi-satellite file WITH ground stations in the same array
    const groundStations = generateGroundStations();
    
    // Create ground stations object in the format that matches the parser
    const groundStationsObject = {
      type: "groundStations",
      meta: {
        custom: {
          groundStations: groundStations
        }
      },
      columns: [],
      rows: []
    };
    
    // Combine satellites array with ground stations object at the end
    const completeData = [...satellitesData, groundStationsObject];
    
    const outputPath = path.join(outputDir, 'multi-satellite.json');
    fs.writeFileSync(outputPath, JSON.stringify(completeData, null, 2));
    
    console.log(`✅ Generated: ${outputPath}`);
    console.log(`   Total satellites: ${satellitesData.length}`);
    console.log(`   Ground stations: ${groundStations.length}`);
    groundStations.forEach(gs => {
      console.log(`     • ${gs.name} (${gs.latitude.toFixed(2)}°, ${gs.longitude.toFixed(2)}°)`);
    });
    
    // Also write individual satellite files
    satellitesData.forEach((satData, idx) => {
      const individualPath = path.join(outputDir, `satellite-${idx + 1}.json`);
      fs.writeFileSync(individualPath, JSON.stringify(satData, null, 2));
    });
    
    console.log(`\n   Individual files: satellite-1.json, satellite-2.json, satellite-3.json`);
    
    // Also write standalone ground stations file (for reference)
    const groundStationsPath = path.join(outputDir, 'ground-stations.json');
    fs.writeFileSync(groundStationsPath, JSON.stringify(groundStations, null, 2));
    console.log(`   Ground stations file: ground-stations.json (standalone)`);
  }

  console.log('\n✨ Done! Output in: output/');
}

// Run the script
main();

