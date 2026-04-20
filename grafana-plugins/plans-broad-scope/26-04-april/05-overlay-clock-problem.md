# The Overlay Clock Problem

Cesium is a city that never sleeps. Its render loop is a heartbeat — sixty times a second, the engine ticks the clock forward, moves the satellite, repaints the sky. Everything in the scene lives and breathes because of this heartbeat.

We wanted the SVG overlay to feel alive too. So we attached our listener to that heartbeat: "when Cesium ticks, tell React the new time." `clock.onTick`. Elegant in theory.

But the black rectangle changed things. When the Total Map overlay covers the canvas, the browser sees an opaque layer on top of a GPU surface. It is within the browser's rights — and sometimes its habit — to slow the heartbeat of a canvas it considers invisible. Cesium's render loop, which drives `clock.tick()`, which fires `onTick`, which updates our time — the whole chain depends on that first pulse. When the pulse slows, everything downstream freezes. The Sun hangs in the sky.

`setInterval` does not care about any of this. It is a simple alarm clock bolted to the JavaScript event loop, completely outside the GPU, outside Cesium, outside the render pipeline. It wakes up every 33 milliseconds and asks the Cesium clock one question: "what time is it?" The answer is always available, because `clock.currentTime` is just a number in memory. No rendering required.

The cost: we traded elegance for robustness. The Sun now moves.
