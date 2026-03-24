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
  const sseDenominator: number = camera.frustum.sseDenominator;
  const screenHeight: number   = viewer.scene.drawingBufferHeight;
  return targetPixels * Math.max(distance, 10) * sseDenominator / screenHeight;
}
