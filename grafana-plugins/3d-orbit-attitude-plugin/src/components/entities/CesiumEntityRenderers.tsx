/**
 * CesiumEntityRenderers.tsx
 * 
 * Extracted rendering components for 3D entities in the Cesium viewer.
 * 
 * CREATED: December 31, 2025 (Refactoring from SatelliteVisualizer.tsx)
 * PURPOSE: Separate rendering concerns from state management and UI logic
 * 
 * Each component in this file is responsible for rendering a specific type of 3D entity.
 * All components are pure React functional components that receive data via props
 * and render Cesium/Resium entities accordingly.
 * 
 * COMPONENTS:
 * 1. SatelliteEntityRenderer     - Main satellite model/point + trajectory path
 * 2. SensorVisualizationRenderer - Sensor cones + ground footprints + celestial FOV
 * 3. BodyAxesRenderer            - Satellite body axes (X, Y, Z) with dynamic scaling
 * 4. CelestialGridRenderer       - RA/Dec celestial coordinate grid with labels
 * 5. GroundStationRenderer       - Ground station markers on Earth surface
 * 
 * DESIGN PRINCIPLES:
 * - Single Responsibility: Each renderer does one thing
 * - Explicit Props: All dependencies passed as props
 * - Type Safety: Full TypeScript interfaces for all props
 * - No Side Effects: Pure rendering logic only
 * - Composable: Can be used independently or together
 * 
 * See: grafana-plugins/plans-broad-scope/25-12-december/31-refactoring-complete-summary.md
 */

import React from 'react';
import { Color, Cartesian3, Cartesian2, Resource, IonResource, LabelStyle, HorizontalOrigin, VerticalOrigin, ArcType, Matrix3, CallbackProperty, PolylineArrowMaterialProperty, Quaternion, PolygonHierarchy, Ellipsoid, JulianDate, Simon1994PlanetaryPositions, Transforms } from 'cesium';
import { Entity, PointGraphics, LabelGraphics, PolylineGraphics, PolygonGraphics, ModelGraphics, PathGraphics, EllipsoidGraphics } from 'resium';
import { ParsedSatellite } from 'types/satelliteTypes';
import { SensorDefinition } from 'types/sensorTypes';
import { GroundStation } from 'types/groundStationTypes';
import { SimpleOptions, AssetMode } from 'types';
import { getScaledLength } from 'utils/cameraScaling';
import { hexToRgb } from 'utils/colorHelpers';
import { generateConeMesh, generateSolidConeMesh, SENSOR_COLORS } from 'utils/sensorCone';
import { computeFOVFootprint, computeFOVCelestialProjection, createDummyPolygonHierarchy } from 'utils/projections';
import { covarianceToEllipsoid, getOpacityForQuality } from 'utils/covarianceEllipsoid';

/**
 * CesiumEntityRenderers.tsx
 * 
 * Extracted rendering components for 3D entities in the Cesium viewer.
 * Each component is responsible for rendering a specific type of entity.
 * 
 * Components:
 * - SatelliteEntityRenderer: Main satellite model/point + path + label
 * - SensorVisualizationRenderer: Sensor cones + FOV projections
 * - BodyAxesRenderer: Satellite body axes (X, Y, Z)
 * - CelestialGridRenderer: RA/Dec celestial coordinate grid
 * - GroundStationRenderer: Ground station markers
 */

// ============================================================================
// 1. SATELLITE ENTITY RENDERER
// ============================================================================

export interface SatelliteEntityProps {
  satellite: ParsedSatellite;
  options: SimpleOptions;
  satelliteResource: Resource | IonResource | string | undefined;
  isTracked: boolean;
  hasEllipsoidVisible?: boolean;
}

/**
 * SatelliteEntityRenderer
 * 
 * Renders the main satellite entity with its model/point representation and trajectory path.
 * This is the core visual representation of the satellite.
 * 
 * @param satellite - The parsed satellite data with position and orientation
 * @param options - Panel options controlling visualization settings
 * @param satelliteResource - Cesium resource for 3D model (if using model mode)
 * @param isTracked - Whether this satellite is currently being tracked by the camera
 */
