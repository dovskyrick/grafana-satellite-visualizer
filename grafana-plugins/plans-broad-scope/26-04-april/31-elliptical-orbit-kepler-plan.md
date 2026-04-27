# Elliptical Orbit Support via Kepler's Equation

**Difficulty: 3/10** — pure math, no libraries, ~25 lines added.

---

## The Physics

An elliptical orbit has two parameters beyond altitude: **semi-major axis `a`** and **eccentricity `e`** (0 = circle, >0 = ellipse). The satellite moves fastest at **periapsis** (closest point, `r_p = a(1−e)`) and slowest at **apoapsis** (farthest point, `r_a = a(1+e)`). This is Kepler's Second Law — equal areas in equal times.

For scenario 1, SAT-BETA's periapsis is placed at the TCA point (anomaly = 0°). If periapsis altitude = 550 km to match SAT-ALPHA at TCA, and eccentricity = 0.1:

- `a = 6921 / 0.9 ≈ 7690 km`
- Apoapsis altitude ≈ 1090 km
- Period ≈ 112 min vs SAT-ALPHA's ≈ 96 min

After one orbit they are already ~16 minutes out of phase at the node — separated by hundreds of kilometres. The accidental re-conjunctions disappear.

## Code Changes (`orbit-math.ts`)

**1. Add `eccentricity?: number` to `OrbitParams`** (default 0, backward-compatible).

**2. Add a Kepler solver** — Newton–Raphson, converges in 4–5 iterations:
```
function solveKepler(M, e):
  E = M
  repeat: E = E - (E - e·sin(E) - M) / (1 - e·cos(E))
```

**3. Replace the position formula** inside the loop:
- Compute eccentric anomaly `E` from mean anomaly `M` via solver
- `x_orb = a·(cos(E) − e)`, `y_orb = a·√(1−e²)·sin(E)` (in orbital plane, units = km)
- Normalise to unit vector for the inclination/LOAN rotations (same as current code)
- Actual radius `r = a·(1 − e·cos(E))` → altitude = `r − R_Earth`

The inclination and LOAN rotation matrices are unchanged. Only the radius becomes variable. The `timeDirection` and `reverseTime` flags work identically on top.

## In `server.ts`

SAT-BETA gets `eccentricity: 0.1`. SAT-ALPHA stays at `eccentricity: 0` (circular). No other changes needed.
