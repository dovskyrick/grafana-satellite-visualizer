# 360-Degree Live Camera in Cesium — Feasibility & Scope

## What Is Being Asked

A live, real-time 360° render of the actual Cesium scene (Earth, satellites, sensors) from an orbiting viewpoint — **not** displaying a pre-captured panoramic image. This is distinct from Cesium's new (March 2026) `EquirectangularPanorama` / `CubeMapPanorama` API, which only displays static imagery assets inside the scene.

## Why Cesium's Camera Cannot Simply Be Widened

Cesium uses a standard perspective projection matrix. The horizontal scaling factor is `1 / tan(fov/2)`. As FOV → 180°, `tan(fov/2)` → ∞, making the matrix degenerate. This is a fundamental singularity in perspective math, not a Cesium policy choice. At ~179° the frustum planes become nearly coplanar; Cesium clamps FOV before this point. No shader patch can fix this within a single perspective pass — the projection model itself breaks.

## The Only Working Approach: 6-Face Cubemap Render

Render the scene **six times per frame**, each at exactly 90° FOV, aligned to ±X, ±Y, ±Z axes from the satellite position. Assemble the six outputs into a WebGL cubemap texture. A final post-process fragment shader reprojects the cubemap to equirectangular (or any desired display format) for the output canvas.

- **Each face stays at 90° FOV** — well within Cesium's safe range
- **No perspective singularity** — the math remains valid across all faces
- The post-process shader does the spherical-to-2D mapping, not Cesium's frustum

## Technical Challenges

1. **Render loop hijack**: `scene.render()` must be called 6× per frame, swapping camera direction each time, each rendering to a separate offscreen framebuffer (WebGL `TEXTURE_CUBE_MAP` faces or 6 `TEXTURE_2D` targets).
2. **Cesium internal coupling**: tile streaming, shadow maps, and LOD culling are all tied to the single camera state; secondary renders may load wrong tile sets or produce visual artifacts.
3. **6× GPU cost**: every frame renders the full scene geometry six times. At high tile detail this is prohibitive without coarse LOD capping.
4. **Post-process shader**: equirectangular reprojection from cubemap is straightforward GLSL, but must be injected as a Cesium `PostProcessStage` reading the assembled cubemap uniform.

## Task Size

**Large — estimated 3–5 weeks of focused engineering.**

Broken down:
- Offscreen FBO + cubemap assembly harness: ~1 week
- Cesium render loop override (6× per frame, camera state management): ~1.5 weeks
- Post-process equirectangular shader + Cesium `PostProcessStage` integration: ~0.5 week
- Performance mitigation (LOD cap, frame-budget throttling): ~1 week
- Visual QA / seam artifacts at cube face edges: ~0.5 week