export const SatelliteEntityRenderer: React.FC<SatelliteEntityProps> = ({
  satellite,
  options,
  satelliteResource,
  isTracked,
  hasEllipsoidVisible,
}) => {
  // When ellipsoid is visible, don't scale up the satellite model to avoid size confusion
  const effectiveMinimumPixelSize = hasEllipsoidVisible ? 1 : options.modelMinimumPixelSize;
  
  return (
    <Entity
      id={satellite.id}
      name={satellite.name}
      availability={satellite.availability}
      position={satellite.position}
      orientation={satellite.orientation}
      tracked={isTracked}
    >
      {/* Point representation */}
      {options.assetMode === AssetMode.Point && (
        <PointGraphics 
          pixelSize={options.pointSize} 
          color={Color.fromCssColorString(options.pointColor)} 
        />
      )}
      
      {/* 3D Model representation */}
      {options.assetMode === AssetMode.Model && satelliteResource && (
        <ModelGraphics
          uri={satelliteResource}
          scale={options.modelScale}
          minimumPixelSize={effectiveMinimumPixelSize}
          maximumScale={options.modelMaximumScale}
        />
      )}
      
      {/* Trajectory path */}
      {options.trajectoryShow && (
        <PathGraphics
          width={options.trajectoryWidth}
          material={Color.fromCssColorString(options.trajectoryColor)}
          resolution={30}
          leadTime={options.trajectoryLeadTime}
          trailTime={options.trajectoryTrailTime}
        />
      )}
    </Entity>
  );
};

// ============================================================================
// 2. SENSOR VISUALIZATION RENDERER
// ============================================================================

export interface SensorVisualizationProps {
  satellite: ParsedSatellite;
  sensor: SensorDefinition;
  options: SimpleOptions;
  isTracked: boolean;
  viewerRef: React.RefObject<any>;
  sensorIndex: number; // For color selection
  transparentMode?: boolean; // Toggle between wireframe and transparent rendering
  customColor?: string; // Optional custom color from UI settings (hex string)
  selectedMode?: string;
}

