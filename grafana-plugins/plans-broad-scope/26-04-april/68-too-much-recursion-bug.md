# "Too Much Recursion" — One-Off Error Analysis

## Should you worry?

Probably not if it only happened once and a reload fixed it. Here are the likely causes ranked by probability.

---

## Possibilities

**1. React render cycle loop (most likely)**
A `useEffect` or `useMemo` dependency array accidentally includes a value that is re-created on every render (e.g. an inline object or function), causing an infinite re-render chain until the call stack overflows. Cesium callback properties that derive new objects each frame are a known trigger for this.

**2. Cesium `CallbackProperty` infinite call**
A `CallbackProperty` that reads from state which is then updated inside the callback — creating a read→write→re-evaluate loop. Seen in scenario 4's attitude toggle if the callback closes over a mutating ref.

**3. Grafana panel resize observer loop**
Grafana's panel resize observer occasionally enters a loop when the panel dimensions are measured, triggering a re-layout, which triggers a resize event again. Usually self-corrects or crashes once.

**4. Browser GC pressure / tab backgrounding**
A very long Cesium animation loop builds up microtasks while the tab is backgrounded, then all fire together on focus — stack depth exceeds browser limit transiently.

---

## Recommendation
Add a `console.error` boundary or React `ErrorBoundary` around the visualizer. If it recurs, the stack trace will pinpoint the exact call chain.
