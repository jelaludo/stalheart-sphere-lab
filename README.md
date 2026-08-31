# STÅLHEART Sphere Laboratory

[Live sphere laboratory](https://jelaludo.github.io/stalheart-sphere-lab/)

A topology-first browser experiment for exploring a mostly hexagonal Stålberg-cut planetary grid. This project deliberately contains no game systems.

## Run

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite.

## What can be tuned live

- spherical macro-band count
- Stålberg micro-grid rings (the primary density control)
- probability for randomly dissolving non-conflicting triangle pairs into quads
- deterministic random seed
- organic tangential distortion
- spherical Laplacian relaxation passes and strength
- polar convergence for the merged-looking center of each six-cell crown
- cell inset, border opacity, and fill opacity
- filled cells, dual borders, primal triangulation, defects, and auto-rotation

Click any cell to inspect its ID, side count, neighbor count, pole classification, and adjacency list.

## Geometry notes

The source mesh is a wrapped six-sector surface built from triangle bands. Its dual has exactly six degree-five pentagons in the first collar and six in the last collar. Every other macro-cell is degree six. At each exact pole, a small non-degenerate degree-six epsilon cap gathers the inner boundaries of the six pentagons. Keeping this cap finite preserves the trivalent manifold and all five distinct neighbors of every crown cell; collapsing it to a literal zero-area point would not.

Every macro-cell receives a real generalized Stålberg patch. It creates concentric polygon rings, combines them into triangle bands, randomly dissolves non-conflicting triangle pairs, subdivides remaining triangles into three quads, subdivides dissolved quads into four quads, and performs Laplacian relaxation while keeping shared boundary samples fixed. Ordinary patches have six sectors; the twelve crown adapters use their irregular boundary count.

Macro-corners and edge samples are cached globally by canonical topology IDs. Neighboring patches therefore use the same boundary objects in reverse order rather than independently approximating their borders.

## Validation

```powershell
npm test
npm run build
```

The automated matrix checks both macro and final micro-grid Euler characteristic, two-face/two-quad incidence for every edge, exact 6 + 6 degree-five pentagons, two finite degree-six epsilon caps, one micro-patch per macro-cell, twelve polar adapters, canonical shared boundary and subdivision samples, triangle/quad subdivision accounting, deterministic generation, non-zero edges, and finite geometry across band/ring/seed combinations.

Reference: https://github.com/MarcusElg/GodotStalbergGrid (MIT)
