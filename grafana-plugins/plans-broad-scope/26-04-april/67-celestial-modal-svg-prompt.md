# ChatGPT Prompt — Celestial Map View SVGs

## Prompt to paste into ChatGPT

---

I need two SVG illustrations for a space operations dashboard. They will appear side by side inside a dark modal card (background `#1e1e1e`, card background `rgba(40,40,40,0.98)`). Each SVG must be self-contained, inline-embeddable (no external dependencies), square, roughly 120×120 px viewBox.

**Design language:**
- Dark/transparent background (no white fill, use `fill="none"` or `fill="#1e1e1e"`)
- Stroke and shape colours should come from: white (`#ffffff`), soft blue (`#7eb8f7`), soft cyan (`#56cfe1`), and a subtle star-field feeling
- Clean, minimal, slightly technical/astronomical aesthetic
- No text inside the SVG

---

**SVG 1 — "90° View" (narrow field of view)**

Concept: a satellite (simple geometric body, small square or hexagon at centre) with a narrow cone/wedge projecting forward, representing a limited 90° field of view aimed at a patch of starfield. Suggest:
- A few small dot stars scattered around, mostly outside the cone
- The cone drawn with dashed or semi-transparent lines to look like a sensor frustum
- A subtle horizon arc or circular border hinting at the celestial sphere

**SVG 2 — "360° View" (full sky sphere)**

Concept: the same small satellite at the centre surrounded by a full circle/sphere of stars in all directions, representing omnidirectional sky coverage. Suggest:
- Stars evenly distributed all around the satellite in a circular arrangement
- A dashed great-circle ring (like a celestial equator) enclosing everything
- Possibly two orthogonal dashed arcs (RA/Dec grid lines) to reinforce the spherical coordinate feel
- The satellite at dead centre, slightly larger than in SVG 1

---

**Output format:** Return two separate clean SVG code blocks, ready to paste into a React JSX file as inline `<svg>` elements. Use only SVG primitives: `circle`, `line`, `path`, `polygon`, `rect`. No `<style>` blocks, no classes — use inline attributes only.

---