export const SensorVisualizationRenderer: React.FC<SensorVisualizationProps> = ({
  satellite,
  sensor,
  options,
  isTracked,
  viewerRef,
  sensorIndex,
  transparentMode = false, // Default to wireframe mode
  customColor, // User-selected color from settings UI
  selectedMode,
}) => {
  // Priority for color selection:
  // 1. customColor (from UI settings - highest priority)
  // 2. sensor.color (from JSON)
  // 3. Default palette based on sensorIndex
  const defaultColor = SENSOR_COLORS[sensorIndex % SENSOR_COLORS.length];
  
  let sensorColor = defaultColor;
  
  if (customColor) {
    // Use custom color from UI settings (highest priority)
    const parsed = hexToRgb(customColor);
    sensorColor = parsed || defaultColor;
  } else if (sensor.color) {
    // Use color from JSON
    const parsed = hexToRgb(sensor.color);
    sensorColor = parsed || defaultColor;
  }
  
  return (
    <>
      {/* 1. Sensor Cone (3D FOV visualization) */}
      {/* Wireframe Mode (Original) */}
      {options.showSensorCones && !transparentMode && (
        <Entity 
          key={`${satellite.id}-sensor-cone-${sensor.id}`}
          name={`${satellite.name} - ${sensor.name} (FOV: ${sensor.fov}°)`}
          availability={satellite.availability}
        >
          <PolylineGraphics
            positions={new CallbackProperty((time) => {
              const satPos = satellite.position.getValue(time);
              const satOrient = satellite.orientation.getValue(time);
              if (!satPos || !satOrient) {
                return [];
              }
              
              // Sensor body frame orientation (constant, relative to satellite)
              const sensorBodyQuat = new Quaternion(
                sensor.orientation.qx,
                sensor.orientation.qy,
                sensor.orientation.qz,
                sensor.orientation.qw
              );
              
              // Compute sensor world orientation: q_world = q_satellite × q_sensor_body
              const sensorWorldQuat = Quaternion.multiply(
                satOrient,
                sensorBodyQuat,
                new Quaternion()
              );
              
              // Get sensor pointing direction (Z-axis in sensor frame)
              const rotMatrix = Matrix3.fromQuaternion(sensorWorldQuat);
              const sensorDir = Matrix3.multiplyByVector(
                rotMatrix,
                new Cartesian3(0, 0, 1),  // Z-axis
                new Cartesian3()
              );
              Cartesian3.normalize(sensorDir, sensorDir);
              
              // Generate cone mesh with camera-scaled length (reduced to 60% to avoid overlap with reference axes)
              const viewer = viewerRef.current?.cesiumElement;
              let coneLength = getScaledLength(30000, isTracked, viewer, satPos);
              
              // In tracked mode, reduce sensor cones to 60% of standard tracked length
              if (isTracked) {
                coneLength *= 0.6;
              }
              
              return generateConeMesh(satPos, sensorDir, sensor.fov, coneLength, 16);
            }, false)}
            width={1.5}
            material={Color.fromBytes(
              sensorColor.r,
              sensorColor.g,
              sensorColor.b,
              Math.floor(sensorColor.a * 255)
            )}
            arcType={ArcType.NONE}
          />
        </Entity>
      )}
      
      {/* Transparent Mode (New) - Renders multiple triangular polygons */}
      {options.showSensorCones && transparentMode && (() => {
        // Compute cone parameters for this render cycle
        const computeConeTriangles = (time: any) => {
          const satPos = satellite.position.getValue(time);
          const satOrient = satellite.orientation.getValue(time);
          if (!satPos || !satOrient) {
            return [];
          }
          
          // Sensor body frame orientation
          const sensorBodyQuat = new Quaternion(
            sensor.orientation.qx,
            sensor.orientation.qy,
            sensor.orientation.qz,
            sensor.orientation.qw
          );
          
          // Compute sensor world orientation
          const sensorWorldQuat = Quaternion.multiply(
            satOrient,
            sensorBodyQuat,
            new Quaternion()
          );
          
          // Sensor direction in world frame
          const rotMatrix = Matrix3.fromQuaternion(sensorWorldQuat);
          const sensorDir = Matrix3.getColumn(rotMatrix, 2, new Cartesian3());
          
          // Get scaled cone length
          const viewer = viewerRef.current?.cesiumElement;
          if (!viewer) {
            return [];
          }
          let coneLength = getScaledLength(30000, isTracked, viewer, satPos);
          
          // In tracked mode, reduce sensor cones to 60% of standard tracked length
          if (isTracked) {
            coneLength *= 0.6;
          }
          
          // Generate solid cone triangles
          return generateSolidConeMesh(satPos, sensorDir, sensor.fov, coneLength, 24); // 24 segments for good performance
        };
        
        // Create initial triangles for rendering (will be updated via CallbackProperty)
        const initialTriangles = Array.from({ length: 24 }, (_, i) => i);
        
        return initialTriangles.map((_, triIndex) => (
          <Entity
            key={`${satellite.id}-sensor-cone-tri-${sensor.id}-${triIndex}`}
            name={`${satellite.name} - ${sensor.name} (FOV: ${sensor.fov}°)`}
            availability={satellite.availability}
          >
            <PolygonGraphics
              hierarchy={new CallbackProperty((time) => {
                const triangles = computeConeTriangles(time);
                if (triIndex < triangles.length) {
                  return new PolygonHierarchy(triangles[triIndex]);
                }
                return createDummyPolygonHierarchy();
              }, false)}
              material={Color.fromBytes(
                sensorColor.r,
                sensorColor.g,
                sensorColor.b,
                Math.floor(0.3 * 255) // 30% opacity
              )}
              outline={false}
              perPositionHeight={true}
            />
          </Entity>
        ));
      })()}
      
      {/* 2. FOV Ground Footprint */}
      {options.showFOVFootprint && (
        <Entity 
          key={`${satellite.id}-sensor-footprint-${sensor.id}`}
          name={`${satellite.name} - ${sensor.name} Footprint`}
          availability={satellite.availability}
        >
          <PolygonGraphics
            hierarchy={new CallbackProperty((time) => {
              const satPos = satellite.position.getValue(time);
              const satOrient = satellite.orientation.getValue(time);
              if (!satPos || !satOrient) {
                return createDummyPolygonHierarchy();
              }

              // Sensor body frame orientation (constant, relative to satellite)
              const sensorBodyQuat = new Quaternion(
                sensor.orientation.qx,
                sensor.orientation.qy,
                sensor.orientation.qz,
                sensor.orientation.qw
              );
              
              // Compute sensor world orientation: q_world = q_satellite × q_sensor_body
              const sensorWorldQuat = Quaternion.multiply(
                satOrient,
                sensorBodyQuat,
                new Quaternion()
              );
              
              // Compute FOV footprint
              const footprintPoints = computeFOVFootprint(
                satPos,
                sensorWorldQuat,
                sensor.fov / 2  // computeFOVFootprint expects half-angle
              );

              // Return points, or dummy triangle if cone doesn't hit Earth
              return footprintPoints.length > 0 
                ? new PolygonHierarchy(footprintPoints)
                : createDummyPolygonHierarchy();
            }, false) as any}
            material={Color.fromBytes(
              sensorColor.r,
              sensorColor.g,
              sensorColor.b,
              Math.floor(0.3 * 255)  // 30% alpha for footprint
            )}
            outline={true}
            outlineColor={Color.fromBytes(
              sensorColor.r,
              sensorColor.g,
              sensorColor.b,
              255
            )}
            outlineWidth={2}
            height={0}
          />
        </Entity>
      )}
      
      {/* 3. Celestial FOV Projection */}
      {/* Celestial FOV label — shown in satellite focus mode only when the RA/Dec grid is off */}
      {options.showCelestialFOV && selectedMode === 'satellite' && !options.showRADecGrid && (
        <Entity
          key={`${satellite.id}-sensor-celestial-label-${sensor.id}`}
          availability={satellite.availability}
          position={new CallbackProperty((time) => {
            const satPos = satellite.position.getValue(time);
            const satOrient = satellite.orientation.getValue(time);
            if (!satPos || !satOrient) { return Cartesian3.ZERO; }
            const sensorBodyQuat = new Quaternion(
              sensor.orientation.qx, sensor.orientation.qy,
              sensor.orientation.qz, sensor.orientation.qw
            );
            const sensorWorldQuat = Quaternion.multiply(satOrient, sensorBodyQuat, new Quaternion());
            const rotMatrix = Matrix3.fromQuaternion(sensorWorldQuat);
            const sensorDir = Cartesian3.normalize(
              Matrix3.multiplyByVector(rotMatrix, new Cartesian3(0, 0, 1), new Cartesian3()),
              new Cartesian3()
            );
            const celestialRadius = Ellipsoid.WGS84.maximumRadius * 100;
            return Cartesian3.add(
              satPos,
              Cartesian3.multiplyByScalar(sensorDir, celestialRadius, new Cartesian3()),
              new Cartesian3()
            );
          }, false) as any}
        >
          <LabelGraphics
            text={`${sensor.name} FOV`}
            font="12px sans-serif"
            fillColor={Color.WHITE}
            outlineColor={Color.BLACK}
            outlineWidth={2}
            style={LabelStyle.FILL_AND_OUTLINE}
            pixelOffset={new Cartesian2(0, -14)}
            horizontalOrigin={HorizontalOrigin.CENTER}
            verticalOrigin={VerticalOrigin.BOTTOM}
          />
        </Entity>
      )}

      {options.showCelestialFOV && (
        <Entity 
          key={`${satellite.id}-sensor-celestial-${sensor.id}`}
          name={`${satellite.name} - ${sensor.name} Celestial FOV`}
          availability={satellite.availability}
        >
          <PolygonGraphics
            hierarchy={new CallbackProperty((time) => {
              const satPos = satellite.position.getValue(time);
              const satOrient = satellite.orientation.getValue(time);
              if (!satPos || !satOrient) {
                return createDummyPolygonHierarchy();
              }

              // Sensor body frame orientation
              const sensorBodyQuat = new Quaternion(
                sensor.orientation.qx,
                sensor.orientation.qy,
                sensor.orientation.qz,
                sensor.orientation.qw
              );
              
              // Compute sensor world orientation
              const sensorWorldQuat = Quaternion.multiply(
                satOrient,
                sensorBodyQuat,
                new Quaternion()
              );
              
              // Celestial sphere radius (same as RA/Dec grid)
              const celestialRadius = Ellipsoid.WGS84.maximumRadius * 100;
              
              // Compute celestial projection
              const celestialPoints = computeFOVCelestialProjection(
                satPos,
                sensorWorldQuat,
                sensor.fov / 2,  // Half-angle
                celestialRadius
              );

              return celestialPoints.length > 0 
                ? new PolygonHierarchy(celestialPoints)
                : createDummyPolygonHierarchy();
            }, false) as any}
            material={Color.fromBytes(
              sensorColor.r,
              sensorColor.g,
              sensorColor.b,
              Math.floor(0.3 * 255)  // 30% alpha for transparency
            )}
            outline={true}
            outlineColor={Color.fromBytes(
              sensorColor.r,
              sensorColor.g,
              sensorColor.b,
              255
            )}
            outlineWidth={1}  // Match celestial grid line width
            perPositionHeight={true}
          />
        </Entity>
      )}
    </>
  );
};

