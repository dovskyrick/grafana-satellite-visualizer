# Plan: Wire Ground Station List POV Buttons to GS POV Mode

## Goal

Clicking the **POV** button on a ground station row in the sidebar list should be equivalent to:
1. Selecting **Ground Station POV** from the mode dropdown (`setSelectedMode('groundstation')`)
2. Selecting that specific ground station (`setTrackedGroundStationId(gs.id)`)

Currently the button is a stub that only console.logs (SidebarControls.tsx lines 188-198).

---

## Why It Is Minimal (<=10 lines)

`setTrackedGroundStationId` is **already** a prop of `SidebarControls`.
`setSelectedMode` is **not yet** passed to `SidebarControls` - that is the only missing wire.
No new logic, effects, or helpers are needed; the existing useEffect in SatelliteVisualizer.tsx
(lines 609-683) already handles everything once those two setters are called.

---

## Changes Required

### 1. `controls/types.ts` - add one prop to `SidebarControlsProps` (+1 line)

Add to the SidebarControlsProps interface:

    setSelectedMode: (mode: 'satellite' | 'earth' | 'celestial' | 'groundstation') => void;

### 2. `SatelliteVisualizer.tsx` - pass the new prop to SidebarControls (+1 line)

Add inside the SidebarControls JSX element:

    setSelectedMode={setSelectedMode}

### 3. `SidebarControls.tsx` - destructure + replace stub onClick (~5 lines)

a. Destructure the new prop in the component signature (+1 line):

    setSelectedMode,

b. Replace the 3-line console.log stub on the POV button onClick:

    onClick={(e) => {
      e.stopPropagation();
      setTrackedGroundStationId(gs.id);
      setSelectedMode('groundstation');
    }}

---

## Total Diff

| File | Lines changed |
|------|--------------|
| controls/types.ts | +1 |
| SatelliteVisualizer.tsx | +1 |
| controls/SidebarControls.tsx | ~5 (replace 3-line stub + add destructure) |

<=8 net new/changed lines.

---

## Behaviour After the Change

- Clicking **POV** on any ground station row switches the mode to 'groundstation' and
  sets that station as the tracked GS - identical to picking "Ground Station POV" from the
  mode dropdown and then clicking the station row.
- The existing useEffect (lines 609-683) immediately flies the Cesium camera to the zenith
  above that station and activates the polar sky chart overlay; no new logic required.
- The sidebar **row click** (setTrackedGroundStationId only) continues to work unchanged for
  switching between stations while already in GS POV mode.

---

## Files to Edit

| File | Purpose |
|------|---------|
| src/components/controls/types.ts | Add setSelectedMode to SidebarControlsProps |
| src/components/SatelliteVisualizer.tsx | Pass setSelectedMode prop to SidebarControls |
| src/components/controls/SidebarControls.tsx | Destructure + use setSelectedMode in POV button handler |
