# Fix: Play Button Stays Visually "Playing" After Clock Stopped by Hover

## Root cause

The CesiumJS `Animation` widget reads its play/pause button state from `ClockViewModel.shouldAnimate` — a **Knockout observable**, not from `clock.shouldAnimate` directly. The two are kept in sync via clock tick events: each tick, `ClockViewModel` reads `clock.shouldAnimate` and updates its observable.

When we set `viewer.clock.shouldAnimate = false` directly (in the hover handler), the clock stops ticking immediately. Since there are no more ticks, `ClockViewModel` never gets the chance to read the updated value and update its Knockout observable. The observable stays `true`, the button stays visually "playing" forever.

## Fix

After stopping the clock, also update `clockViewModel.shouldAnimate` directly. This pushes the value into the Knockout observable immediately, and the button re-renders to "paused":

```ts
const viewer = viewerRef.current?.cesiumElement;
if (viewer?.clock.shouldAnimate) {
  viewer.clock.shouldAnimate = false;
  if (viewer.clockViewModel) {
    viewer.clockViewModel.shouldAnimate = false;
  }
}
```

Apply in both the `DataHoverEvent` and `LegacyGraphHoverEvent` handlers — same two places already touched in the implementation.

## Why this works

`viewer.clockViewModel.shouldAnimate` is the writable side of the Knockout two-way binding. Setting it directly does the same thing as the user clicking the pause button: updates the observable, which triggers the Knockout binding to re-render the button icon to the paused state.

## Difficulty: 1/10 — one extra line per handler.
