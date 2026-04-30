# Celestial Map Welcome Modal

## Goal
A one-time modal that appears when the user first enters Celestial Map mode, explaining what they are looking at and letting them choose their preferred view before anything renders.

---

## Persistence — `localStorage`
Store a single flag `celestial_map_welcomed: "true"` in `localStorage`. On every mode switch to `'celestial'`, check for this key. If absent, open the modal. On confirm, write the key and never show again — survives page refreshes and browser restarts, cleared only if the user clears site data.

---

## Modal Content

**Headline (≤ 15 words):**
> "Celestial Map shows the sky as seen from your satellite's position."

**Two large side-by-side buttons, each with:**
- An SVG illustration (user-supplied or generated)
- A bold label: **90° View** / **360° View**
- A one-line sub-caption

| Button | Caption |
|--------|---------|
| 90° View | "Pointed narrow field — track a star or sensor target" |
| 360° View | "Full sky sphere — see everything around the satellite" |

Clicking either button sets `celestialCameraView` to the chosen value, writes the localStorage flag, and closes the modal.

---

## Implementation Sketch

1. **New component** `CelestialWelcomeModal.tsx` — pure presentational, receives `onSelect(view)` and `onDismiss` props.
2. **State in `SatelliteVisualizer`** — `const [showCelestialModal, setShowCelestialModal] = useState(false)`.
3. **Trigger** — inside the `useEffect` that watches `selectedMode`: when mode becomes `'celestial'`, check `localStorage.getItem('celestial_map_welcomed')`; if null, `setShowCelestialModal(true)`.
4. **On select** — call `setCelestialCameraView(view)`, `localStorage.setItem('celestial_map_welcomed', 'true')`, `setShowCelestialModal(false)`.
5. **SVG slots** — two `<div className={styles.modalViewOption}>` containers ready to receive a `<svg>` dropped in later; placeholder outlines shown until then.

---

## Styling
Semi-transparent dark overlay (`rgba(0,0,0,0.7)`) over the Cesium canvas. Modal card centred, ~480 px wide, matching the existing dark panel aesthetic. Buttons are large (`~200×180 px`) with hover highlight border.
