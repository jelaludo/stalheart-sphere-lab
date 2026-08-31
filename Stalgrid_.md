# PoC Build Spec: Stålberg-Style Organic Hex Grid on a Sphere

## Goal

Build a **browser-based proof of concept** that demonstrates a mostly-hexagonal spherical world grid with these properties:

1. The sphere is tiled predominantly by cells with **6 neighbors**.
2. The unavoidable spherical topology defects are concentrated into:
   - **6 irregular cells around the North Pole**
   - **6 irregular cells around the South Pole**
3. The 6 irregular cells at each pole must have their **inner polar vertices collapsed/merged visually into a single apparent pole area**, so each pole looks like one special region even though the underlying topology remains mathematically valid.
4. All non-polar regions should be visually transformed using a Stålberg-inspired generation process:
   - begin from a regular hexagonal lattice / equivalent dual mesh structure;
   - organize the base surface as triangle bands;
   - randomly dissolve selected triangle pairs into quads;
   - subdivide remaining triangles;
   - subdivide quads;
   - perform iterative point relaxation / Laplacian smoothing;
   - reconstruct the resulting polygonal cell network so lines still join exactly and the full sphere remains watertight.
5. The result must be viewable interactively in a normal desktop browser.

This is a **geometry/topology PoC**, not a production game system.

---

## Important Mathematical Constraint

A sphere cannot be tiled entirely by ordinary 6-neighbor hexagons while preserving a normal manifold topology.

Use the standard spherical defect relation:

```text
sum(6 - number_of_sides(cell)) = 12
```

For this PoC, satisfy the defect budget with exactly **12 pentagonal-equivalent defects**, grouped as:

```text
North Pole: 6 defect cells
South Pole: 6 defect cells
```

The visual presentation may merge the inner vertices of each group so they appear to form one special pole region, but **do not destroy the underlying manifold connectivity**.

Do not fake the sphere as a wrapped cylinder with duplicated pole adjacency for this version.

---

## Desired Technical Direction

Prefer a simple browser stack:

- HTML
- JavaScript or TypeScript
- WebGL through **Three.js** is acceptable and preferred for speed of implementation
- minimal CSS
- no backend
- no Godot
- no game engine

Use Vite only if useful. A plain static HTML + JS implementation is also acceptable.

The PoC should run with something like:

```bash
npm install
npm run dev
```

or, if dependency-free except for a CDN library:

```bash
python -m http.server
```

Prefer the smallest reasonable setup.

---

# Recommended Geometry Strategy

## 1. Start from an Icosahedral Sphere

Use an icosahedron as the topological seed because it naturally distributes the 12 required spherical defects.

Suggested construction:

1. Create an icosahedron.
2. Subdivide each triangular face to a configurable frequency.
3. Project every new vertex onto the unit sphere.
4. Build the dual polygon mesh:
   - each vertex of the triangulated icosphere becomes one polygonal cell;
   - cells corresponding to the 12 original icosahedron vertices are pentagons;
   - most other cells become hexagons.

This gives a Goldberg/geodesic-style sphere with:

```text
12 pentagons + N hexagons
```

Then rotate/orient the construction so:

- 6 of the 12 pentagonal defects are clustered into a northern polar zone;
- 6 are clustered into a southern polar zone.

If a standard icosahedral dual does not naturally place them as clean 6+6 polar crowns, modify the construction or remesh locally so that the final topology does.

The final result must visibly read as:

```text
[NORTH POLAR CROWN: 6 irregular cells]
[mostly hexagonal world]
[SOUTH POLAR CROWN: 6 irregular cells]
```

Do not silently fall back to 12 evenly scattered pentagons.

---

# Polar Crown Requirement

Each pole consists of exactly **6 irregular cells**.

These six cells should meet at or immediately around one polar location.

## Visual merging rule

The six innermost pole-facing vertices may be moved to the same or nearly the same 3D position so the center of the crown visually becomes one unified pole.

