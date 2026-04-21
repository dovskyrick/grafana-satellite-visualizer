/**
 * Pure geometry utilities for the Total Map equirectangular overlay.
 *
 * Coordinate convention used throughout:
 *   az  — azimuth in degrees, 0–360, measured East from North in the observer's
 *          geodetic frame.  Maps directly to SVG x in a viewBox="0 0 360 180".
 *   el  — elevation in degrees, −90 (nadir) to +90 (zenith).
 *          Maps to SVG y as  y = 90 − el.
 *
 * Step 1 utilities (stroke-only, no seam handling):
 *   generateFOVRing   — N az/el points tracing the rim of a sensor FOV cone.
 *   ringToSvgPath     — serialises an az/el ring into a single SVG <path> d string.
 *
 * Step 2 will add seam-aware cutting (antimeridian + pole detection).
 */

import { Cartesian3, Quaternion, Matrix3, Ellipsoid } from 'cesium';
import { SensorDefinition } from '../types/sensorTypes';

export interface AzEl {
  az: number; // 0–360°
  el: number; // −90–+90°
}

/**
 * Convert an ECEF target direction (from observer) into azimuth / elevation.
 * Mirrors the computeAzEl helper in SatelliteVisualizer.tsx so this file
 * is self-contained and can be moved without touching the component.
 */
function ecefDirToAzEl(observerPos: Cartesian3, targetPos: Cartesian3): AzEl | null {
  const diff = Cartesian3.subtract(targetPos, observerPos, new Cartesian3());
  const range = Cartesian3.magnitude(diff);
  if (range === 0) { return null; }

  const up = Ellipsoid.WGS84.geodeticSurfaceNormal(observerPos, new Cartesian3());
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

/**
 * Generate N az/el points tracing the rim of a sensor FOV cone as seen from
 * the satellite.
 *
 * The sensor is defined in the satellite's body frame via sensor.orientation.
 * We compose:  q_world = q_satellite × q_sensor_body
 * then rotate the body-frame Z-axis to get the cone axis in ECEF.
 *
 * Because only direction matters for az/el we project to a far "celestial"
 * point (1 × 10^12 m) and call ecefDirToAzEl.
 *
 * @param satPos         Satellite ECEF position at the current clock time.
 * @param satOrientation Satellite orientation quaternion (body → ECEF).
 * @param sensor         SensorDefinition including fov and orientation.
 * @param N              Number of samples around the rim (default 32).
 * @returns              Array of AzEl points in cone-rim order.
 */
export function generateFOVRing(
  satPos: Cartesian3,
  satOrientation: Quaternion,
  sensor: SensorDefinition,
  N = 32
): AzEl[] {
  // Compose satellite world orientation with sensor body-relative orientation.
  const sensorBodyQuat = new Quaternion(
    sensor.orientation.qx,
    sensor.orientation.qy,
    sensor.orientation.qz,
    sensor.orientation.qw
  );
  const worldQuat = Quaternion.multiply(satOrientation, sensorBodyQuat, new Quaternion());
  const rotMatrix = Matrix3.fromQuaternion(worldQuat, new Matrix3());

  // Cone axis in ECEF (body-frame Z rotated to world frame).
  const coneAxis = Cartesian3.normalize(
    Matrix3.multiplyByVector(rotMatrix, new Cartesian3(0, 0, 1), new Cartesian3()),
    new Cartesian3()
  );

  // Build two vectors perpendicular to the cone axis.
  let perp1 = Cartesian3.cross(coneAxis, Cartesian3.UNIT_Z, new Cartesian3());
  if (Cartesian3.magnitude(perp1) < 0.01) {
    Cartesian3.cross(coneAxis, Cartesian3.UNIT_X, perp1);
  }
  Cartesian3.normalize(perp1, perp1);
  const perp2 = Cartesian3.normalize(
    Cartesian3.cross(coneAxis, perp1, new Cartesian3()), new Cartesian3()
  );

  const halfAngleRad = ((sensor.fov / 2) * Math.PI) / 180;
  const cosHalf = Math.cos(halfAngleRad);
  const sinHalf = Math.sin(halfAngleRad);

  // A far distance so the satellite position offset is negligible.
  const CELESTIAL_DIST = 1e12;

  const points: AzEl[] = [];
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * 2 * Math.PI;

    // Direction on the cone rim for this sample.
    const circleDir = Cartesian3.add(
      Cartesian3.multiplyByScalar(perp1, Math.cos(angle) * sinHalf, new Cartesian3()),
      Cartesian3.multiplyByScalar(perp2, Math.sin(angle) * sinHalf, new Cartesian3()),
      new Cartesian3()
    );
    const rayDir = Cartesian3.normalize(
      Cartesian3.add(
        Cartesian3.multiplyByScalar(coneAxis, cosHalf, new Cartesian3()),
        circleDir,
        new Cartesian3()
      ),
      new Cartesian3()
    );

    const farPoint = Cartesian3.add(
      satPos,
      Cartesian3.multiplyByScalar(rayDir, CELESTIAL_DIST, new Cartesian3()),
      new Cartesian3()
    );

    const azel = ecefDirToAzEl(satPos, farPoint);
    if (azel) { points.push(azel); }
  }

  return points;
}

/**
 * Serialise an az/el ring as an SVG <path> d string for a
 * viewBox="0 0 360 180" coordinate system.
 *
 * Step 1 — no seam handling.  The polygon is emitted as a single closed
 * subpath.  If the ring crosses the 0°/360° azimuth seam SVG will draw a
 * visible straight line across the map — this is the expected Step 1 artefact
 * that Step 2 will eliminate.
 *
 * @param points  Az/el ring points from generateFOVRing.
 * @returns       SVG path d string, or '' if fewer than 2 points.
 */
export function ringToSvgPath(points: AzEl[]): string {
  if (points.length < 2) { return ''; }
  const coords = points
    .map(p => `${p.az.toFixed(2)},${(90 - p.el).toFixed(2)}`)
    .join(' L ');
  return `M ${coords} Z`;
}
