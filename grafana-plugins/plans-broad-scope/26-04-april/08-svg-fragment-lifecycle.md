# SVG Fragment Lifecycle — Creation, Fills, and Collapse

## The Good News: SVG Makes This Easy

SVG's `<path>` element supports **multiple subpaths inside a single `d` attribute**. A subpath begins with `M` (move-to) and ends implicitly when the next `M` appears or when `Z` closes it. This means one `<path>` element can carry two or three disconnected filled regions simultaneously, with a single `fill` color applied to all of them at once.

For a seam-cut FOV cone that produces two fragments, the `d` string looks like:

```
M x1 y1 L x2 y2 L x3 y3 Z   M x4 y4 L x5 y5 L x6 y6 Z
```

Two closed subpaths, one element, one fill, zero extra DOM nodes. SVG's even-odd or non-zero winding fill rules handle the rendering. No lifecycle management needed for the fragments themselves — they are just a string.

## Creation: Pure Computation, No DOM Work

The seam-cut algorithm runs in JavaScript and returns an array of point arrays (one per fragment). Each fragment is converted to an SVG path string. These strings are concatenated and assigned as the `d` prop of a React `<path>` element. On the next render the element is updated in-place. No mounting, no unmounting, no ref manipulation.

## Collapse: Also Free

When the satellite's FOV rotates so the cone no longer crosses the seam, the algorithm returns a single fragment. The `d` string becomes a single `M...Z` subpath. The same `<path>` element is updated. The second fragment simply disappears because it is no longer in the string. React diffs the prop, patches the DOM attribute. One operation.

When the FOV rotates to be completely off the map (elevation below the nadir edge), the algorithm returns an empty array, the `d` string is empty or omitted, and the element renders nothing. No explicit destroy call.

## Pole-Enclosing Transition

The only meaningful state transition is detecting when a fragment flips from "island" to "pole-enclosing." This is a conditional inside the seam-cut function — it changes which string gets generated. The SVG element itself does not change identity.

## Summary

One `<path>` per sensor. Its `d` prop is recomputed every `overlayClockTime` tick. All complexity — seam cuts, border following, fragment count — lives in a pure function that returns a string. SVG and React handle the rest.
