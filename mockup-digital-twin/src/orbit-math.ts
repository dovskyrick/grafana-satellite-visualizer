/**
 * Orbital mechanics utilities for generating realistic satellite trajectories.
 * Uses simplified Keplerian orbits (circular for now, can add elliptical later).
 *
 * Copied from satellite-data-generator/src/orbit-math.ts
 */

export interface OrbitParams {
  altitude: number;           // km above Earth surface
  inclination: number;        // degrees (0 = equatorial, 90 = polar)
  longitudeOfAN: number;      // Longitude of Ascending Node (degrees)
  startTime: Date;            // Orbit start time
  numPoints: number;          // Number of data points
  duration: number;           // Total duration in seconds
  startAnomaly?: number;      // Starting position in orbit (degrees), default 0
}

export interface TrajectoryPoint {
  time: number;               // Unix timestamp (ms)
  longitude: number;          // degrees
  latitude: number;           // degrees
  altitude: number;           // meters
  qx: number;                 // Quaternion orientation
  qy: number;
  qz: number;
  qs: number;
  // Position uncertainty ellipsoid semi-axes in LVLH frame (metres)
  ell_along: number;   // along-track (largest)
  ell_cross: number;   // cross-track (medium)
  ell_radial: number;  // radial (smallest)
}

const EARTH_RADIUS_KM = 6371;
const TWO_PI = 2 * Math.PI;

/**
 * Generate LVLH ellipsoid semi-axes that grow with time since last measurement.
 * Returns metres directly — no covariance matrix, no rotation math.
 */
function generateEllipsoidAxes(
  pointIndex: number,
  measurementInterval = 5
): { ell_along: number; ell_cross: number; ell_radial: number } {
  const timeSinceMeasurement = pointIndex % measurementInterval;

  // EXAGGERATED for visual testing — 100 m → 1250 m pulsing cycle
  const base = 100 + (timeSinceMeasurement ** 2) * 50;

  return {
    ell_along:  base * 3.0,
    ell_cross:  base * 1.5,
    ell_radial: base * 0.5,
  };
}

function calculateOrbitalPeriod(altitudeKm: number): number {
  const radiusKm = EARTH_RADIUS_KM + altitudeKm;
  const mu = 398600.4418;
  return TWO_PI * Math.sqrt(Math.pow(radiusKm, 3) / mu);
}

export function generateCircularOrbit(params: OrbitParams): TrajectoryPoint[] {
  const {
    altitude,
    inclination,
    longitudeOfAN,
    startTime,
    numPoints,
    duration,
    startAnomaly = 0,
  } = params;

  const inclinationRad = (inclination * Math.PI) / 180;
  const loanRad = (longitudeOfAN * Math.PI) / 180;
  const startAnomalyRad = (startAnomaly * Math.PI) / 180;
  const period = calculateOrbitalPeriod(altitude);

  const points: TrajectoryPoint[] = [];
  const startTimeMs = startTime.getTime();

  for (let i = 0; i < numPoints; i++) {
    const t = (i / (numPoints - 1)) * duration;
    const timeMs = startTimeMs + t * 1000;

    const meanAnomaly = startAnomalyRad + (t / period) * TWO_PI;

    const x = Math.cos(meanAnomaly);
    const y = Math.sin(meanAnomaly);

    const yInc = y * Math.cos(inclinationRad);
    const zInc = y * Math.sin(inclinationRad);

    const xFinal = x * Math.cos(loanRad) - yInc * Math.sin(loanRad);
    const yFinal = x * Math.sin(loanRad) + yInc * Math.cos(loanRad);
    const zFinal = zInc;

    const latitude = Math.asin(zFinal) * (180 / Math.PI);
    const longitude = Math.atan2(yFinal, xFinal) * (180 / Math.PI);

    const ellipsoid = generateEllipsoidAxes(i);

    points.push({
      time: timeMs,
      longitude,
      latitude,
      altitude: altitude * 1000,
      qx: 0,
      qy: 0,
      qz: 0,
      qs: 1,
      ...ellipsoid,
    });
  }

  return points;
}

export function generateTumblingOrbit(params: OrbitParams): TrajectoryPoint[] {
  const baseOrbit = generateCircularOrbit(params);

  return baseOrbit.map((point, idx) => {
    const angle = (idx / params.numPoints) * TWO_PI * 5;
    return {
      ...point,
      qx: Math.sin(angle / 2),
      qy: 0,
      qz: 0,
      qs: Math.cos(angle / 2),
    };
  });
}
