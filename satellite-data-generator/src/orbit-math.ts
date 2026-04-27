/**
 * Orbital mechanics utilities for generating realistic satellite trajectories.
 * Supports circular (eccentricity=0) and elliptical (eccentricity>0) Keplerian orbits.
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
  eccentricity?: number;      // 0 = circular (default), >0 = elliptical; altitude becomes periapsis altitude
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
 *
 * Growth is quadratic over a 3-hour horizon so the ellipsoid visibly expands as
 * the satellite moves into the future.
 */
function generateEllipsoidAxes(
  timeMs: number,
  lastObservedMs: number
): { ell_along: number; ell_cross: number; ell_radial: number } {
  const PAST_ALONG  = 500;   // m — known past: ~500 m along-track
  const PAST_CROSS  = 200;   // m
  const PAST_RADIAL = 100;   // m

  if (timeMs <= lastObservedMs) {
    return { ell_along: PAST_ALONG, ell_cross: PAST_CROSS, ell_radial: PAST_RADIAL };
  }

  // Quadratic growth over a 3-hour horizon
  const secondsAfter = (timeMs - lastObservedMs) / 1000;
  const t = Math.min(secondsAfter / (3 * 3600), 1.0); // 0 → 1 over 3 h
  const base = PAST_ALONG + t * t * 4000; // 500 m → 4500 m

  return {
    ell_along:  base * 1.0,  // along-track (principal axis)
    ell_cross:  base * 0.5,  // cross-track
    ell_radial: base * 0.17, // radial (smallest)
  };
}

// Period depends only on semi-major axis: T = 2π√(a³/μ)
function calculateOrbitalPeriod(semiMajorAxisKm: number): number {
  const mu = 398600.4418; // km³/s²
  return TWO_PI * Math.sqrt(Math.pow(semiMajorAxisKm, 3) / mu);
}

/**
 * Solve Kepler's equation M = E − e·sin(E) for eccentric anomaly E.
 * Uses Newton–Raphson; converges in ≤5 iterations for e < 0.3.
 */
function solveKepler(M: number, e: number): number {
  let E = M;
  for (let iter = 0; iter < 10; iter++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) { break; }
  }
  return E;
}

/**
 * Generate a Keplerian orbit trajectory (circular or elliptical).
 * When eccentricity=0 (default) the orbit is circular; altitude is the fixed orbital altitude.
 * When eccentricity>0 the orbit is elliptical; altitude is the periapsis altitude.
 */
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
    eccentricity = 0,
  } = params;

  const lastObservedMs = lastObservedTime
    ? lastObservedTime.getTime()
    : startTime.getTime() + (duration / 2) * 1000; // default: midpoint

  const inclinationRad = (inclination * Math.PI) / 180;
  const loanRad = (longitudeOfAN * Math.PI) / 180;
  const startAnomalyRad = (startAnomaly * Math.PI) / 180;

  // When eccentricity > 0, `altitude` is the periapsis altitude.
  // Semi-major axis: a = r_periapsis / (1 − e).  For e=0 this equals the orbital radius.
  const periapsisRadiusKm = EARTH_RADIUS_KM + altitude;
  const semiMajorAxisKm   = periapsisRadiusKm / (1 - eccentricity);
  const sqrtOneMinusE2    = Math.sqrt(1 - eccentricity * eccentricity);
  const period = calculateOrbitalPeriod(semiMajorAxisKm);

  const points: TrajectoryPoint[] = [];
  const startTimeMs = startTime.getTime();

  for (let i = 0; i < numPoints; i++) {
    const t = (i / (numPoints - 1)) * duration;
    // timeDirection drives both the orbital position and the timestamp direction.
    // When -1, timestamps decrease from startTime and the satellite rewinds its orbit.
    const timeMs = startTimeMs + timeDirection * t * 1000;
    const meanAnomaly = startAnomalyRad + timeDirection * (t / period) * TWO_PI;

    // Solve Kepler's equation to get eccentric anomaly E (for e=0, E=M exactly).
    const E = solveKepler(meanAnomaly, eccentricity);

    // Position in the orbital plane (km), with Earth's centre at the focus.
    const xOrb     = semiMajorAxisKm * (Math.cos(E) - eccentricity);
    const yOrb     = semiMajorAxisKm * sqrtOneMinusE2 * Math.sin(E);
    const radiusKm = semiMajorAxisKm * (1 - eccentricity * Math.cos(E));

    // Unit direction vector — the inclination/LOAN rotations need only the direction.
    const x = xOrb / radiusKm;
    const y = yOrb / radiusKm;

    // Rotate by inclination (around X-axis)
    const yInc = y * Math.cos(inclinationRad);
    const zInc = y * Math.sin(inclinationRad);

    // Rotate by longitude of ascending node (around Z-axis)
    const xFinal = x * Math.cos(loanRad) - yInc * Math.sin(loanRad);
    const yFinal = x * Math.sin(loanRad) + yInc * Math.cos(loanRad);
    const zFinal = zInc;

    const latitude = Math.asin(zFinal) * (180 / Math.PI);
    // Subtract Earth rotation accumulated since startTime to convert ECI → ECEF longitude.
    // For reverse-time arcs the elapsed time is negated so the drift inverts automatically.
    const elapsedS = reverseTime ? -t : t;
    const lonECI = Math.atan2(yFinal, xFinal) * (180 / Math.PI);
    const longitude = ((lonECI - EARTH_ROTATION_DEG_PER_S * elapsedS + 540) % 360) - 180;

    // Altitude varies along elliptical orbit; for circular orbits it is constant.
    const altitudeM = (radiusKm - EARTH_RADIUS_KM) * 1000;

    const ellipsoid = generateEllipsoidAxes(timeMs, lastObservedMs);

    points.push({
      time: timeMs,
      longitude,
      latitude,
      altitude: altitudeM,
      qx: 0,
      qy: 0,
      qz: 0,
      qs: 1,
      ...ellipsoid,
    });
  }

  return points;
}

/**
 * Generate a tumbling satellite (rotating quaternion).
 */
export function generateTumblingOrbit(params: OrbitParams): TrajectoryPoint[] {
  const baseOrbit = generateCircularOrbit(params);
  
  // Add rotation to quaternion (tumbling around X-axis)
  return baseOrbit.map((point, idx) => {
    const angle = (idx / params.numPoints) * TWO_PI * 5; // 5 full rotations
    return {
      ...point,
      qx: Math.sin(angle / 2),
      qy: 0,
      qz: 0,
      qs: Math.cos(angle / 2),
    };
  });
}

/**
 * Generate random orbit parameters.
 */
export function randomOrbitParams(seed?: number): OrbitParams {
  // Simple seeded random (for reproducibility)
  let currentSeed = seed !== undefined ? seed : Date.now();
  const random = () => {
    const x = Math.sin(currentSeed++) * 10000;
    return x - Math.floor(x);
  };
  
  return {
    altitude: 400 + random() * 600,           // 400-1000 km
    inclination: random() * 90,                // 0-90 degrees
    longitudeOfAN: random() * 360,             // 0-360 degrees
    startTime: new Date(),
    numPoints: 10 + Math.floor(random() * 20), // 10-30 points
    duration: 60 * 60,                         // 1 hour
  };
}

