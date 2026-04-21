# Seam Cut — Does SVG Close the Edge Automatically?

No. SVG's `Z` command draws a straight line from the last point back to the first point of the subpath. It does not know about map borders.

For a stroke-only ring (Step 2) this is irrelevant — the visual arc simply stops at the seam edge and you see two open arcs. Looks correct.

For a filled ring (Step 3) it matters completely. If a fragment needs to fill a corner, the corner point must be explicitly injected into the point array before serialising. SVG will then close through that corner correctly.

This is exactly the border-following waypoints described in markdown 07 — they are real injected points, not automatic.

## Does Step 2 Need Any Injection?

Yes, but only the **seam crossing endpoints** — the two interpolated points where the ring hits the map edge at az=0 or az=360. These are produced by the seam-cut function itself and are already part of Step 2.

For stroke-only, SVG's `Z` then draws a straight closing line between those two endpoints. Because both endpoints sit on the same vertical seam line (x=0 or x=360), that closing line runs cleanly along the map edge. It looks correct without any extra corner points.

The full **border-following waypoints** — the ones that route around a corner and across a map border for pole-enclosing shapes — are only needed when fill is added. A stroke-only shape closes fine with just the two seam endpoints. So yes: defer the corner injection to Step 3. Step 2 needs only what the seam-cut already produces.
