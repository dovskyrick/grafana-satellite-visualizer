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
  lastObservedTime?: Date;    // Boundary between known past and predicted future
  reverseTime?: boolean;      // If true, Earth rotation drift is inverted (for backward-propagated arcs)
  timeDirection?: 1 | -1;    // 1 = forward in time (default), -1 = backward (anomaly and timestamps retreat)
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
// Earth's sidereal rotation rate: 360° / 86164.1 s (one sidereal day)
const EARTH_ROTATION_DEG_PER_S = 360 / 86164.1;

/**
 * Generate LVLH ellipsoid semi-axes.
 *
 * Before lastObservedMs: constant small axes representing well-known past position.
 * After  lastObservedMs: monotonically growing axes representing prediction uncertainty.
 */
function generateEllipsoidAxes(
  timeMs: number,
  lastObservedMs: number
): { ell_along: number; ell_cross: number; ell_radial: number } {
  const PAST_ALONG  = 500;
  const PAST_CROSS  = 200;
  const PAST_RADIAL = 100;

  if (timeMs <= lastObservedMs) {
    return { ell_along: PAST_ALONG, ell_cross: PAST_CROSS, ell_radial: PAST_RADIAL };
  }

  const secondsAfter = (timeMs - lastObservedMs) / 1000;
  const t = Math.min(secondsAfter / (3 * 3600), 1.0);
  const base = PAST_ALONG + t * t * 4000;

  return {
    ell_along:  base * 1.0,
    ell_cross:  base * 0.5,
    ell_radial: base * 0.17,
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
    lastObservedTime,
    reverseTime = false,
    timeDirection = 1,
  } = params;

  const lastObservedMs = lastObservedTime
    ? lastObservedTime.getTime()
    : startTime.getTime() + (duration / 2) * 1000;

  const inclinationRad = (inclination * Math.PI) / 180;
  const loanRad = (longitudeOfAN * Math.PI) / 180;
  const startAnomalyRad = (startAnomaly * Math.PI) / 180;
  const period = calculateOrbitalPeriod(altitude);

  const points: TrajectoryPoint[] = [];
  const startTimeMs = startTime.getTime();

  for (let i = 0; i < numPoints; i++) {
    const t = (i / (numPoints - 1)) * duration;
    // timeDirection drives both the orbital position and the timestamp direction.
    // When -1, timestamps decrease from startTime and the satellite rewinds its orbit.
    const timeMs = startTimeMs + timeDirection * t * 1000;
    const meanAnomaly = startAnomalyRad + timeDirection * (t / period) * TWO_PI;

    const x = Math.cos(meanAnomaly);
    const y = Math.sin(meanAnomaly);

    const yInc = y * Math.cos(inclinationRad);
    const zInc = y * Math.sin(inclinationRad);

    const xFinal = x * Math.cos(loanRad) - yInc * Math.sin(loanRad);
    const yFinal = x * Math.sin(loanRad) + yInc * Math.cos(loanRad);
    const zFinal = zInc;

    const latitude = Math.asin(zFinal) * (180 / Math.PI);
    // Subtract Earth rotation accumulated since startTime to convert ECI → ECEF longitude.
    // For reverse-time arcs the elapsed time is negated so the drift inverts automatically.
    const elapsedS = reverseTime ? -t : t;
    const lonECI = Math.atan2(yFinal, xFinal) * (180 / Math.PI);
    const longitude = ((lonECI - EARTH_ROTATION_DEG_PER_S * elapsedS + 540) % 360) - 180;

    const ellipsoid = generateEllipsoidAxes(timeMs, lastObservedMs);

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