However:

- preserve separate cell identities;
- preserve valid face winding;
- avoid zero-area faces;
- avoid overlapping face interiors;
- avoid non-manifold edges;
- avoid duplicate coincident edges that break rendering;
- if exact vertex coincidence causes geometric degeneracy, use a tiny configurable polar cap radius instead.

Recommended implementation:

```text
polarCapRadius = epsilon
```

where epsilon is small enough that the six inner vertices visually appear merged from normal viewing distance.

Expose epsilon as a debug parameter.

---

# Stålberg-Inspired Organic Cell Process

The point of the PoC is not merely to display a Goldberg sphere. The non-polar surface should gain an organic Stålberg-like subdivision character.

Implement a reproducible approximation of the following process.

## Base conceptual process

```text
Generate a hexagon grid of vertices
→ combine vertices into bands of triangles
→ randomly dissolve compatible triangle pairs into quads
→ subdivide triangles that remain
→ subdivide quads
→ run repeated point relaxation
→ reconstruct cells / line network
```

On the sphere, adapt this process to the triangular primal mesh before taking or reconstructing the dual.

---

## Suggested spherical adaptation

### A. Work primarily on the primal triangular mesh

Maintain a valid triangulated manifold sphere as the structural source of truth.

The dual cells are derived from this primal mesh.

This is preferable to directly deforming arbitrary polygons because it makes watertight connectivity easier to preserve.

### B. Mark eligible neighboring triangle pairs

For triangle pairs sharing an edge:

- randomly select some non-conflicting pairs;
- treat each selected pair as a temporary quad;
- do not allow a triangle to belong to more than one quad;
- avoid pairing across polar crown boundaries unless explicitly handled.

Use a seeded PRNG so results are reproducible.

Example parameter:

```text
quadDissolveProbability = 0.35
seed = 12345
```

### C. Subdivide triangles

For each remaining triangle:

- generate edge midpoints;
- generate a center point if necessary;
- subdivide consistently so neighboring faces share exactly the same edge vertices.

Never generate duplicate midpoint vertices independently per face.

Use a shared edge map keyed by sorted vertex IDs.

### D. Subdivide quads

For each temporary quad:

- generate shared edge midpoints;
- generate one quad center;
- split into a regular sub-layout that remains compatible with surrounding triangle subdivisions.

The important result is not a specific canonical subdivision pattern; the important result is:

- globally shared vertices;
- no T-junctions;
- no cracks;
- consistent connectivity.

### E. Project to sphere

After subdivision, normalize every non-special vertex:

```text
p = normalize(p)
```

so all points remain on the unit sphere.

### F. Relaxation

Perform multiple iterations of tangent-space Laplacian smoothing.

For each movable vertex:

1. average neighboring vertex positions;
2. compute the displacement toward the average;
3. remove the radial component so movement occurs approximately in the local tangent plane;
4. apply a relaxation strength;
5. renormalize back onto the sphere.

Pseudo-formula:

```text
avg = average(neighborPositions)
delta = avg - p
normal = normalize(p)
tangentDelta = delta - normal * dot(delta, normal)
p2 = normalize(p + tangentDelta * relaxationStrength)
```

Recommended defaults:

```text
relaxationIterations = 20
relaxationStrength = 0.35
```

The polar cap anchor vertices should either:

- remain fixed; or
- have strongly reduced mobility.

The boundary ring around each polar crown may be partially constrained to preserve the 6-cell crown structure.

---

# Reconstructing the Visible Cells

After generating and relaxing the primal mesh, derive a dual polygon mesh.

For each primal vertex:

1. gather incident triangular faces;
2. compute a representative point for each face:
   - spherical circumcenter, or
   - normalized face centroid;
3. sort these representative points around the primal vertex;
4. connect them to form one polygonal dual cell.

This should produce:

