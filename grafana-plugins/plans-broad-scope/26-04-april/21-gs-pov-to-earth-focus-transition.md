# GS POV → Earth Focus Camera Transition Fix

## The Problem

The `earth` mode branch in the `selectedMode` effect already has a beautiful two-step transition: fly to nadir view at 2× Earth radius, wait for the animation, then release the camera. But that branch is guarded by `if (isTracked && trackedSatelliteId)`. When coming from GS POV, `isTracked` is `false` (it was set to false on entering groundstation mode), so the entire animation is skipped and the camera is simply released in place — underground, staring at the sky.

## The Fix

Change the single guard condition from `if (isTracked && trackedSatelliteId)` to `if (trackedSatelliteId)`. That is literally a two-word deletion.

`trackedSatelliteId` is not cleared when entering GS mode, only `isTracked` is set to false. So when the user switches `groundstation → earth`, there is still a valid satellite reference available. Removing the `isTracked` requirement means the nadir flyTo fires regardless of how we entered `earth` mode — whether from satellite focus or GS POV.

The `setIsTracked(false)` inside the `setTimeout` is already idempotent (calling it when already `false` is harmless), so no side effects are introduced.

## Result

GS POV → Earth Focus now follows the same path as Satellite Focus → Earth Focus: fly outward to nadir view at safe distance, then release the free camera. The user always lands at a sane Earth-observing vantage point.

## Difficulty: 1 / 5

One condition, two words removed, zero new state, zero new functions.
