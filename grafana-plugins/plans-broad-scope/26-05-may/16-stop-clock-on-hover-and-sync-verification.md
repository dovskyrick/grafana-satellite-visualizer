# Stop Clock on Hover + Verifying Event Bus Sync/Async

## Stopping the clock on time series hover

Yes — this is a required step, not optional. Without it, the sequence breaks:

1. Cesium is playing, publishing every 500 ms.
2. User hovers time series → hover event fires → Cesium snaps to hover time ✓
3. 400 ms later the throttle tick fires → Cesium publishes its (now advanced) clock time → crosshair jumps away from where the user is hovering ✗

The fix is one line added to the existing hover handler:

```ts
eventBus.subscribe(DataHoverEvent, (event) => {
  if (isOwnPublish.current) return;
  if (clockIsPlaying) stopClock();       // ← required
  snapClockTo(event.payload.point.time);
});
```

Once the clock is stopped, the throttle guard (`if (!clockIsPlaying) return`) prevents any further publishes, so the crosshair stays locked to wherever the user hovers.

---

## Verifying sync vs async

Grafana's event bus is built on RxJS `Subject`, whose `.next()` dispatches **synchronously** by default. But rather than assume, verify it directly with a small one-time test inside the plugin:

```ts
let firedDuringPublish = false;

const testSub = eventBus.subscribe(DataHoverEvent, () => {
  firedDuringPublish = isOwnPublish.current;
});

isOwnPublish.current = true;
eventBus.publish(new DataHoverEvent({ point: { time: 0 } }));
isOwnPublish.current = false;

testSub.unsubscribe();
console.log('[cesium-plugin] event bus is synchronous:', firedDuringPublish);
// true  → safe to use the flag pattern as designed
// false → flag is cleared before handler fires; need a different guard
```

Run this once on plugin mount, check the browser console. If it logs `true`, the design is confirmed. If `false`, the alternative is a short `setTimeout(() => { isOwnPublish.current = false; }, 0)` to defer the flag clear until after the async dispatch settles.