// ============================================================================
// 3. BODY AXES RENDERER
// ============================================================================

export interface BodyAxesProps {
  satellite: ParsedSatellite;
  options: SimpleOptions;
  isTracked: boolean;
  viewerRef: React.RefObject<any>;
  attitudeVectors: Array<{ axis: Cartesian3; color: Color; name: string }>;
}

export const BodyAxesRenderer: React.FC<BodyAxesProps> = ({
  satellite,
  options,
  isTracked,
  viewerRef,
  attitudeVectors,
}) => {
  return (
    <>
      {attitudeVectors.map((vector, index) => {
        // Extract axis letter (X, Y, or Z) from name
        const axisLetter = vector.name.charAt(0);
        
        return (
          <React.Fragment key={`${satellite.id}-attitude-vector-${index}`}>
            {/* Vector line */}
            <Entity 
              availability={satellite.availability} 
            >
              <PolylineGraphics
                positions={new CallbackProperty((time) => {
                  const pos = satellite.position.getValue(time);
                  const orient = satellite.orientation.getValue(time);
                  if (!pos || !orient) {
                    return [];
                  }
                  
                  // Calculate dynamic vector length based on tracking mode and camera distance
                  const viewer = viewerRef.current?.cesiumElement;
                  const vectorLength = getScaledLength(50000, isTracked, viewer, pos);
                  
                  // Rotate axis by satellite orientation to get direction in ECEF
                  const rotationMatrix = Matrix3.fromQuaternion(orient);
                  const axisECEF = Matrix3.multiplyByVector(rotationMatrix, vector.axis, new Cartesian3());
                  
                  // Calculate endpoint with dynamic length
                  const endPos = Cartesian3.add(
                    pos,
                    Cartesian3.multiplyByScalar(axisECEF, vectorLength, new Cartesian3()),
                    new Cartesian3()
                  );
                  
                  return [pos, endPos];
                }, false)}
                width={10}
                material={new PolylineArrowMaterialProperty(vector.color)}
                arcType={ArcType.NONE}
              />
            </Entity>
            
            {/* Label at vector tip */}
            <Entity
              availability={satellite.availability}
              position={new CallbackProperty((time) => {
                const pos = satellite.position.getValue(time);
                const orient = satellite.orientation.getValue(time);
                if (!pos || !orient) {
                  return Cartesian3.ZERO;
                }
                
                // Calculate dynamic vector length (same as the line)
                const viewer = viewerRef.current?.cesiumElement;
                const vectorLength = getScaledLength(50000, isTracked, viewer, pos);
                
                // Rotate axis by satellite orientation to get direction in ECEF
                const rotationMatrix = Matrix3.fromQuaternion(orient);
                const axisECEF = Matrix3.multiplyByVector(rotationMatrix, vector.axis, new Cartesian3());
                
                // Calculate endpoint (tip of vector)
                const endPos = Cartesian3.add(
                  pos,
                  Cartesian3.multiplyByScalar(axisECEF, vectorLength, new Cartesian3()),
                  new Cartesian3()
                );
                
                return endPos;
              }, false) as any}
            >
              <LabelGraphics
                text={axisLetter}
                font="12px sans-serif"
                fillColor={(() => {
                  // Brighten the vector color to almost white (mix 85% white, 15% original color)
                  const r = Math.min(255, Math.floor(vector.color.red * 255 * 0.15 + 255 * 0.85));
                  const g = Math.min(255, Math.floor(vector.color.green * 255 * 0.15 + 255 * 0.85));
                  const b = Math.min(255, Math.floor(vector.color.blue * 255 * 0.15 + 255 * 0.85));
                  return Color.fromBytes(r, g, b);
                })()}
                outlineColor={Color.BLACK}
                outlineWidth={2}
                style={LabelStyle.FILL_AND_OUTLINE}
                pixelOffset={new Cartesian2(5, -5)}
                horizontalOrigin={HorizontalOrigin.LEFT}
                verticalOrigin={VerticalOrigin.BOTTOM}
              />
            </Entity>
          </React.Fragment>
        );
      })}
    </>
  );
};

