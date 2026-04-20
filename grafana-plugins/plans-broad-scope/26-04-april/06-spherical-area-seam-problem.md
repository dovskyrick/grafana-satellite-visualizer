# Spherical Area Fills in Equirectangular Projection — The Seam Problem

This is a well-known problem in cartography. D3.js, GDAL, and every serious geo library has had to solve it. The name is the **antimeridian cut**, and the general technique is exactly what you described.

## For Small Disks (Sensor FOV)

Your approach works and is correct. Walk the ring of N points. When two consecutive points differ by more than 180° in azimuth, the segment crosses the seam. Interpolate the exact crossing point (linear interpolation on the azimuth axis gives a good-enough "edge point"). Split the ring into two sub-polygons, each closed at ±0° or ±360° as appropriate. Render both. SVG `<polygon>` or `<path>` handles each independently. This is O(N) and clean.

## For the Earth Disk (Large Disk — the Hard Case)

Here the problem changes topology. A disk covering ~90° angular radius from nadir occupies roughly half the equirectangular rectangle. When it crosses the seam, the two sub-polygons are not two disconnected islands — one of them wraps around an entire edge of the map. The polygon that "continues" past the seam needs to be closed by travelling along the ±180° border of the map and back, forming an L-shaped or U-shaped boundary. This is the **pole-enclosing polygon** problem. D3 solves it by injecting a border-following path at the seam. SVG's even-odd fill rule can also help: render the complement (invert the winding direction) and clip to the map boundary.

## Your Second Idea — Extended Coordinates

Also valid, and simpler to implement for rendering: allow azimuth to run from −360° to +720°, render the polygon once in extended space, then use SVG `<pattern>` tiling or duplicate the polygon shifted by ±360° to cover seam cases. Works well for small disks. Still breaks for pole-enclosing shapes.

## Recommendation

Start with the seam-cut approach for sensor FOVs (small disks, never pole-enclosing). Defer the Earth disk until the FOV case works. The Earth disk will need the border-following closure, which is a separate implementation step.
