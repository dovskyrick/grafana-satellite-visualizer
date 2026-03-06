# Time Variable from Time Series Hover/Click — Cross-Panel Access

**Date:** March 6, 2026

---

## The Short Answer

Yes — your plugin panel can receive the **exact timestamp** corresponding to a hover or click on a built-in Time Series panel, without writing a custom emitter panel.

---

## The Mechanism: `DataHoverEvent` and `eventBus`

Every Grafana panel plugin receives an `eventBus` via its props (`PanelProps`). The built-in Time Series panel publishes to this shared bus when the cursor sync feature is active.

**Relevant events from `@grafana/data`:**

| Event | Trigger | Payload |
|---|---|---|
| `DataHoverEvent` | Mouse hover over a point | `{ point: { time: number, ... } }` |
| `DataHoverClearEvent` | Cursor leaves panel | (none) |
| `DataSelectEvent` | Click on a point | `{ point: { time: number, ... } }` |

`point.time` is a Unix timestamp in **milliseconds**.

---

## Prerequisite: Dashboard Cursor Sync

The built-in Time Series panel only publishes `DataHoverEvent` cross-panel when **Shared crosshair** (or Shared Tooltip) is enabled:

> Dashboard settings → Graph tooltip → **Shared crosshair** or **Shared Tooltip**

Without this, hover events stay local to the originating panel.

---

## Listening in Your Plugin (no custom emitter needed)

```typescript
import { DataHoverEvent, DataHoverClearEvent } from '@grafana/data';

useEffect(() => {
  const sub = props.eventBus.subscribe(DataHoverEvent, (event) => {
    const hoverTime = event.payload.point?.time; // Unix ms
    if (hoverTime != null) {
      seekToTime(hoverTime);
    }
  });
  const clearSub = props.eventBus.subscribe(DataHoverClearEvent, () => {
    clearHighlight();
  });
  return () => { sub.unsubscribe(); clearSub.unsubscribe(); };
}, [props.eventBus]);
```

---

## Key Differences from Prior Research

The [November 2025 cross-panel deep dive](../25-11-november/test-plans/cross-panel-events-deep-dive.md) concluded built-in panels don't emit hover events. That was **partially wrong** — they do, via `DataHoverEvent` on the shared `eventBus`, conditioned on cursor sync being enabled.

---

## Practical Implication for This Project

Hover-scrubbing the satellite's position along the orbit by hovering a telemetry time series is **achievable today** with no new panels — just subscribe in `SatelliteVisualizer.tsx` and map `hoverTime` to the nearest data frame index.