// ============================================================================
// 4. CELESTIAL GRID RENDERER
// ============================================================================

export interface CelestialGridProps {
  options: SimpleOptions;
  raLines: Cartesian3[][];
  decLines: Cartesian3[][];
  gridLabels: Array<{ position: Cartesian3; text: string }>;
}

export const CelestialGridRenderer: React.FC<CelestialGridProps> = ({
  options,
  raLines,
  decLines,
  gridLabels,
}) => {
  return (
    <>
      {/* RA/Dec Celestial Grid - Right Ascension Lines (Meridians) */}
      {raLines.map((line, index) => (
        <Entity name={`RA Line ${index}`} key={`ra-${index}`}>
          <PolylineGraphics
            positions={line}
            width={1}
            material={Color.WHITE.withAlpha(0.5)}
            arcType={ArcType.NONE}
          />
        </Entity>
      ))}

      {/* RA/Dec Celestial Grid - Declination Lines (Parallels) - Light Brown */}
      {decLines.map((line, index) => (
        <Entity name={`Dec Line ${index}`} key={`dec-${index}`}>
          <PolylineGraphics
            positions={line}
            width={1}
            material={Color.fromBytes(200, 180, 160, 128)}
            arcType={ArcType.NONE}
          />
        </Entity>
      ))}

      {/* RA/Dec Grid Labels - Color coded: White for RA (hours), Light Brown for Dec (degrees) */}
      {options.showGridLabels && gridLabels.map((label, index) => {
        // Determine if this is an RA label (ends with 'h') or Dec label (ends with '°')
        const isRALabel = label.text.endsWith('h');
        const labelColor = isRALabel ? Color.WHITE : Color.fromBytes(200, 180, 160, 255);
        
        return (
          <Entity position={label.position} key={`grid-label-${index}`}>
            <LabelGraphics
              text={label.text}
              font={`${options.gridLabelSize}px sans-serif`}
              fillColor={labelColor}
              outlineColor={Color.BLACK}
              outlineWidth={2}
              style={LabelStyle.FILL_AND_OUTLINE}
              pixelOffset={new Cartesian2(0, -10)}
              horizontalOrigin={HorizontalOrigin.CENTER}
              verticalOrigin={VerticalOrigin.BOTTOM}
            />
          </Entity>
        );
      })}
    </>
  );
};

