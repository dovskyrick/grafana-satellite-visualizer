# Ellipsoid Principal Axis Label

## The Problem

When viewing an ellipsoid in the 3D scene there is currently no spatial reference whatsoever. The user sees a shape floating in space but has no way to intuit whether it represents a 200 m cloud of debris or a 2000 km confidence region. Without context the visualization communicates shape but not scale, which is arguably the more operationally important dimension.

## Why a Single Number Is the Right Choice

Showing all three semi-axis values simultaneously would require three labels anchored to three tips. With camera rotation those labels would overlap, swap depth order, and generally create visual noise that distracts from the shape itself. A single number removes all of that ambiguity while still delivering the most useful piece of information: the overall size of the object. The principal axis is the natural candidate because it is the largest dimension, the one the eye naturally reads as "how big is this thing", and it is the axis that most directly relates to the dominant uncertainty direction for typical covariance ellipsoids.

## Label Position at the Principal Axis Tip

Anchoring the label at the tip of the principal semi-axis is an elegant choice for two reasons. First it creates an implicit visual arrow: the user's eye travels from the label inward along the axis, arriving at the center, and immediately understands that the displayed number is the half-length of that specific axis. Second, in 3D scenes labels positioned at geometry extremities tend to avoid occluding the body itself, keeping the shape readable at all times. The one edge case worth noting is that as the camera rotates the tip may move behind the ellipsoid. A small dot or tick mark at the tip, rendered on top of the geometry, can keep the anchor point visible and reinforce the connection between the number and the axis.

## Units and Formatting

Starting with km-only output is the right pragmatic call. For the vast majority of space situational awareness and orbital mechanics use cases the numbers will be in the tens to thousands of kilometres range, so km is always meaningful. When the implementation matures, an auto-scaling formatter that switches to m below 1 km and to km above it, zero-padding to a consistent number of significant figures, is straightforward to add. A clean format like `412 km` or `0.85 km` reads naturally; avoid excessive decimal places since the label is decorative-informational rather than a data readout.

## Implementation Sketch

A CSS2DObject (Three.js) or a Cesium label entity attached to the world-space position of the principal axis tip is the lightest possible implementation. The label recomputes only when the ellipsoid data changes, not every frame, so performance cost is negligible. The text content is derived from the largest of the three semi-axis values already stored in the ellipsoid data model, converted to km and rounded to two or three significant figures.

## Open Questions

- Should the label always face the camera (billboard) or be fixed in scene space? Billboard is almost always preferable for readability.
- Should the label hide when the tip is occluded by the ellipsoid body, or always show? Always-show is simpler and probably fine at first.
- Does the label need to respect the same opacity/visibility controls as the ellipsoid itself? Almost certainly yes.
