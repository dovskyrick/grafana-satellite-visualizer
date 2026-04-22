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
 * that Step 2 eliminates with cutRingAtSeam + fragmentsToSvgPath.
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

// ─── Step 2: seam-aware splitting ────────────────────────────────────────────

/**
 * Split an az/el ring into map-edge-aligned fragments, handling three crossing
 * types detected in this priority order:
 *
 *   1. Left-right (|Δaz| > 180°) — ring crosses the 0°/360° azimuth seam.
 *      Interpolates the exact point on az=0 or az=360 and splits there.
 *
 *   2. Zenith (both el > 85° and |Δaz| > 90°) — ring passes over the zenith
 *      singularity where azimuth becomes meaningless.  Splits at el=90 with an
 *      approximate midpoint azimuth.
 *
 *   3. Nadir (both el < −85° and |Δaz| > 90°) — same, through the nadir.
 *      Splits at el=−90.
 *
 * The ring is treated as a closed polygon (the last point implicitly connects
 * back to the first).  Fragments are returned open (no duplicate first/last
 * point); SVG's Z command closes each one.
 *
 * For a convex ring (FOV cones are always convex in 3D) there are at most two
 * crossings, producing at most two fragments.
 */
export function cutRingAtSeam(points: AzEl[]): AzEl[][] {
  const n = points.length;
  if (n < 2) { return [points.slice()]; }

  const fragments: AzEl[][] = [];
  let current: AzEl[] = [];
  let hadCrossing = false;

  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];

    current.push({ ...a });

    const deltaAz = b.az - a.az;
    const isLR = Math.abs(deltaAz) > 180;
    const isZenith = !isLR && a.el > 85 && b.el > 85 && Math.abs(deltaAz) > 90;
    const isNadir = !isLR && a.el < -85 && b.el < -85 && Math.abs(deltaAz) > 90;

    if (isLR) {
      // ── Left-right seam crossing ───────────────────────────────────────────
      // Interpolate t ∈ [0,1] for where the segment crosses az=0 or az=360.
      // deltaAz < -180: ring moves eastward past 360° (a near 360, b near 0).
      // deltaAz >  180: ring moves westward past  0° (a near   0, b near 360).
      hadCrossing = true;
      let t: number, azEnd: number, azStart: number;

      if (deltaAz < -180) {
        const denom = b.az + 360 - a.az;
        t = denom === 0 ? 0 : Math.max(0, Math.min(1, (360 - a.az) / denom));
        azEnd = 360; azStart = 0;
      } else {
        const denom = a.az + 360 - b.az;
        t = denom === 0 ? 0 : Math.max(0, Math.min(1, a.az / denom));
        azEnd = 0; azStart = 360;
      }

      const elInterp = a.el + t * (b.el - a.el);
      current.push({ az: azEnd, el: elInterp });
      fragments.push(current);
      current = [{ az: azStart, el: elInterp }];

    } else if (isZenith || isNadir) {
      // ── Pole crossing ─────────────────────────────────────────────────────
      // Both points are near the pole; azimuth flips because the pole is a
      // singularity.  Inject an approximate midpoint on the pole boundary
      // (el=±90) and its antipode to start the next fragment.
      hadCrossing = true;
      const poleEl = isZenith ? 90 : -90;

      // Shortest-arc midpoint in azimuth (wrap-aware).
      let azDiff = b.az - a.az;
      if (azDiff > 180)  { azDiff -= 360; }
      if (azDiff < -180) { azDiff += 360; }
      const azMid = ((a.az + azDiff / 2) + 360) % 360;

      current.push({ az: azMid, el: poleEl });
      fragments.push(current);
      current = [{ az: (azMid + 180) % 360, el: poleEl }];
    }
    // else: no crossing — a is already in current, continue.
  }

  if (!hadCrossing) {
    // No crossings — the whole ring is one fragment.
    fragments.push(current);
  } else if (fragments.length > 0) {
    // The "tail" (current) is the continuation of the first fragment.
    // Because the ring is closed, merge tail → beginning of fragments[0].
    if (current.length > 1) {
      fragments[0] = [...current, ...fragments[0]];
    }
  }

  return fragments.filter(f => f.length > 1);
}

/**
 * Serialise an array of az/el polygon fragments into a single SVG <path> d
 * string compatible with viewBox="0 0 360 180".
 *
 * Each fragment becomes one closed subpath (M … Z).  Multiple subpaths are
 * concatenated with a space — SVG renders them all as part of the same
 * <path> element, which means a single stroke color / fill applies to all
 * fragments automatically.
 */
export function fragmentsToSvgPath(fragments: AzEl[][]): string {
  return fragments
    .filter(f => f.length > 1)
    .map(f => {
      const coords = f
        .map(p => `${p.az.toFixed(2)},${(90 - p.el).toFixed(2)}`)
        .join(' L ');
      return `M ${coords} Z`;
    })
    .join(' ');
}

// ─── Step 3: fill, winding normalisation, border-following ───────────────────

