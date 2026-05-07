# Solution: Self-Echo Guard for Cesium Event Bus Publishing

## The problem in one sentence
Cesium publishes `DataHoverEvent` → the bus echoes it back to Cesium's own handler → handler sees a hover event while playing → stops the player → Cesium can never play.

## The solution

Add one boolean ref. Set it to `true` immediately before publishing, back to `false` immediately after. The existing hover handler checks it and returns early if set.

```ts
const isOwnPublish = useRef(false);

// Where Cesium publishes its clock time (throttled tick):
isOwnPublish.current = true;
eventBus.publish(new DataHoverEvent({ point: { time: cesiumClockTimeMs } }));
isOwnPublish.current = false;

// Inside the existing DataHoverEvent handler:
eventBus.subscribe(DataHoverEvent, (event) => {
  if (isOwnPublish.current) return;   // ← ignore own echo
  if (clockIsPlaying) stopClock();
  snapClockTo(event.payload.point.time);
});
```

## Why the flag clears correctly
Grafana's event bus dispatches **synchronously** — all subscriber callbacks run inline inside the `publish()` call, before execution returns to the next line. So `isOwnPublish` is still `true` when Cesium's own handler fires, and is set back to `false` before anything else runs.
