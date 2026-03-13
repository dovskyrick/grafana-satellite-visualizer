import { Cartesian3 } from 'cesium';

/**
 * Calculate scaled length for vectors/cones based on camera distance and tracking mode
 * 
 * @param baseLength Base length in meters (e.g., 50000 for 50km)
 * @param isTracked Whether satellite is being tracked
 * @param viewer Cesium viewer instance
 * @param satellitePosition Current satellite position
 * @returns Scaled length in meters
 */
export function getScaledLength(
  baseLength: number,
  isTracked: boolean,
  viewer: any,
  satellitePosition: Cartesian3
): number {
  if (viewer) {
    // positionWC = World Coordinates (always ECEF), regardless of the camera's
    // current reference frame. camera.position alone returns local-frame coords
    // when an entity is tracked (lookAtTransform changes the frame), which would
    // give a wildly wrong distance (~Earth radius) in satellite focus mode.
    const cameraPosition = viewer.camera.positionWC;
    const distance = Cartesian3.distance(cameraPosition, satellitePosition);
    // Pure linear scale: arrows are proportional to camera distance in both
    // directions. Reference point: at 1000 km the arrow is exactly baseLength.
    // Clamp at a small floor so arrows never vanish at extreme close-up.
    const scaleFactor = Math.max(0.01, distance / 1_000_000);
    return baseLength * scaleFactor;
  }

  return baseLength;
}

