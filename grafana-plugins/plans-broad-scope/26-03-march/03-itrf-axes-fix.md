# Fix ITRF Principal Axes Visualization

## Issues

**1. Wrong rotation behaviour**
`computeITRFOrientation` currently builds a local East-North-Up (ENU) frame at the satellite's position. ENU is position-dependent — as the satellite orbits, the "up" direction changes, producing an apparent rotation around the nadir axis. This is incorrect. The ITRF/ECEF frame is *Earth-fixed and global*: X points toward the prime meridian/equator intersection, Y toward 90°E on the equator, Z toward the North Pole. These axes do not depend on satellite position at all.

**2. Labels all show "I"**
In `BodyAxesRenderer`, `vector.name.charAt(0)` extracts the first character. For names like `'ITRF-X'`, `'ITRF-Y'`, `'ITRF-Z'` this yields `'I'` instead of `'X'`, `'Y'`, `'Z'`.

## Fixes

**Orientation fix** — Replace `computeITRFOrientation` with a constant identity-quaternion sampler. With identity orientation, `BodyAxesRenderer` applies no rotation, so `itrfVectors` axes `(1,0,0)`, `(0,1,0)`, `(0,0,1)` are rendered directly in ECEF. The Z-axis will visibly align with Earth's rotation axis: fixed in Earth view, appearing to rotate relative to the satellite in satellite-track view. Drop `itrfSatellites`; reuse `satellites` with the identity orientation.

**Label fix** — Change label extraction to `vector.name.split('-').pop() ?? vector.name` to correctly read `'X'`, `'Y'`, `'Z'` from names prefixed with a frame identifier.