// ============================================================================
// 5. GROUND STATION RENDERER
// ============================================================================

export interface GroundStationProps {
  groundStation: GroundStation;
}

export const GroundStationRenderer: React.FC<GroundStationProps> = ({
  groundStation,
}) => {
  const gsPosition = Cartesian3.fromDegrees(
    groundStation.longitude,
    groundStation.latitude,
    groundStation.altitude
  );

  return (
    <Entity
      name={groundStation.name}
      position={gsPosition}
      key={groundStation.id}
    >
      <PointGraphics
        pixelSize={6}
        color={Color.ORANGE}
        outlineColor={Color.DARKORANGE}
        outlineWidth={2}
      />
      <LabelGraphics
        text={groundStation.name}
        font="14px sans-serif"
        fillColor={Color.WHITE}
        outlineColor={Color.BLACK}
        outlineWidth={2}
        style={LabelStyle.FILL_AND_OUTLINE}
        pixelOffset={new Cartesian2(0, -25)}
        horizontalOrigin={HorizontalOrigin.CENTER}
        verticalOrigin={VerticalOrigin.BOTTOM}
      />
    </Entity>
  );
};

// ============================================================================
// 6. UNCERTAINTY ELLIPSOID RENDERER
// ============================================================================

export interface UncertaintyEllipsoidProps {
  satellite: ParsedSatellite;
  opacityMode: string;
  ellipsoidColor: string;
  sigmaScale?: number;
}

