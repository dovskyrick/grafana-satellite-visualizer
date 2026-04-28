# Scenario 1 — Trajectory Breakdown for Implementation

## Overview: 4 Trajectories Total

**SAT-1 (primary, well-constrained)** — one trajectory.  
**SAT-2 (secondary, disputed)** — three alternative trajectory estimates: A, B, C.

---

## SAT-1
- Recent last-observation time: **TCA − 30 min**. Fresh tracking data, very small uncertainty ellipsoid throughout, grows only slightly toward TCA.
- Confidence: **high** (authoritative catalogue source).
- At TCA: reference object. Position defines the conjunction geometry.

## SAT-2 Trajectory A
- Last observed: **TCA − 3h**. Relatively old data.
- Confidence classification: **low** (foreign/unverified source, explicitly flagged).
- Uncertainty ellipsoid: **small** — looks precise, but the low confidence label means this precision is untrustworthy.
- At TCA: passes very close to SAT-1 — altitude difference of ~200 m, negligible lateral offset. Alarming geometry.

## SAT-2 Trajectory B
- Last observed: **TCA − 1h 30 min**. Moderate age.
- Confidence classification: **good** (trusted source).
- Uncertainty ellipsoid: **very large** — grows rapidly toward TCA, swallowing a huge volume. The spatial proximity is statistically meaningless.
- At TCA: nominal centre also close to SAT-1 (~500 m altitude difference), but the ellipsoid is so inflated that the conjunction could be anywhere within tens of kilometres.

## SAT-2 Trajectory C
- Last observed: **TCA − 45 min**. Recent data.
- Confidence classification: **good** (same trusted source family as B but fresher).
- Uncertainty ellipsoid: **moderate and well-constrained**, grows only slightly toward TCA.
- At TCA: clearly misses SAT-1 — altitude difference of ~5 km, or equivalently a lateral along-track offset large enough to exit the protected keep-out sphere. No conjunction concern.

---

## On the TCA Separation Geometry

Altitude-only differences are simpler to implement and visually legible in 3-D. A lateral (along-track or cross-track) offset at TCA is arguably more realistic because real conjunctions are usually characterised by miss distance vectors that have components in all three LVLH axes, not just radial. A practical compromise: use **primarily altitude (radial) separation** for A and C (simple, clear), and give trajectory B a small combined radial + along-track offset so the inflated ellipsoid still overlaps SAT-1 despite the centre being slightly further away. This adds realism without complicating the propagation logic significantly.
