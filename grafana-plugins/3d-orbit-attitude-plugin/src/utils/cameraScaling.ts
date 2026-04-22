import { Cartesian3 } from 'cesium';

/**
 * Returns a world-space length in metres that keeps rendered geometry at a
 * constant apparent pixel size regardless of zoom level, FOV, or screen
 * resolution — matching the same maths Cesium uses internally for
 * minimumPixelSize on 3D models.
 *
 * Formula:  worldLength = targetPixels × distance × sseDenominator / screenHeight
 *   sseDenominator = 2·tan(fovY/2)  — pre-cached by Cesium on the frustum object,
 *   updated automatically whenever FOV or aspect ratio changes.
 *
 * Call this inside a scene.postRender listener and store the result in a ref
 * so CallbackProperty callbacks pick it up every frame with no React re-renders.
 *
 * @param targetPixels      Desired on-screen length in pixels (tune per geometry type)
 * @param viewer            Cesium viewer instance
 * @param satellitePosition Current satellite ECEF position
 * @returns World-space length in metres
 */
export function getScaledLength(
  targetPixels: number,
  viewer: any,
  satellitePosition: Cartesian3
): number {
  const camera       = viewer.camera;
  const distance     = Cartesian3.distance(camera.positionWC, satellitePosition);
  const screenHeight: number = viewer.scene.drawingBufferHeight;

  // PerspectiveFrustum has sseDenominator; OrthographicFrustum (used in 2D /
  // Columbus View) does not. Fall back to a viewport-derived approximation so
  // the result stays finite in every scene mode.
  const sseDenominator: number | undefined = camera.frustum.sseDenominator;
  if (sseDenominator !== undefined && isFinite(sseDenominator) && screenHeight > 0) {
    return targetPixels * Math.max(distance, 10) * sseDenominator / screenHeight;
  }

  // Orthographic fallback: approximate from the camera's current view width.
  const frustumWidth: number | undefined = camera.frustum.width;
  if (frustumWidth !== undefined && isFinite(frustumWidth) && screenHeight > 0) {
    const pixelsPerMetre = screenHeight / Math.max(frustumWidth, 1);
    return targetPixels / Math.max(pixelsPerMetre, 1e-6);
  }

  // Last resort: return the raw distance-scaled estimate so the value stays finite.
  return targetPixels * Math.max(distance, 10) / Math.max(screenHeight, 1);
}
