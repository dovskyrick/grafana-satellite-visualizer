# Generic Disk Rendering — One Pipeline, Many Sources

## The Interface Boundary

The rendering pipeline (`seamCutPath` → `fragmentsToSvgPath`) only speaks one language: `{ az: number, el: number }[]`. It is completely agnostic about what produced those points. This is the right boundary. Everything upstream of it is a "disk generator." Everything downstream is rendering.

```
generateFOVRing(satPos, orientation, halfAngle, N)  →  {az,el}[]
generateEarthDisk(satPos, N)                         →  {az,el}[]
generateExclusionZone(satPos, sunECEF, halfAngle, N) →  {az,el}[]
                              ↓ (all three feed here)
                    seamCutPath({az,el}[])
                    fragmentsToSvgPath(fragments)
                              ↓
                          SVG d string
```

Each generator is a small independent function. The seam-cut and SVG serialisation are written once.

## Is It Wise?

Yes. The generators differ only in how they compute the center direction and angular radius of the disk. `generateFOVRing` derives the center from the satellite's quaternion orientation. `generateEarthDisk` derives it from the nadir direction (always az=180°, el=−90° in the satellite's local frame) with angular radius `asin(R_earth / |satPos|)`. Exclusion zones use the Sun or Moon direction as center (already computed the same way as the Sun dot) with a configurable guard angle.

In all cases the ring generation is: given a center direction and an angular radius, sample N points evenly around the rim. That sampling loop is the same geometry regardless of source. It could even be extracted as a single `generateDiskRing(centerAzEl, angularRadius, N)` utility that all three generators call.

## What Changes Per Disk Type

Only two things differ between disk types: how the **center direction** is obtained (quaternion vs nadir vs external ECEF target), and what **angular radius** is used (sensor half-angle vs Earth shadow angle vs guard angle). Everything else is shared.

## Verdict

Start Step 1 with `generateFOVRing` shaped around this interface from day one. When the Earth disk arrives, its generator plugs straight in. When Sun/Moon exclusion zones arrive, same. No refactoring of the rendering pipeline, ever.
