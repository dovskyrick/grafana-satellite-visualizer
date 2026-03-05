/**
 * Pure projection calculation utilities for satellite visualization.
 * These functions compute ground projections for attitude vectors and FOV footprints.
 */

import {
  Cartesian3,
  Quaternion,
  Matrix3,
  Ray,
  IntersectionTests,
  Ellipsoid,
  PolygonHierarchy,
} from 'cesium';

/**
 * Compute the FOV cone footprint on the Earth's surface.
 * Uses adaptive ray subdivision for smooth horizon curves.
 * 
 * @param position - Satellite position in ECEF (Cartesian3)
 * @param orientation - Satellite orientation (Quaternion)
 * @param halfAngleDegrees - FOV cone half-angle in degrees (e.g., 5 for a 10° total cone)
 * @param numRays - Number of initial rays to sample around the cone (default: 36)
 * @param offsetMeters - Offset above surface to avoid z-fighting (default: 100m)
 * @param subdivisionRays - Number of extra rays to add at horizon transitions (default: 10)
 * @returns Array of ground points forming the footprint polygon
 */
export function computeFOVFootprint(
  position: Cartesian3,
  orientation: Quaternion,
  halfAngleDegrees: number,
  numRays = 36,
  offsetMeters = 100,
  subdivisionRays = 10
): Cartesian3[] {
  // Z-axis (cone axis) in body frame
  const zAxisBody = new Cartesian3(0, 0, 1);
  const rotationMatrix = Matrix3.fromQuaternion(orientation);
  const zAxisECEF = Matrix3.multiplyByVector(rotationMatrix, zAxisBody, new Cartesian3());
  const coneAxis = Cartesian3.normalize(zAxisECEF, new Cartesian3());
  
  // Convert half-angle to radians
  const halfAngleRad = (halfAngleDegrees * Math.PI) / 180;
  
  // Find two perpendicular vectors to the cone axis to define a coordinate frame
  const perp1 = Cartesian3.cross(coneAxis, Cartesian3.UNIT_Z, new Cartesian3());
  if (Cartesian3.magnitude(perp1) < 0.01) {
    // Cone axis is parallel to Z, use X instead
    Cartesian3.cross(coneAxis, Cartesian3.UNIT_X, perp1);
  }
  Cartesian3.normalize(perp1, perp1);
  const perp2 = Cartesian3.cross(coneAxis, perp1, new Cartesian3());
  Cartesian3.normalize(perp2, perp2);
  
  // Helper function to cast a ray at a specific angle
  const castRayAtAngle = (angle: number): Cartesian3 | null => {
    // Compute direction on cone surface
    const cosHalf = Math.cos(halfAngleRad);
    const sinHalf = Math.sin(halfAngleRad);
    
    // Direction in the perpendicular plane (circular cross-section of cone)
    const circleDir = Cartesian3.add(
      Cartesian3.multiplyByScalar(perp1, Math.cos(angle) * sinHalf, new Cartesian3()),
      Cartesian3.multiplyByScalar(perp2, Math.sin(angle) * sinHalf, new Cartesian3()),
      new Cartesian3()
    );
    
    // Combine cone axis component and circle component
    const rayDirection = Cartesian3.add(
      Cartesian3.multiplyByScalar(coneAxis, cosHalf, new Cartesian3()),
      circleDir,
      new Cartesian3()
    );
    Cartesian3.normalize(rayDirection, rayDirection);
    
    // Create ray and find Earth intersection
    const ray = new Ray(position, rayDirection);
    const intersection = IntersectionTests.rayEllipsoid(ray, Ellipsoid.WGS84);
    
    if (intersection) {
      const groundPoint = Ray.getPoint(ray, intersection.start);
      
      // Offset above surface to avoid z-fighting with terrain
      const surfaceNormal = Ellipsoid.WGS84.geodeticSurfaceNormal(groundPoint, new Cartesian3());
      const offsetPoint = Cartesian3.add(
        groundPoint,
        Cartesian3.multiplyByScalar(surfaceNormal, offsetMeters, new Cartesian3()),
        new Cartesian3()
      );
      
      return offsetPoint;
    }
    
    return null;
  };
  
  // First pass: sample initial rays and detect transitions
  interface RayResult {
    angle: number;
    point: Cartesian3 | null;
    hit: boolean;
  }
  
  const initialResults: RayResult[] = [];
  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * 2 * Math.PI;
    const point = castRayAtAngle(angle);
    initialResults.push({ angle, point, hit: point !== null });
  }
  
  // Count hits
  const hitCount = initialResults.filter(r => r.hit).length;
  
  // If all hit or all miss, no subdivision needed
  if (hitCount === 0 || hitCount === numRays) {
    return initialResults.filter(r => r.point !== null).map(r => r.point!);
  }
  
  // Partial footprint detected! Find transitions (hit→miss or miss→hit)
  const allResults: RayResult[] = [];
  
  for (let i = 0; i < numRays; i++) {
    const current = initialResults[i];
    const next = initialResults[(i + 1) % numRays];
    
    // Add current point if it hit
    if (current.hit && current.point) {
      allResults.push(current);
    }
    
    // Check for transition
    const isTransition = current.hit !== next.hit;
    
    if (isTransition) {
      // Add subdivision rays between current and next
      const angle1 = current.angle;
      const angle2 = next.angle;
      
      // Handle angle wrap-around at 2π
      let angleDelta = angle2 - angle1;
      if (angleDelta < 0) {
        angleDelta += 2 * Math.PI;
      }
      
      // Cast additional rays in the transition region
      for (let j = 1; j <= subdivisionRays; j++) {
        const t = j / (subdivisionRays + 1);
        const subdivAngle = angle1 + t * angleDelta;
        const subdivPoint = castRayAtAngle(subdivAngle);
        
        if (subdivPoint) {
          allResults.push({ angle: subdivAngle, point: subdivPoint, hit: true });
        }
      }
    }
  }
  
  // Extract points and sort by angle for proper polygon ordering
  const finalPoints = allResults
    .filter(r => r.point !== null)
    .sort((a, b) => a.angle - b.angle)
    .map(r => r.point!);
  
  return finalPoints;
}

