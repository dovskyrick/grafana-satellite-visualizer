# Why `isTracked` Is There and Why Removing It Is Wrong

## The Hidden Dependency Problem

The `selectedMode` effect lists `isTracked` in its dependency array. This means React reruns the entire effect not only when `selectedMode` changes but also when `isTracked` changes. That matters a lot for the satellite → earth transition:

1. User clicks "Earth Focus". `selectedMode` becomes `earth`. Effect runs. `isTracked` is still `true`. The `if (isTracked && trackedSatelliteId)` condition passes. `flyToSatelliteNadirView` starts the animation.
2. 1.6 seconds later the `setTimeout` fires and calls `setIsTracked(false)`.
3. React sees `isTracked` changed. Effect reruns on the `earth` branch **again**.

If `isTracked` were removed from the guard, step 3 would trigger a second `flyToSatelliteNadirView` call mid-animation, restarting the camera movement from whatever intermediate position the first animation had reached. The transition would stutter and never complete cleanly. `isTracked &&` is specifically blocking that second run — it only lets the flyTo through when tracking is still on, i.e. the very first run of the transition.

## What About `trackedSatelliteId` Being Null?

`trackedSatelliteId` starts as `null` and is only set once the first satellite loads. If the user somehow switched to Earth Focus before any satellite data arrived (edge case), `flyToSatelliteNadirView` would receive `null` and silently do nothing. The `trackedSatelliteId` check is therefore pure null-safety and is fine to keep as-is.

## The Real Fix

Removing `isTracked` is wrong. The correct approach is to store the previous mode in a `useRef` and check it in the earth branch. When `prevMode.current === 'groundstation'`, do an unconditional flyTo (tracking is already false so the double-fire risk does not exist). When coming from satellite mode the existing `isTracked &&` guard stays untouched. Two cases, two code paths, no regressions.

**Revised difficulty: 2 / 5.**
