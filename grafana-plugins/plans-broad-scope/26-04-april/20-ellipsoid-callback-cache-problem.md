# The Double-Call Problem in the Ellipsoid Callbacks

## Background: What Is a CallbackProperty?

In Cesium, a `CallbackProperty` is a function that Cesium calls on every animation frame to ask "what is the value right now?". Instead of giving Cesium a fixed number, you give it a function, and Cesium calls that function repeatedly as time moves forward. This is how the ellipsoid changes shape as the satellite moves through time.

## What the Code Does Today

The ellipsoid renderer has two separate `CallbackProperty` instances:

- **Callback A** — called every frame to get the **radii** (the three axis lengths).
- **Callback B** — called every frame to get the **orientation** (which direction the axes point).

Both callbacks do exactly the same expensive work internally: they find the nearest covariance data point for the current time, then call `covarianceToEllipsoid(...)` to compute the result.

## The Problem

`covarianceToEllipsoid` uses a function called `powerIteration` to find the principal axis direction. `powerIteration` starts from a **random vector** every time it runs. Because it starts randomly, the answer it converges to may point in a slightly different direction each call.

So on a single frame: Callback A runs, gets `radii.x = 500 m` along direction `[0.6, 0.8, 0]`. Then Callback B runs independently, gets `orientation` pointing along `[0.8, 0.6, 0]` instead. The radii and the orientation no longer agree with each other. The ellipsoid is stretched in one direction but rotated to point somewhere slightly different.

## Why This Is Not a Crisis Yet

In practice the two random starts usually converge to nearly the same answer, so the visual glitch is subtle. But it is a latent bug that will become obvious and wrong once we add the label — because the label tip position is computed from **both** the radii and the orientation together, and any disagreement between the two will place the label visibly off the ellipsoid surface.

## The Fix in One Sentence

Call `covarianceToEllipsoid` once per frame, cache the result, and have both callbacks (and the new label position callback) read from that shared cache instead of each computing their own independent result.
