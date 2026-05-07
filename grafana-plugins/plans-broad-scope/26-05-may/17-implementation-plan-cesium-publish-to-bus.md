# Implementation Plan: Cesium Clock → Time Series Crosshair

## Confirmed facts going in
- Event bus is **synchronous** (verified in console) ✓
- Play/stop state is `viewer.clock.shouldAnimate` (boolean) ✓
- Viewer is accessed via `viewerRef.current?.cesiumElement` ✓
- Existing hover handler is at the `useEffect` around line 1420 ✓
- `setTimestamp(JulianDate)` already snaps the Cesium clock ✓

---

## Exactly what gets added — three locations, one file

### 1. One new ref near the top of the component

```ts
const isOwnPublish = useRef(false);
```

Guards against the self-echo: set to `true` just before publishing, back to `false` immediately after (safe because the bus is synchronous).

### 2. One new `useEffect` — the throttled clock publisher

```ts
useEffect(() => {
  const id = setInterval(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || !viewer.clock.shouldAnimate) { return; }

    const timeMs = JulianDate.toDate(viewer.clock.currentTime).getTime();
    isOwnPublish.current = true;
    eventBus.publish(new DataHoverEvent({ point: { time: timeMs } }));
    isOwnPublish.current = false;
  }, 500);

  return () => clearInterval(id);
}, [eventBus]);
```

Runs every 500 ms. Does nothing when the clock is paused. Publishes current clock time when playing.

### 3. Two lines added to the existing hover handler

```ts
const dataHoverSubscriber = eventBus.getStream(DataHoverEvent).subscribe((event) => {
  if (isOwnPublish.current) { return; }                         // ← new: ignore self-echo
  const viewer = viewerRef.current?.cesiumElement;
  if (viewer?.clock.shouldAnimate) {
    viewer.clock.shouldAnimate = false;                         // ← new: stop player on hover
  }
  if (event?.payload?.point?.time) {
    setTimestamp(JulianDate.fromDate(new Date(event.payload.point.time)));
  }
});
```

Same pattern applies to the `LegacyGraphHoverEvent` subscriber.

---

## What does NOT change
- `setTimestamp` — untouched
- All scenario logic — untouched
- The sync verification `useEffect` added earlier — can stay or be removed after confirming

## Difficulty: 3/10
Three additions to one file. No new imports needed (`DataHoverEvent` is already imported). Total new lines: ~15.
