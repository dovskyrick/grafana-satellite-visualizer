/**
 * Type definitions for parsed satellite data.
 */

import { SampledPositionProperty, SampledProperty, TimeIntervalCollection, IonResource, Cartesian3 } from 'cesium';
import { SensorDefinition } from './sensorTypes';
import { EllipsoidEpoch } from '../parsers/ellipsoidParser';

/**
 * Parsed satellite data structure containing all information needed for visualization.
 */
export interface ParsedSatellite {
  id: string;                           // Unique identifier (e.g., "sat-1")
  name: string;                         // Display name (e.g., "Starlink-4021")
  position: SampledPositionProperty;    // Time-sampled position (ECEF)
  orientation: SampledProperty;         // Time-sampled orientation (Quaternion)
  availability: TimeIntervalCollection; // Time intervals when satellite has data
  sensors: SensorDefinition[];          // Attached sensors
  resource?: IonResource | string;      // 3D model resource (optional, can use default)
  ellipsoid?: EllipsoidEpoch[];          // Position uncertainty ellipsoid axes (optional)
  lastObservedTime?: number;            // Unix ms — split point between solid (past) and dashed (future) trajectory
  trajectoryPositions: Array<{ timeMs: number; position: Cartesian3 }>;
}

