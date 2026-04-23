# GS POV → Earth Focus: `prevMode` Ref Solution

## What Gets Added

A single `useRef` is declared at the top of the component:

```ts
const prevModeRef = useRef<string | null>(null);
```

At the very end of the `selectedMode` effect, before the closing bracket, the ref is updated:

```ts
prevModeRef.current = selectedMode;
```

This gives every run of the effect access to what mode was active on the previous run.

## What Changes in the Earth Branch

The earth branch currently has one path: `if (isTracked && trackedSatelliteId)` — the satellite-to-earth animation. A new `else if` is added directly below it:

```ts
else if (prevModeRef.current === 'groundstation' && trackedSatelliteId) {
  flyToSatelliteNadirView(trackedSatelliteId, 1.5, earthRadius * 2);
}
```

No `setTimeout`, no `setIsTracked` — tracking is already false coming from GS mode so neither is needed. The camera simply flies to nadir view and the free camera is already active.

## Why This Is Safe

The double-fire risk that motivated the original `isTracked &&` guard does not apply here. The double-fire happens because `setIsTracked(false)` triggers a re-run of the effect. In the GS path `isTracked` is already `false` and never changes, so the effect runs exactly once for this transition. The `prevModeRef` check evaluates to `false` on any subsequent run because `prevModeRef.current` has already been updated to `'earth'`.

The existing satellite → earth path is untouched.
