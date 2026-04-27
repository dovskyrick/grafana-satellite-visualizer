# Collision Scenario Generation and ITRF Coordinate Frame

---

## Problem 1: Semi-Realistic Collision Risk Orbits

### The Backward Propagation Idea

Your intuition is correct and very workable. Keplerian orbital mechanics is time-reversible: if you negate the time parameter in the equations of motion, you get an equally valid orbit. The current `generateCircularOrbit` function steps forward in time using `t = (i / (numPoints - 1)) * duration`. To propagate backwards you simply negate `t` — the satellite traces the same ellipse in the opposite direction.

The workflow becomes:

1. **Define TCA** — set it to `now` (or `now + 1h` etc.). Choose two orbits whose Keplerian elements place both satellites at nearly the same position when `anomaly = startAnomaly` and `t = 0`. A practical choice is two orbits sharing nearly the same inclination and LOAN but with a small angular separation in mean anomaly (a few tenths of a degree) and a small altitude difference (1–2 km). This makes them kissing-close at TCA without being identical.

2. **Forward arc** — propagate `t ∈ [0, +3h]` from TCA normally. The satellites move apart along their natural Keplerian paths.

3. **Backward arc** — propagate `t ∈ [0, +3h]` with the time sign negated (i.e. `meanAnomaly = startAnomalyRad − (t / period) * TWO_PI`). This gives positions for the 3 hours before TCA. Assign timestamps `TCA − t` to each point and sort ascending.

4. **Concatenate** — join backward arc (chronological) + forward arc to get a full 6-hour window centered on TCA.

In code terms the change is small: add a `direction: 1 | -1` flag to `OrbitParams` and multiply the anomaly step by it. The existing `generateCircularOrbit` needs no other modification.

### Choosing Elements for a Near Miss

For scenario 1 you need satellite A (well-constrained) and satellites B/C/D (alternative estimates). A simple recipe: give all four the same inclination and LOAN. Place satellite A at mean anomaly 0°. Place B at 0.2°, C at 0.4°, D at −0.3° offset. Vary the altitude by ±1–2 km per satellite. At TCA the closest pair will be within a few kilometres depending on the orbital radius (~6920 km at 550 km altitude).

This approach requires no numerical optimiser. The uncertainty ellipsoids, confidence flags, and the three candidate trajectories for satellite 2 are all just additional data fields on top of the same backward-forward Keplerian propagation.

---

## Problem 2: ICRF vs ITRF — Making the Earth Rotate

### The Current State

The existing `generateCircularOrbit` computes longitude as:

```
longitude = atan2(yFinal, xFinal)
```

This is the right ascension in the ECI (Earth-Centred Inertial, close to ICRF) frame. Earth's surface is not attached to this frame. Cesium, when given lon/lat directly, plots the point on the rotating Earth, so an ECI longitude fed to Cesium actually implies a fixed geographic location — the orbit appears to drift eastward on the sky rather than the ground drifting westward beneath it.

### Option A — GMST Rotation (Recommended, Minimal Change)

Convert each point's ECI longitude to ECEF by subtracting the Greenwich Mean Sidereal Time (GMST) at that point's timestamp:

```
θ_GMST(t) = θ_GMST(J2000) + ω_Earth × (t − J2000)
```

where `ω_Earth ≈ 7.2921150 × 10⁻⁵ rad/s` (Earth's sidereal rotation rate). In practice:

```
longitudeECEF = longitudeECI − θ_GMST(t)   (wrapped to [−180, 180])
```

This is a one-liner addition inside the loop and requires no new dependencies. The result is geographically correct ground tracks that drift ~22.5° westward per orbit (for a 90-minute orbit), exactly as seen in real TLE-based tools. Latitude is unaffected by Earth's rotation.

### Option B — Use the `satellite.js` Library

The `satellite.js` npm package implements the full SGP4 propagator and includes a correct ECI-to-ECEF conversion (`eciToGeodetic`). Plugging in SGP4 would give physically accurate orbital perturbations (J2 oblateness, atmospheric drag) but requires defining TLE-format inputs and is a larger refactor. Worth considering if realism beyond Keplerian is needed, but overkill for the scenario-1 mockup.

### Option C — Pass ECI Cartesian and Let Cesium Handle It

Cesium's `Cartesian3` with `ReferenceFrame.INERTIAL` tells Cesium to interpret coordinates in an inertial frame and apply the correct Earth rotation internally when rendering. This would mean switching the data format from lon/lat to XYZ ECI and changing how the Cesium plugin ingests positions. It is the most architecturally correct option but touches both the server and the plugin.

### Recommendation

Start with **Option A** — add the GMST subtraction inside `generateCircularOrbit`. It is a four-line change, requires no new packages, and immediately produces realistic drifting ground tracks. If later the project moves to SGP4 or full-fidelity propagation, the GMST approach is compatible: the same rotation still applies.