- mostly hexagonal dual cells;
- exactly 12 defect cells total;
- with 6 defects forming the North polar crown;
- with 6 defects forming the South polar crown.

The visible polygon mesh must share boundary coordinates exactly between neighboring cells.

Do not independently draw each cell with approximate borders.

---

# Rendering Requirements

Render the result as a clean technical visualization.

## Required view modes

Add UI toggles for:

### 1. Filled cells

- light neutral cell fill
- thin dark border lines
- polar defect cells highlighted distinctly

### 2. Wireframe / topology

Show only polygon edges.

### 3. Primal mesh

Show the underlying triangulated mesh used to derive the cells.

### 4. Defect visualization

Color or otherwise highlight:

- normal 6-sided cells;
- north polar 6-cell crown;
- south polar 6-cell crown.

### 5. Neighbor-count debug mode

Display or inspect each cell's:

```text
cell ID
number of sides
number of neighboring cells
```

Clicking a cell should show this data in a small debug panel.

---

# Camera and Interaction

Provide:

- orbit rotation
- zoom
- optional auto-rotate toggle
- reset camera button

Three.js OrbitControls is acceptable.

Start with the sphere framed so both curvature and cell structure are obvious.

---

# Parameters Exposed in UI

Provide simple controls for:

```text
subdivision frequency
random seed
quad dissolve probability
relaxation iterations
relaxation strength
polar cap epsilon / radius
show primal mesh
show dual mesh
show defect cells
```

Changing major topology parameters may regenerate the entire sphere.

A "Regenerate" button is acceptable.

---

# Required Debug / Validation Checks

The PoC should compute and display validation results.

## Topology checks

Verify:

```text
V - E + F = 2
```

for the final closed spherical mesh where applicable.

Verify:

- no boundary edges;
- every edge belongs to exactly 2 faces;
- no duplicate faces;
- no zero-area triangles;
- no NaN coordinates.

## Dual cell checks

Report:

```text
total cells
hexagon count
pentagon / irregular count
north polar irregular count
south polar irregular count
min neighbor count
max neighbor count
```

Target:

```text
irregular count = 12
north polar irregular count = 6
south polar irregular count = 6
```

If the final organic remeshing changes exact polygon side counts, preserve the equivalent topological defect accounting and clearly report the result.

Do not hide topology failures.

---

# Important Visual Goal

The result should **not** look like a pristine geodesic soccer ball.

The non-polar regions should have a subtly irregular, hand-shaped, game-map appearance inspired by Oskar Stålberg-style organic grid generation:

- slightly uneven polygon shapes;
- relaxed, flowing borders;
- no obvious lat-long grid;
- no obvious UV seam;
- locally coherent tile sizes;
- all neighboring borders exactly matched;
- enough irregularity to feel procedural rather than mechanically perfect.

The sphere should still remain readable as a tiled game world.

---

# Polar Visual Design

The two poles are deliberate world landmarks.

Make them clearly special.

Preferred appearance:

```text
six irregular cells arranged as a crown
→ their inner vertices converge into one tiny shared polar region
→ from normal zoom level the crown reads as one unified special zone
```

Optionally draw a subtle ring around the entire 6-cell crown to demonstrate how a game could treat the six cells as one logical "World Pole" region.

Do not replace the 6 cells with one giant non-manifold super-cell.

---

# Architecture

Keep the implementation understandable and modular.

Suggested modules:

```text
src/
  main.js
  geometry/
    icosphere.js
    topology.js
    subdivision.js
    relaxation.js
    dual.js
    polarCrowns.js
    validation.js
  render/
    scene.js
    meshView.js
    debugView.js
  ui/
    controls.js
```

Equivalent organization is fine.

Avoid overengineering.

---

# Data Structures

Prefer indexed topology structures.

Example:

