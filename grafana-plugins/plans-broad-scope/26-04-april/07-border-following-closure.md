# Border-Following Closure for Pole-Enclosing Shapes

## The Problem

After a naïve antimeridian cut you have two point arrays — left fragment and right fragment. For a small disk these are two tidy islands. For a large disk (like the Earth visibility circle) one fragment secretly wraps around a pole. It looks like two islands but it is one connected region that passes through a corner of the map.

## How to Detect It

Before treating fragments as separate polygons, check the **signed area** of each fragment. If the signed area of one fragment is negative (polygon wound the wrong way), it means that fragment is actually the "outside" piece — it encircles the pole and should be closed by travelling the map border, not by connecting its endpoints directly.

Equivalently: after cutting, sum up the latitudinal (elevation) extents of each fragment. If one fragment contains elevation values near ±90°, it is the pole-enclosing one.

## The Border-Following Fix

For the pole-enclosing fragment, instead of closing with a straight line between its two seam endpoints, close it by injecting border waypoints: travel along the ±180° seam edge to the nearest pole corner (top or bottom), across the top or bottom edge of the map to the other corner, back down the opposite seam edge to the second seam endpoint. This creates a closed polygon that correctly fills the region including the pole.

## Complexity

Lightweight. It is a handful of interpolated points injected at cut time — no expensive ray casting, no mesh subdivision. Runs once per shape per frame, O(N) in the number of ring points.
