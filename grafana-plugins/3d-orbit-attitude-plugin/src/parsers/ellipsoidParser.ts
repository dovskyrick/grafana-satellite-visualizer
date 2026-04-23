/**
 * Ellipsoid Parser
 *
 * Extracts LVLH ellipsoid semi-axes from Grafana DataFrames.
 * Fields: ell_along, ell_cross, ell_radial (metres).
 */

import { DataFrame, Field } from '@grafana/data';

/**
 * Ellipsoid semi-axes in the LVLH frame (metres).
 */
export interface EllipsoidAxes {
  along:  number;  // along-track semi-axis (largest)
  cross:  number;  // cross-track semi-axis (medium)
  radial: number;  // radial semi-axis (smallest)
}

/**
 * Ellipsoid axes associated with a timestamp.
 */
export interface EllipsoidEpoch {
  timestamp: number;
  axes: EllipsoidAxes;
}

/**
 * Parse ellipsoid data from a DataFrame.
 */
export function parseEllipsoid(dataFrame: DataFrame): EllipsoidEpoch[] {
  try {
    const timeField   = dataFrame.fields.find((f: Field) => f.name === 'Time');
    const alongField  = dataFrame.fields.find((f: Field) => f.name === 'ell_along');
    const crossField  = dataFrame.fields.find((f: Field) => f.name === 'ell_cross');
    const radialField = dataFrame.fields.find((f: Field) => f.name === 'ell_radial');

    if (!timeField || !alongField || !crossField || !radialField) {
      console.log('ℹ️ No ellipsoid data found in DataFrame');
      return [];
    }

    const length = timeField.values.length;
    const epochs: EllipsoidEpoch[] = [];

    for (let i = 0; i < length; i++) {
      const along  = alongField.values[i]  ?? 0;
      const cross  = crossField.values[i]  ?? 0;
      const radial = radialField.values[i] ?? 0;

      if (along > 0 && cross > 0 && radial > 0) {
        epochs.push({
          timestamp: timeField.values[i],
          axes: { along, cross, radial },
        });
      } else {
        console.warn(`⚠️ Invalid ellipsoid axes at index ${i}: non-positive value`);
      }
    }

    console.log(`✅ Parsed ${epochs.length} ellipsoid epochs`);
    return epochs;

  } catch (error) {
    console.warn('❌ Ellipsoid parsing failed:', error);
    return [];
  }
}

/**
 * Find the nearest ellipsoid epoch to a given timestamp.
 */
export function findNearestEllipsoid(
  epochs: EllipsoidEpoch[],
  targetTimestamp: number
): { axes: EllipsoidAxes; deltaTime: number } | null {
  if (epochs.length === 0) { return null; }

  let nearestIndex = 0;
  let minDelta = Math.abs(epochs[0].timestamp - targetTimestamp);

  for (let i = 1; i < epochs.length; i++) {
    const delta = Math.abs(epochs[i].timestamp - targetTimestamp);
    if (delta < minDelta) {
      minDelta = delta;
      nearestIndex = i;
    }
  }

  return { axes: epochs[nearestIndex].axes, deltaTime: minDelta };
}