```js
Vertex {
  id,
  position,
  neighbors: Set<vertexId>
}

Triangle {
  id,
  vertices: [a, b, c]
}

DualCell {
  id,
  sourceVertexId,
  polygonVertices: [...],
  neighbors: [...],
  sideCount,
  isPolarDefect,
  pole: null | 'north' | 'south'
}
```

Use globally shared vertex IDs.

Do not rely solely on floating-point coordinate matching to determine adjacency.

---

# Seeded Randomness

All random triangle-pair dissolves and any procedural perturbations must use a deterministic seeded PRNG.

The same input seed + same parameters must generate the same mesh.

---

# Performance Target

This is a PoC.

Target smooth interaction for roughly:

```text
500–5,000 visible cells
```

It is acceptable if regeneration takes noticeable but reasonable time at the high end.

Correct topology is more important than optimization.

---

# Deliverables

Create a complete runnable project containing:

1. source code;
2. `README.md` with exact run instructions;
3. browser visualization;
4. interactive parameter controls;
5. validation/debug panel;
6. clear code comments around:
   - defect topology;
   - 6+6 polar crown construction;
   - spherical relaxation;
   - primal-to-dual conversion;
   - Stålberg-inspired triangle/quad subdivision.

---

# Acceptance Criteria

The PoC is successful if all of the following are true:

- [ ] Browser renders a complete sphere.
- [ ] There is no visible seam.
- [ ] The sphere is a closed manifold.
- [ ] Most visible cells are 6-sided / 6-neighbor cells.
- [ ] Exactly 12 topological defect cells exist.
- [ ] Exactly 6 defect cells form the North polar crown.
- [ ] Exactly 6 defect cells form the South polar crown.
- [ ] The six cells at each pole visually converge toward one merged-looking pole region.
- [ ] The two pole regions remain composed of six distinct valid cells internally.
- [ ] Non-polar cells have organic Stålberg-like variation.
- [ ] Shared borders line up exactly.
- [ ] Relaxation does not create cracks or non-manifold geometry.
- [ ] Seeded generation is reproducible.
- [ ] Clicking a tile exposes its side count and neighbor count.
- [ ] Debug mode can display primal triangulation and dual polygons.
- [ ] Euler/topology validation is shown in the UI or console.

---

# Suggested Development Order

Implement in this order and keep the application runnable after every stage.

## Milestone 1 — Valid spherical topology

Create:

- triangulated sphere;
- adjacency tables;
- validation;
- simple rendering.

## Milestone 2 — Dual cells

Generate visible polygon cells and verify the defect counts.

## Milestone 3 — 6+6 polar crowns

Reorient or locally reconstruct the defect topology so all 12 defects are grouped into two crowns.

Do not proceed until validation passes.

## Milestone 4 — Polar merge appearance

Move/constrain inner polar vertices so each six-cell crown visually reads as one pole.

## Milestone 5 — Stålberg-inspired subdivision

Add deterministic triangle pairing, temporary quads, and compatible triangle/quad subdivision.

## Milestone 6 — Spherical relaxation

Add tangent-space Laplacian smoothing while preserving sphere projection and polar constraints.

## Milestone 7 — UI / inspection

Add controls, click inspection, topology overlays, and debug statistics.

## Milestone 8 — Cleanup

Improve rendering, documentation, and parameter defaults.

---

# Implementation Philosophy

When there is a conflict between visual resemblance and topology correctness:

```text
topology correctness wins
```

When there is a conflict between a mathematically elegant generalized solution and a simple PoC-specific implementation:

```text
prefer the simpler implementation
```

provided the acceptance criteria remain true.

Do not spend time building production abstractions, asset pipelines, persistence, networking, gameplay systems, or editor tooling.

The purpose is to answer one question convincingly:

> Can a spherical game world be built from a mostly 6-neighbor organic Stålberg-style grid, while concentrating all unavoidable spherical irregularities into two visually unified 6-cell polar crowns?

The browser PoC should make the answer visually and mathematically inspectable.