/**
 * Signed area of an az/el polygon in SVG map coordinates
 * (x = az 0–360, y = 90 − el, so y increases downward).
 *
 * Positive area  → polygon winds clockwise in SVG → interior fills correctly.
 * Zero / negative → polygon is degenerate or wound counter-clockwise and needs
 *                   correction before fill is applied.
 */
function signedArea(points: AzEl[]): number {
  const n = points.length;
  if (n < 3) { return 0; }
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    // Shoelace in (az, 90−el) space.
    sum += a.az * (90 - b.el) - b.az * (90 - a.el);
  }
  return sum / 2;
}

/**
 * Ensure the ring winds clockwise in SVG map coordinates (positive signed area)
 * so that seam-cut fragments also wind clockwise and fill their interiors.
 * Called on the raw ring BEFORE seam cutting.
 */
function normalizeWinding(points: AzEl[]): AzEl[] {
  return signedArea(points) < 0 ? [...points].reverse() : points;
}

/**
 * Inject border corner waypoints into a fragment whose signed area is ≤ 0.
 *
 * This occurs when the FOV ring projects to a near-horizontal band in map
 * coordinates — the cone axis is pointing close to the zenith or nadir, so
 * all ring points share approximately the same elevation.  The SVG Z closure
 * runs along that horizontal band and encloses zero area.
 *
 * Fix: append the two pole-side corners (top-right + top-left, or
 * bottom-right + bottom-left) so Z closes through those corners instead,
 * forming a rectangle that correctly fills the pole region.
 *
 * The corner order follows the traversal direction of the fragment so the path
 * stays convex and does not self-intersect.
 */
function injectPoleCorners(fragment: AzEl[]): AzEl[] {
  const n = fragment.length;
  if (n < 3) { return fragment; } // Degenerate line segment — leave as-is.

  const firstAz = fragment[0].az;
  const lastAz  = fragment[n - 1].az;

  // One guard is both necessary and sufficient: the fragment must span the
  // FULL map width — one end ≈ az=0, the other ≈ az=360.
  //
  // This is the only case that requires injection.  It arises when there is
  // exactly ONE left-right seam crossing, meaning the FOV cone axis is near
  // the zenith or nadir and the ring laps the entire azimuth range.  The SVG
  // Z closure then runs along the wrong side of the ring (the nadir side for
  // a zenith-pointing cone), so the corners must be injected to close it
  // through the pole instead.
  //
  // Two disconnected fragments from a NORMAL left-right crossing each start
  // and end on the SAME seam side, so spansFullWidth is false for both.
  //
  // NOTE: do NOT add an area check here.  At t=0 the cone axis may be exactly
  // at the zenith (area=0); a moment later the satellite has rotated and the
  // ring has tiny but non-zero area — the corners must still be injected.
  const spansFullWidth =
    (firstAz < 0.5 && lastAz > 359.5) ||
    (firstAz > 359.5 && lastAz < 0.5);
  if (!spansFullWidth) { return fragment; }

  // Which pole: average map-y (y = 90 − el).
  const avgY = fragment.reduce((s, p) => s + (90 - p.el), 0) / n;
  const poleEl = avgY <= 90 ? 90 : -90; // el=90 ↔ y=0 zenith, el=−90 ↔ y=180 nadir

  // Inject two corners so Z travels vertically to the pole edge and then
  // horizontally across, enclosing the correct pole-side region.
  if (firstAz < 0.5) {
    // First at left edge (az≈0), last at right edge (az≈360).
    return [...fragment, { az: 360, el: poleEl }, { az: 0, el: poleEl }];
  } else {
    // First at right edge (az≈360), last at left edge (az≈0).
    return [...fragment, { az: 0, el: poleEl }, { az: 360, el: poleEl }];
  }
}

/**
 * Generate N az/el points tracing the rim of the Earth's visible disk as seen
 * from the satellite.
 *
 * The cone axis is the nadir direction (Earth centre → satellite, negated).
 * In ECEF the Earth centre is the origin, so nadir = −normalize(satPos).
 *
 * The angular radius of the visible disk (half-angle of the tangent cone) is:
 *   halfAngle = arcsin(R_earth / |satPos|)
 *
 * For a 500 km LEO orbit this is ≈ 67.6°; for GEO ≈ 8.7°.  It is always
 * strictly less than 90°, so the disk never exceeds a hemisphere and the
 * existing seam-cut + corner-injection pipeline handles it without changes.
 *
 * The generated ring feeds directly into filledRingToSvgPath.
 *
 * @param satPos  Satellite ECEF position at the current clock time.
 * @param N       Number of samples around the rim (default 64 for a smooth arc).
 * @returns       Array of AzEl points in rim order, or [] if satPos is inside Earth.
 */
