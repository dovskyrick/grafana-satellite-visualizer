# Event Bus Trace: Cesium Plays 2s Then User Hovers Time Series

Throttle = 500 ms. Cesium clock starts at TCA−1h. Playing at 1× speed.

---

**T = 0 ms** — User clicks play in Cesium.  
`clockIsPlaying = true`, `isOwnPublish = false`. No bus message yet.

---

**T = 500 ms** — Throttle tick fires.  
- `isOwnPublish = true`  
- Bus ← `DataHoverEvent { time: TCA−1h+0.5s }`  
  - Cesium handler fires → `isOwnPublish` is `true` → **returns early**  
  - Time series panels receive it → crosshair moves ✓  
- `isOwnPublish = false`

---

**T = 1000 ms** — Throttle tick.  
Same as above. Crosshair advances ✓

---

**T = 1500 ms** — Throttle tick.  
Same. Crosshair advances ✓

---

**T = 2000 ms** — User moves mouse into time series panel, hovering over TCA−30min.  
Cesium is between throttle ticks so `isOwnPublish = false`.

- Bus ← `DataHoverEvent { time: TCA−30min }` (from time series panel)  
  - Cesium handler fires → `isOwnPublish` is `false` → **not own echo**  
  - `clockIsPlaying` is `true` → **stops the clock** ✓  
  - Snaps Cesium clock to TCA−30min ✓  
  - Time series crosshair stays at TCA−30min ✓

---

**T = 2100 ms** — User nudges mouse to TCA−29min.  
- Bus ← `DataHoverEvent { time: TCA−29min }`  
  - Cesium handler: clock already stopped → just snaps to TCA−29min ✓

---

## One extra guard needed

If a throttle tick happens to fire at the exact same millisecond the clock gets stopped, the throttle should not publish. Add one check:

```ts
// Throttle tick:
if (!clockIsPlaying) return; // ← do not pollute bus after clock stopped
isOwnPublish.current = true;
eventBus.publish(...);
isOwnPublish.current = false;
```

Without this, the throttle would publish Cesium's current position (which is now whatever the hover snapped it to) back onto the bus — harmless in practice since it's the same time, but noisy and unnecessary.
