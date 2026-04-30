# Top Buttons Overlap When Sidebar Opens — Fix Plan

## Root cause

All top controls (Mode, Camera, Axes dropdowns and the new 90°/360° toggle) are `position: absolute` inside `mainContent`. When the sidebar opens, `mainContent` flexes narrower. The left-anchored buttons stay at `left: 10px` and the centred toggle uses `left: 50%; transform: translateX(-50%)` — both relative to the shrinking container. At narrow widths they collide.

---

## What needs to be done

**Option A — flex row (recommended)**
Remove `position: absolute` from both control groups. Instead, give `mainContent` a normal-flow flex overlay row at the top — `position: absolute; top: 10px; left: 10px; right: 10px; display: flex; align-items: center; justify-content: space-between; pointer-events: none` with children opting back in via `pointer-events: auto`. The left group sits naturally on the left, the 90°/360° pill sits in the centre via `margin: auto`, and they compress gracefully as the container shrinks without overlap.

**Option B — sidebar-aware offset**
Keep absolute positioning but pass `isSidebarOpen` as a prop and adjust `right` offset of the centred toggle: `right: isSidebarOpen ? 330px : 0`. Simpler but fragile — tied to the sidebar's pixel width.

---

## Preferred fix
Option A. It makes all top controls responsive to container width automatically with no hard-coded pixel values, and handles future additions without revisiting each button's position.