export function generateEarthDiskRing(satPos: Cartesian3, N = 64): AzEl[] {
  const dist = Cartesian3.magnitude(satPos);
  const R = Ellipsoid.WGS84.maximumRadius; // ≈ 6 378 137 m
  if (dist <= R) { return []; } // satellite inside Earth — should never happen

  // Cone axis: from satellite toward Earth centre = −normalize(satPos).
  const nadirAxis = Cartesian3.normalize(
    Cartesian3.negate(satPos, new Cartesian3()),
    new Cartesian3()
  );

  // Angular radius of the visible disk.
  const halfAngleRad = Math.asin(R / dist);
  const cosHalf = Math.cos(halfAngleRad);
  const sinHalf = Math.sin(halfAngleRad);

  // Build two perpendicular vectors to the nadir axis (same fallback as FOV).
  let perp1 = Cartesian3.cross(nadirAxis, Cartesian3.UNIT_Z, new Cartesian3());
  if (Cartesian3.magnitude(perp1) < 0.01) {
    Cartesian3.cross(nadirAxis, Cartesian3.UNIT_X, perp1);
  }
  Cartesian3.normalize(perp1, perp1);
  const perp2 = Cartesian3.normalize(
    Cartesian3.cross(nadirAxis, perp1, new Cartesian3()), new Cartesian3()
  );

  const CELESTIAL_DIST = 1e12;
  const points: AzEl[] = [];

  for (let i = 0; i < N; i++) {
    const angle = (i / N) * 2 * Math.PI;

    const circleDir = Cartesian3.add(
      Cartesian3.multiplyByScalar(perp1, Math.cos(angle) * sinHalf, new Cartesian3()),
      Cartesian3.multiplyByScalar(perp2, Math.sin(angle) * sinHalf, new Cartesian3()),
      new Cartesian3()
    );
    const rayDir = Cartesian3.normalize(
      Cartesian3.add(
        Cartesian3.multiplyByScalar(nadirAxis, cosHalf, new Cartesian3()),
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
 * Generate an az/el ring for an arbitrary celestial cone (exclusion zone, etc.).
 *
 * The cone axis points from the satellite toward the given ECEF target direction
 * (magnitude is ignored — only direction matters).  The half-angle is fixed by
 * the caller in degrees.
 *
 * Feeds directly into filledRingToSvgPath.
 *
 * @param satPos         Satellite ECEF position.
 * @param targetECEF     ECEF position of the target body (direction only).
 * @param halfAngleDeg   Exclusion zone half-angle in degrees.
 * @param N              Number of rim samples (default 64).
 */
export function generateDirectionDiskRing(
  satPos: Cartesian3,
  targetECEF: Cartesian3,
  halfAngleDeg: number,
  N = 64
): AzEl[] {
  const axis = Cartesian3.normalize(
    Cartesian3.subtract(targetECEF, satPos, new Cartesian3()),
    new Cartesian3()
  );
  if (!Cartesian3.magnitude(axis)) { return []; }

  const halfAngleRad = (halfAngleDeg * Math.PI) / 180;
  const cosHalf = Math.cos(halfAngleRad);
  const sinHalf = Math.sin(halfAngleRad);

  let perp1 = Cartesian3.cross(axis, Cartesian3.UNIT_Z, new Cartesian3());
  if (Cartesian3.magnitude(perp1) < 0.01) {
    Cartesian3.cross(axis, Cartesian3.UNIT_X, perp1);
  }
  Cartesian3.normalize(perp1, perp1);
  const perp2 = Cartesian3.normalize(
    Cartesian3.cross(axis, perp1, new Cartesian3()), new Cartesian3()
  );

  const CELESTIAL_DIST = 1e12;
  const points: AzEl[] = [];

  for (let i = 0; i < N; i++) {
    const angle = (i / N) * 2 * Math.PI;
    const circleDir = Cartesian3.add(
      Cartesian3.multiplyByScalar(perp1, Math.cos(angle) * sinHalf, new Cartesian3()),
      Cartesian3.multiplyByScalar(perp2, Math.sin(angle) * sinHalf, new Cartesian3()),
      new Cartesian3()
    );
    const rayDir = Cartesian3.normalize(
      Cartesian3.add(
        Cartesian3.multiplyByScalar(axis, cosHalf, new Cartesian3()),
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
 * Full pipeline for a filled FOV ring in the Total Map equirectangular view:
 *
 *   1. Normalise winding — ensure CW in SVG (positive signed area) so the
 *      interior fills correctly for all FOV orientations.
 *   2. Cut at map seams — split at the 0°/360° azimuth seam and at
 *      zenith / nadir singularities.
 *   3. Inject border corners — fix any degenerate (near-zero-area) fragment
 *      that results from a cone pointing close to a pole.
 *   4. Serialise — emit a single SVG path d string (M … Z [M … Z …]).
 *
 * The returned string is intended for a <path> element with both fill and
 * stroke.  Use fillOpacity for a semi-transparent fill.
 */
export function filledRingToSvgPath(points: AzEl[]): string {
  const normalised = normalizeWinding(points);
  const fragments  = cutRingAtSeam(normalised);
  // Drop degenerate 2-point slivers (seam-edge artefacts with no fill area)
  // before pole-corner injection so they cannot be mistaken for horizontal bands.
  const fixed = fragments
    .filter(f => f.length >= 3)
    .map(injectPoleCorners);
  return fragmentsToSvgPath(fixed);
}
