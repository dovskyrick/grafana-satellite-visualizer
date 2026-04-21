# Seam Detection Logic — Left-Right and Top-Bottom Map Edges

## Left-Right Edge (Azimuth Seam at 0° / 360°)

Walk the ring array. For each consecutive pair `[i, i+1]`:

```
delta_az = az[i+1] - az[i]
if abs(delta_az) > 180  →  seam crossing detected
```

The sign of `delta_az` tells direction: positive means the ring went eastward off the right edge (360°→0°), negative means it went westward off the left edge (0°→360°). Interpolate the exact crossing azimuth (`0` or `360`) by finding the `t` where `az[i] + t * delta_az` hits the boundary. The two crossing points (one at `az=360, el=interpolated` and one at `az=0, el=same`) become the seam endpoints of two sub-paths.

## Top-Bottom Edge (Elevation Seam — Zenith / Nadir Singularity)

Elevation is clamped to `[-90°, +90°]` in az/el coordinates. Points can never numerically exceed those limits. The pole crossing manifests differently: both consecutive points are near ±90° elevation, but their azimuths flip by approximately 180°. Detection:

```
both el[i] and el[i+1] > +85°   AND   abs(az[i+1] - az[i]) > 90  →  zenith crossing
both el[i] and el[i+1] < -85°   AND   abs(az[i+1] - az[i]) > 90  →  nadir crossing
```

The physical angular distance between the two 3D directions is small (the ring is smooth), but in map coordinates they jump because the azimuth axis collapses to a point at the pole. The interpolated edge point sits on `y = 0` (zenith) or `y = 180` (nadir) at the interpolated azimuth midpoint between the two ring points.

## Key Difference Between the Two Cases

Left-right: the crossing is a **vertical line** at x=0 or x=360. The ring crosses it with a definite direction and a clean interpolation in azimuth.

Top-bottom: the crossing is a **horizontal line** at y=0 or y=180, but the azimuth at the crossing is ambiguous because the pole is a singularity. The interpolated azimuth is used only for the border-following closure path, not as a geometrically meaningful coordinate.

## Order of Checks

Check left-right first. Only check top-bottom if no left-right seam was found in a given segment. A segment cannot cross both edge types simultaneously for rings with reasonable N (≥16 points).
