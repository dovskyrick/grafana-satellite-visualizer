# 17 — Pan / Grab Navigation in the Total Map

## What we want

The user can click-and-drag anywhere on the Total Map rectangle to scroll the
view, bringing off-screen parts of the celestial sphere into view.  Releasing
the mouse (or lifting the finger) leaves the map anchored at the new position.

---

## The natural tool: SVG viewBox panning

The entire map lives inside a single `<svg viewBox="0 0 360 180" preserveAspectRatio="none">`.
All rendered coordinates are already in the `[0, 360] × [0, 180]` space.
Panning costs almost nothing computationally: we change the viewBox origin from
`(0, 0)` to `(panX, panY)` and the browser recomputes clipping; every path,
circle, and text that was already drawn stays exactly where it is in SVG space.

Two React state values are all that is needed: `panX` (azimuth offset, °) and
`panY` (elevation offset, °).  The viewBox string becomes
`${panX} ${panY} 360 180`.

---

## The horizontal wrap problem

Azimuth is cyclic: 0° and 360° are the same meridian.  If the user drags far
enough left the Sun, which might sit at az = 10°, should reappear on the right
side of the panel.  There are two ways to handle this:

**Option A — viewBox clamping.**  Restrict `panX` to `[0, 360)` with
`((panX % 360) + 360) % 360`.  This keeps the map centred but objects near
az = 0 / 360 can still be cut in half by the border.

**Option B — double rendering.**  Render all SVG content twice, offset by 360°
in azimuth (a second translated `<g transform="translate(360,0)">`).  The
viewBox then clips naturally and objects straddling the seam appear whole.
This is the right long-term solution and costs very little because the SVG
geometry is already computed.

Vertical (`panY`) should simply be clamped to `[0, 180 - 180] = 0`… actually
the view is exactly 180° tall so there is no vertical scroll unless we zoom.
If zoom is added later (viewBox height < 180), vertical clamping to
`[0, 180 - viewboxHeight]` applies.

---

## Mouse / pointer event wiring

The `<svg>` element is currently `pointerEvents: none` (set on the wrapping
`<div>`).  To enable drag the div needs `pointerEvents: auto` and the SVG
needs three handlers: `onPointerDown` (capture pointer, record drag start),
`onPointerMove` (compute Δx/Δy in viewBox units = pixelDelta × 360/panelWidth),
`onPointerUp / onPointerCancel` (release pointer).

Using `setPointerCapture` on the SVG element guarantees that `pointermove`
events keep arriving even if the pointer leaves the element mid-drag.

---

## Difficulty assessment

The core viewBox pan is **easy** — two state variables and three event handlers,
roughly 25 lines.  Handling the cyclic horizontal seam cleanly with double
rendering adds perhaps 15 more lines of JSX (a second `<g>` wrapping all
content, conditionally rendered when content near az ≈ 0 or az ≈ 360 might be
visible).  Zoom (pinch or scroll-wheel) is a natural follow-on that reuses the
same viewBox mechanism.  Overall difficulty: **low**.