/**
 * Compute the FOV cone projection onto the celestial sphere.
 * Projects the sensor FOV outward to show what portion of the sky is being observed.
 * 
 * @param position - Satellite position in ECEF (Cartesian3)
 * @param orientation - Satellite orientation (Quaternion)
 * @param halfAngleDegrees - FOV cone half-angle in degrees
 * @param celestialRadius - Radius of celestial sphere in meters (typically 100× Earth radius)
 * @param numSamples - Number of points to sample around the cone (default: 36)
 * @returns Array of Cartesian3 points forming a polygon on the celestial sphere
 */
export function computeFOVCelestialProjection(
  position: Cartesian3,
  orientation: Quaternion,
  halfAngleDegrees: number,
  celestialRadius: number,
  numSamples = 36
): Cartesian3[] {
  // Z-axis (cone axis) in body frame
  const zAxisBody = new Cartesian3(0, 0, 1);
  const rotationMatrix = Matrix3.fromQuaternion(orientation);
  const zAxisECEF = Matrix3.multiplyByVector(rotationMatrix, zAxisBody, new Cartesian3());
  const coneAxis = Cartesian3.normalize(zAxisECEF, new Cartesian3());
  
  // Convert half-angle to radians
  const halfAngleRad = (halfAngleDegrees * Math.PI) / 180;
  
  // Find two perpendicular vectors to the cone axis
  const perp1 = Cartesian3.cross(coneAxis, Cartesian3.UNIT_Z, new Cartesian3());
  if (Cartesian3.magnitude(perp1) < 0.01) {
    // Cone axis is parallel to Z, use X instead
    Cartesian3.cross(coneAxis, Cartesian3.UNIT_X, perp1);
  }
  Cartesian3.normalize(perp1, perp1);
  const perp2 = Cartesian3.cross(coneAxis, perp1, new Cartesian3());
  Cartesian3.normalize(perp2, perp2);
  
  const projectionPoints: Cartesian3[] = [];
  
  // Sample points around the cone
  for (let i = 0; i < numSamples; i++) {
    const angle = (i / numSamples) * 2 * Math.PI;
    
    // Compute direction on cone surface
    const cosHalf = Math.cos(halfAngleRad);
    const sinHalf = Math.sin(halfAngleRad);
    
    // Direction in the perpendicular plane
    const circleDir = Cartesian3.add(
      Cartesian3.multiplyByScalar(perp1, Math.cos(angle) * sinHalf, new Cartesian3()),
      Cartesian3.multiplyByScalar(perp2, Math.sin(angle) * sinHalf, new Cartesian3()),
      new Cartesian3()
    );
    
    // Combine cone axis component and circle component
    const rayDirection = Cartesian3.add(
      Cartesian3.multiplyByScalar(coneAxis, cosHalf, new Cartesian3()),
      circleDir,
      new Cartesian3()
    );
    Cartesian3.normalize(rayDirection, rayDirection);
    
    // Project onto celestial sphere (simple scalar multiplication from satellite position)
    const projectedPoint = Cartesian3.add(
      position,
      Cartesian3.multiplyByScalar(rayDirection, celestialRadius, new Cartesian3()),
      new Cartesian3()
    );
    
    projectionPoints.push(projectedPoint);
  }
  
  return projectionPoints;
}

/**
 * Compute the line-of-sight visibility radius on Earth's surface for a satellite.
 * The visibility circle is the boundary where the satellite is exactly on the horizon (0° elevation).
 * Uses the WGS84 ellipsoid radius at the satellite's latitude for accuracy.
 *
 * @param position - Satellite ECEF position (Cartesian3)
 * @returns ground circle radius in metres, or null if satellite is below Earth's surface
 */
export function computeVisibilityLoS(position: Cartesian3): number | null {
  const nadirPoint = Ellipsoid.WGS84.scaleToGeodeticSurface(position, new Cartesian3());
  if (!nadirPoint) {
    return null;
  }
  const satMagnitude = Cartesian3.magnitude(position);
  const earthRadius = Cartesian3.magnitude(nadirPoint);
  if (satMagnitude <= earthRadius) {
    return null;
  }
  // Angular radius of visibility circle (Earth central angle from nadir to horizon)
  const angularRadius = Math.acos(earthRadius / satMagnitude);
  return earthRadius * angularRadius;
}

/**
 * Create a dummy triangle PolygonHierarchy for use when data is unavailable.
 * This prevents Cesium rendering errors when no valid data exists.
 * 
 * @param heightMeters - Height above Earth surface (default: 100m)
 * @returns PolygonHierarchy with a tiny triangle at (0,0)
 */
export function createDummyPolygonHierarchy(heightMeters = 100): PolygonHierarchy {
  return new PolygonHierarchy([
    Cartesian3.fromDegrees(0, 0, heightMeters),
    Cartesian3.fromDegrees(0.001, 0, heightMeters),
    Cartesian3.fromDegrees(0, 0.001, heightMeters),
  ]);
}