/**
 * UncertaintyEllipsoidRenderer
 * 
 * Renders a single 3D confidence ellipsoid that follows the satellite.
 * The ellipsoid's shape changes based on the nearest covariance data point.
 * 
 * Opacity indicates data quality:
 * - High (70%): Good quality data
 * - Medium (30%): Fair quality data
 * - Low (10%): Poor quality data
 * 
 * @param satellite - Satellite with covariance data
 * @param opacityMode - Data quality visualization mode
 * @param ellipsoidColor - Hex color string for ellipsoid
 * @param sigmaScale - Confidence interval scale (default: 1.0 = 1-sigma ~68%)
 */
export const UncertaintyEllipsoidRenderer: React.FC<UncertaintyEllipsoidProps> = ({
  satellite,
  opacityMode,
  ellipsoidColor,
  sigmaScale = 1.0,
}) => {
  // No covariance data available
  if (!satellite.covariance || satellite.covariance.length === 0) {
    console.log(`ℹ️ No covariance data for ${satellite.name}`);
    return null;
  }

  const opacity = getOpacityForQuality(opacityMode);
  const baseColor = Color.fromCssColorString(ellipsoidColor);
  const color = baseColor.withAlpha(opacity);

  console.log(`🔵 Rendering uncertainty ellipsoid for ${satellite.name} with ${satellite.covariance.length} epochs`);

  // Create dynamic radii property that updates based on current time
  const dynamicRadii = new CallbackProperty((time: JulianDate) => {
    if (!time) {
      return new Cartesian3(100, 100, 100); // Fallback
    }

    // Find nearest covariance epoch to current time
    const currentTimeMs = JulianDate.toDate(time).getTime();
    let nearestEpoch = satellite.covariance![0];
    let minDelta = Math.abs(nearestEpoch.timestamp - currentTimeMs);

    for (const epoch of satellite.covariance!) {
      const delta = Math.abs(epoch.timestamp - currentTimeMs);
      if (delta < minDelta) {
        minDelta = delta;
        nearestEpoch = epoch;
      }
    }

    // Compute ellipsoid parameters from nearest covariance
    const { radii } = covarianceToEllipsoid(nearestEpoch.covariance, sigmaScale);
    return radii;
  }, false);

  // Create dynamic orientation property
  const dynamicOrientation = new CallbackProperty((time: JulianDate) => {
    if (!time) {
      return new Quaternion(0, 0, 0, 1); // Identity
    }

    // Find nearest covariance epoch to current time
    const currentTimeMs = JulianDate.toDate(time).getTime();
    let nearestEpoch = satellite.covariance![0];
    let minDelta = Math.abs(nearestEpoch.timestamp - currentTimeMs);

    for (const epoch of satellite.covariance!) {
      const delta = Math.abs(epoch.timestamp - currentTimeMs);
      if (delta < minDelta) {
        minDelta = delta;
        nearestEpoch = epoch;
      }
    }

    // Compute ellipsoid parameters from nearest covariance
    const { orientation } = covarianceToEllipsoid(nearestEpoch.covariance, sigmaScale);
    return orientation;
  }, false);

  return (
    <Entity
      id={`${satellite.id}-uncertainty-ellipsoid`}
      position={satellite.position}  // Follows satellite position dynamically!
      orientation={dynamicOrientation}
    >
      {/* 
        Using Cesium's native EllipsoidGraphics with dynamic radii.
        The ellipsoid follows the satellite and changes shape based on nearest covariance.
      */}
      <EllipsoidGraphics
        radii={dynamicRadii}
        material={color}
        outline={true}
        outlineColor={color.withAlpha(opacity * 0.8)}
        outlineWidth={2}
      />
    </Entity>
  );
};

// ============================================================================
// 7. CELESTIAL BODIES RENDERER (Sun + Earth Center)
// ============================================================================

