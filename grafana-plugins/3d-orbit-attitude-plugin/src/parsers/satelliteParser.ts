/**
 * Parser for satellite data from Grafana DataFrames.
 * Handles multiple satellites with time-sampled positions and orientations.
 */

import { DataFrame } from '@grafana/data';
import {
  JulianDate,
  SampledPositionProperty,
  SampledProperty,
  Cartesian3,
  Quaternion,
  Matrix3,
  Transforms,
  TimeInterval,
  TimeIntervalCollection,
  ReferenceFrame,
  LagrangePolynomialApproximation,
} from 'cesium';
import { CoordinatesType, SimpleOptions } from 'types';
import { ParsedSatellite } from 'types/satelliteTypes';
import { parseSensors } from './sensorParser';
import { parseCovariance } from './covarianceParser';

/**
 * Parse multiple satellites from an array of DataFrames.
 * Each DataFrame represents one satellite's trajectory and sensor data.
 * 
 * @param dataFrames - Array of Grafana DataFrames
 * @param options - Panel options
 * @returns Array of parsed satellite data
 */
export function parseSatellites(
  dataFrames: DataFrame[],
  options: SimpleOptions
): ParsedSatellite[] {
  if (!dataFrames || dataFrames.length === 0) {
    return [];
  }

  const satellites: ParsedSatellite[] = [];

  for (let idx = 0; idx < dataFrames.length; idx++) {
    const dataFrame = dataFrames[idx];

    try {
      // Extract satellite ID and name from DataFrame metadata or use defaults
      const satelliteId = dataFrame.meta?.custom?.satelliteId || dataFrame.name || `satellite-${idx}`;
      const satelliteName = dataFrame.meta?.custom?.satelliteName || satelliteId;

      console.log(`📡 Parsing satellite: ${satelliteName} (ID: ${satelliteId})`);

      // Find column indices
      const timeField = dataFrame.fields.find((f: any) => f.name === 'Time' || f.type === 'time');
      const longitudeField = dataFrame.fields.find((f: any) => f.name === 'Longitude');
      const latitudeField = dataFrame.fields.find((f: any) => f.name === 'Latitude');
      const altitudeField = dataFrame.fields.find((f: any) => f.name === 'Altitude');
      const qxField = dataFrame.fields.find((f: any) => f.name === 'qx');
      const qyField = dataFrame.fields.find((f: any) => f.name === 'qy');
      const qzField = dataFrame.fields.find((f: any) => f.name === 'qz');
      const qsField = dataFrame.fields.find((f: any) => f.name === 'qs');

      if (!timeField || !longitudeField || !latitudeField || !altitudeField) {
        console.warn(`❌ Satellite ${satelliteName}: Missing required position fields`);
        continue;
      }

      const lastObservedTime = dataFrame.meta?.custom?.lastObservedTime as number | undefined;

      const timeData = timeField.values;
      const longitudeData = longitudeField.values;
      const latitudeData = latitudeField.values;
      const altitudeData = altitudeField.values;
      const qxData = qxField?.values;
      const qyData = qyField?.values;
      const qzData = qzField?.values;
      const qsData = qsField?.values;

      const numPoints = timeData.length;
      if (numPoints === 0) {
        console.warn(`❌ Satellite ${satelliteName}: No data points`);
        continue;
      }

      console.log(`   Points: ${numPoints}`);

      // Create sampled position and orientation properties
      const position = new SampledPositionProperty(ReferenceFrame.FIXED);
      
      // Configure interpolation for smoother orbital curves
      // Higher degree = smoother curves that better approximate orbital mechanics
      position.setInterpolationOptions({
        interpolationDegree: 5,
        interpolationAlgorithm: LagrangePolynomialApproximation,
      });
      
      const orientation = new SampledProperty(Quaternion);

      let startTime: JulianDate | null = null;
      let stopTime: JulianDate | null = null;
      const trajectoryPositions: Array<{ timeMs: number; position: Cartesian3 }> = [];

      for (let i = 0; i < numPoints; i++) {
        const time = JulianDate.fromDate(new Date(timeData[i]));
        const longitude = longitudeData[i];
        const latitude = latitudeData[i];
        const altitude = altitudeData[i];

        if (i === 0) {
          startTime = time;
        }
        if (i === numPoints - 1) {
          stopTime = time;
        }

        // Convert geodetic to Cartesian (ECEF)
        let positionCartesian: Cartesian3;

        if (options.coordinatesType === CoordinatesType.Geodetic) {
          positionCartesian = Cartesian3.fromDegrees(longitude, latitude, altitude);
        } else if (options.coordinatesType === CoordinatesType.CartesianFixed) {
          positionCartesian = new Cartesian3(longitude, latitude, altitude);
        } else if (options.coordinatesType === CoordinatesType.CartesianInertial) {
          const positionECI = new Cartesian3(longitude, latitude, altitude);
          const transformMatrix = Transforms.computeIcrfToFixedMatrix(time);
          if (transformMatrix) {
            positionCartesian = Matrix3.multiplyByVector(
              transformMatrix,
              positionECI,
              new Cartesian3()
            );
          } else {
            positionCartesian = positionECI;
          }
        } else {
          positionCartesian = Cartesian3.fromDegrees(longitude, latitude, altitude);
        }

        position.addSample(time, positionCartesian);
        trajectoryPositions.push({ timeMs: timeData[i], position: positionCartesian });

        // Add orientation sample if quaternion data exists
        if (qxData && qyData && qzData && qsData) {
          const qx = qxData[i];
          const qy = qyData[i];
          const qz = qzData[i];
          const qs = qsData[i];
          const quaternion = new Quaternion(qx, qy, qz, qs);
          orientation.addSample(time, quaternion);
        } else {
          // Default orientation (identity quaternion)
          orientation.addSample(time, new Quaternion(0, 0, 0, 1));
        }
      }

      // Create availability interval
      const availability = new TimeIntervalCollection([
        new TimeInterval({
          start: startTime!,
          stop: stopTime!,
        }),
      ]);

      // Parse sensors for this satellite
      const sensors = parseSensors(dataFrame);
      console.log(`   Sensors: ${sensors.length}`);

      // Parse covariance data (optional - may not exist in all datasets)
      const covariance = parseCovariance(dataFrame);
      if (covariance.length > 0) {
        console.log(`   Covariance epochs: ${covariance.length}`);
      }

      satellites.push({
        id: satelliteId,
        name: satelliteName,
        position,
        orientation,
        availability,
        sensors,
        covariance: covariance.length > 0 ? covariance : undefined,
        lastObservedTime,
        trajectoryPositions,
      });

      console.log(`✅ Satellite ${satelliteName} parsed successfully`);
    } catch (error) {
      console.error(`❌ Failed to parse satellite at index ${idx}:`, error);
    }
  }

  console.log(`📊 Total satellites parsed: ${satellites.length}`);
  return satellites;
}