export interface CelestialBodiesProps {
  options: SimpleOptions;
  viewerRef: React.RefObject<any>;
  clock?: any; // Cesium Clock for time-based sun position
}

/**
 * CelestialBodiesRenderer
 * 
 * Renders celestial reference objects:
 * 1. Sun - Visual marker on celestial sphere showing sun position
 * 2. Earth Center - Symbol at Earth's center (0,0,0) visible above surface
 * 
 * @param options - Panel options
 * @param viewerRef - Reference to Cesium viewer for accessing scene
 * @param clock - Optional Cesium Clock for time-based calculations
 */
export const CelestialBodiesRenderer: React.FC<CelestialBodiesProps> = ({
  options,
  viewerRef,
  clock,
}) => {
  // Enable Cesium's built-in sun if viewer is available
  React.useEffect(() => {
    if (viewerRef.current?.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;
      if (viewer.scene && viewer.scene.sun) {
        viewer.scene.sun.show = true;
      }
    }
  }, [viewerRef]);

  // Compute sun position on celestial sphere
  const getSunPosition = (time: JulianDate): Cartesian3 => {
    // Use Cesium's built-in sun position calculation (Simon1994PlanetaryPositions)
    // Returns position in Earth-Centered Inertial (ECI/ICRF) frame
    const sunPositionECI = Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time, new Cartesian3());
    
    // Transform from ICRF (inertial) to ECEF (fixed) frame for Cesium rendering
    const icrfToFixed = Transforms.computeIcrfToFixedMatrix(time);
    if (!icrfToFixed) {
      // Fallback if transform unavailable
      const celestialRadius = Ellipsoid.WGS84.maximumRadius * 100;
      const sunDirection = Cartesian3.normalize(sunPositionECI, new Cartesian3());
      return Cartesian3.multiplyByScalar(sunDirection, celestialRadius, new Cartesian3());
    }
    
    // Transform sun position to ECEF
    const sunPositionECEF = Matrix3.multiplyByVector(icrfToFixed, sunPositionECI, new Cartesian3());
    
    // Project to celestial sphere (same radius as RA/Dec grid)
    const celestialRadius = Ellipsoid.WGS84.maximumRadius * 100;
    const sunDirection = Cartesian3.normalize(sunPositionECEF, new Cartesian3());
    return Cartesian3.multiplyByScalar(sunDirection, celestialRadius, new Cartesian3());
  };

  return (
    <>
      {/* Sun Position Marker on Celestial Sphere */}
      {options.showAttitudeVisualization && (
        <Entity
          name="Sun Position"
          position={new CallbackProperty((time) => {
            if (!time) {
              return getSunPosition(JulianDate.now());
            }
            return getSunPosition(time);
          }, false) as any}
        >
          <PointGraphics
            pixelSize={12}
            color={Color.YELLOW}
            outlineColor={Color.ORANGE}
            outlineWidth={2}
          />
          <LabelGraphics
            text="☉ Sun"
            font="16px sans-serif"
            fillColor={Color.YELLOW}
            outlineColor={Color.BLACK}
            outlineWidth={2}
            style={LabelStyle.FILL_AND_OUTLINE}
            pixelOffset={new Cartesian2(0, -25)}
            horizontalOrigin={HorizontalOrigin.CENTER}
            verticalOrigin={VerticalOrigin.BOTTOM}
          />
        </Entity>
      )}

      {/* Earth Center Symbol */}
      {options.showAttitudeVisualization && (
        <Entity
          name="Earth Center"
          position={Cartesian3.ZERO} // Earth center at (0, 0, 0)
        >
          <PointGraphics
            pixelSize={10}
            color={Color.CYAN}
            outlineColor={Color.BLUE}
            outlineWidth={2}
          />
          <LabelGraphics
            text="⊕ Earth Center"
            font="14px sans-serif"
            fillColor={Color.CYAN}
            outlineColor={Color.BLACK}
            outlineWidth={2}
            style={LabelStyle.FILL_AND_OUTLINE}
            pixelOffset={new Cartesian2(0, -20)}
            horizontalOrigin={HorizontalOrigin.CENTER}
            verticalOrigin={VerticalOrigin.BOTTOM}
          />
        </Entity>
      )}
    </>
  );
};
