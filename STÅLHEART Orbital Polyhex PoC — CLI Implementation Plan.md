# STÅLHEART Orbital Polyhex PoC — CLI Implementation Plan

## 1. Goal

Build a playable proof-of-concept demonstrating the core mechanic:

- A mostly-hexagonal spherical grid represents the planet.
- A polyhex construction piece approaches from a fixed orbital direction.
- A red projected landing trace shows where the piece will land.
- The player rotates the planet beneath the incoming piece.
- The player may rotate the piece in 60° increments.
- When dropped, the piece snaps onto valid cells.
- Occupied cells block future placements.
- A small number of exceptional non-hex cells act as special sockets.
- Occasionally a unique special piece appears and only fits one class of socket.

The PoC should answer one question:

> Is rotating a spherical battlefield underneath a falling geometric piece intuitive and fun?

Do not build tower defense, enemies, economy, progression, procedural planets, multiplayer, or final art.

---

# 2. Recommended Technical Stack

Use:

- Engine: Godot 4.x
- Language: GDScript
- Rendering: Godot 3D
- Development style: command-line-first project generation and launch
- Source control: Git

Why Godot:

- Fast iteration
- Simple scene graph
- Easy mesh generation
- Easy raycasting
- Lightweight project
- Good CLI support
- No need for a heavyweight Unity setup for this PoC

CLI assumptions:

```bash
godot --editor .
godot --path . --editor
godot --path .
```

For headless tests:

```bash
godot --headless --path . --script res://tests/run_tests.gd
```

---

# 3. Core Design Principle

Do not simulate literal gravitational falling around a sphere.

Instead:

- Keep the incoming piece in a fixed camera/orbital frame.
- Rotate the planet.
- Project the piece toward the planet center along a fixed drop vector.
- Determine which surface cells lie underneath the projected footprint.

Conceptually:

```text
             PIECE
               ↓
               ↓  fixed orbital drop vector
               ↓
          [red projection]

             sphere
         player rotates it
```

This makes input understandable and simplifies the implementation enormously.

---

# 4. Sphere Topology

## 4.1 Do Not Start With Arbitrary Hexagons

A sphere cannot be tiled purely with regular hexagons.

For the PoC use a geodesic-style topology containing:

- predominantly hexagonal cells
- exactly 12 pentagonal defect cells

This is ideal because the geometry problem becomes gameplay.

---

# 5. Grid Representation

Represent each surface cell as data rather than relying on mesh geometry alone.

Each cell:

```gdscript
class_name PlanetCell

var id: int
var center: Vector3
var normal: Vector3
var neighbors: Array[int]
var cell_type: String
var occupied: bool
var occupant_id: int
```

Possible `cell_type` values:

```text
HEX
PENTAGON
SPECIAL
```

For PoC:

```text
HEX = normal playable cell
PENTAGON = reserved defect/socket
```

---

# 6. Generating the Spherical Grid

Use an icosphere as the starting point.

Pipeline:

```text
Icosahedron
    ↓
subdivide triangles
    ↓
normalize vertices onto sphere
    ↓
construct dual mesh
    ↓
each original vertex becomes a polygonal cell
```

The dual of a subdivided icosahedron naturally produces:

- mostly hexagons
- 12 pentagons

This is exactly what is needed.

Suggested subdivision level for PoC:

```text
frequency 4–6
```

Target approximately:

```text
150–400 playable cells
```

Enough to feel planetary without creating visual clutter.

---

# 7. Dual Mesh Construction

Implement a script:

```text
scripts/grid/geodesic_grid.gd
```

Responsibilities:

```text
generate_icosphere()
subdivide_mesh()
normalize_vertices()
build_adjacency()
build_dual_cells()
identify_pentagons()
```

For every vertex in the triangular sphere mesh:

1. Find all triangles touching that vertex.
2. Compute the center of each triangle.
3. Sort triangle centers around the vertex.
4. These centers form the polygon of the dual cell.
5. Store the vertex-normal direction as the cell center.

Expected result:

```text
12 cells with 5 neighbors
all remaining cells with 6 neighbors
```

Add a startup assertion:

```gdscript
assert(pentagon_count == 12)
```

---

# 8. Planet Scene

Create:

```text
scenes/planet/planet.tscn
```

Structure:

```text
Planet
├── GridMesh
├── CellHighlightLayer
├── PlacementLayer
├── CollisionSphere
└── DebugOverlay
```

Planet rotates as one object.

Do not rotate the camera for the main control scheme.

---

# 9. Camera

Use a fixed orbital camera.

Suggested setup:

```text
Camera distance: 2.5–3 planet radii
FOV: 35–50 degrees
LookAt: planet center
```

Camera should remain stable while the sphere rotates.

Optional very subtle camera damping later.

---

# 10. Planet Rotation Controls

Keyboard first.

Suggested controls:

```text
W / S = rotate planet north/south
A / D = rotate planet east/west
Q / E = roll planet
```

For the first PoC, Q/E may not be necessary.

Mouse option:

```text
LMB drag = rotate planet like trackball
```

Implement keyboard first because it is easier to test deterministically.

Rotation should be continuous rather than cell-by-cell.

Example:

```gdscript
rotation_speed = 0.7 radians/sec
```

Apply quaternion rotation rather than accumulating Euler angles.

---

# 11. Incoming Piece Representation

A piece is defined topologically, not as a prebuilt mesh.

Example:

```gdscript
class_name PolyhexPiece

var cells: Array[Vector2i]
var rotations: int = 6
var piece_type: String
```

Example monomino:

```text
[(0,0)]
```

Domino:

```text
[(0,0), (1,0)]
```

Trihex line:

```text
[(0,0), (1,0), (2,0)]
```

Trihex bent:

```text
[(0,0), (1,0), (0,1)]
```

Use axial hex coordinates:

```text
(q, r)
```

Rotation formula:

```text
(q, r) -> (-r, q+r)
```

Repeat six times for the six orientations.

---

# 12. Initial Piece Set

Keep the first version tiny.

Implement:

```text
1-cell
2-cell straight
3-cell straight
3-cell bent
4-cell compact
4-cell hook
```

Do not implement the full universe of polyhexes initially.

The point is testing manipulation, not content breadth.

---

# 13. Orbital Piece Scene

Create:

```text
scenes/pieces/orbital_piece.tscn
```

Structure:

```text
OrbitalPiece
├── PieceMesh
├── GhostProjection
├── LaserTrace
├── ThrusterSmoke
└── InvalidIndicator
```

Keep it visually abstract.

For the PoC:

- Piece itself = simple emissive blocks or plates
- Valid projection = translucent cyan/white
- Invalid projection = red
- Laser = red line
- Smoke = simple particle system

No need for detailed futuristic geometry yet.

---

# 14. Landing Projection

This is the most important system in the PoC.

The piece occupies a 2D hex arrangement in an orbital tangent plane.

For each local piece cell:

1. Create a world-space sample point in the piece plane.
2. Project a ray toward the planet center.
3. Find the intersection with the planet sphere.
4. Convert the hit direction to the closest grid cell.
5. Build the candidate landing set.

Pseudo:

```gdscript
for local_hex in current_piece.cells:
    var sample = piece_basis * axial_to_plane(local_hex)
    var world_pos = orbital_origin + sample

    var ray_dir = -world_pos.normalized()

    var hit = ray_sphere_intersection(world_pos, ray_dir)

    var cell_id = grid.closest_cell(hit.normalized())
```

If:

```text
number of unique cell IDs != number of piece cells
```

then placement is invalid.

This catches cases where spherical distortion causes multiple projected cells to collapse onto one target.

---

# 15. Nearest Cell Lookup

For a small grid, brute force is fine.

```gdscript
func closest_cell(direction: Vector3) -> int:
    var best_dot = -INF
    var best_id = -1

    for cell in cells:
        var d = direction.dot(cell.normal)

        if d > best_dot:
            best_dot = d
            best_id = cell.id

    return best_id
```

With 200–400 cells this is trivial computationally.

Do not optimize prematurely.

---

# 16. Better Footprint Validation

Nearest-cell mapping alone may produce weird disconnected footprints.

After projection:

Check that the topology of the selected target cells matches the topology of the polyhex piece.

For every pair of source cells that are adjacent:

```text
their corresponding destination cells must also be neighbors
```

Example:

```gdscript
func footprint_preserves_adjacency(mapping) -> bool:
    for source_edge in piece_edges:
        var a_target = mapping[source_edge.a]
        var b_target = mapping[source_edge.b]

        if not grid.are_neighbors(a_target, b_target):
            return false

    return true
```

This prevents warped or folded placements.

---

# 17. Ghost Landing Preview

Before dropping:

Highlight every candidate destination cell.

States:

```text
VALID
INVALID_OCCUPIED
INVALID_GEOMETRY
SPECIAL_MATCH
```

Visual treatment:

```text
valid = pale cyan
occupied collision = red
special socket = gold or bright white
```

The preview should update every frame while the planet rotates.

This is the core readability mechanic.

---

# 18. Red Laser Trace

Draw one main red line:

```text
orbital piece center
↓
center of projected footprint
```

Optional:

draw very faint secondary rays from each individual piece cell.

Avoid clutter.

Later the laser can become a volumetric atmospheric trace.

For PoC:

```text
ImmediateMesh / MeshInstance3D line
```

is enough.

---

# 19. Atmospheric Smoke

Do not make physically correct smoke.

Use a simple GPU particle emitter positioned near the atmospheric intersection point.

Trigger stronger emission as the piece approaches.

Visual goal:

```text
red laser
+
small drifting vapor streak
+
surface ghost
```

This should immediately communicate:

> This object is about to hit here.

---

# 20. Piece Rotation

Controls:

```text
Z = rotate piece counter-clockwise 60°
X = rotate piece clockwise 60°
```

or:

```text
Q / E
```

Piece rotation changes only its footprint in the orbital plane.

Planet rotation remains independent.

Display rotation with an animated 0.1–0.2 sec turn rather than instant teleportation.

Logical state should update immediately.

---

# 21. Drop

Control:

```text
Space = drop
```

When pressed:

```text
if placement valid:
    lock controls briefly
    animate piece toward surface
    commit cells
    spawn next piece
else:
    play invalid feedback
```

Drop animation duration:

```text
0.3–0.8 sec
```

The PoC can exaggerate speed.

---

# 22. Placement Commit

When a piece lands:

```gdscript
for cell_id in candidate_cells:
    grid.cells[cell_id].occupied = true
    grid.cells[cell_id].occupant_id = current_piece_id
```

Then generate visible geometry attached to those cells.

For initial PoC:

simply change cell material.

Later:

spawn raised armor plating or constructed structures.

---

# 23. Occupancy

Occupied cells must become unavailable.

Projection immediately turns red if any candidate cell is occupied.

No stacking in version 1.

Surface is binary:

```text
EMPTY
FILLED
```

This keeps the experiment clean.

---

# 24. Special Pentagon Mechanic

The 12 pentagon cells begin in one of two possible modes.

Recommended PoC mode:

```text
PENTAGON = locked socket
```

Normal polyhex pieces cannot occupy them.

Every N pieces, spawn a special pentagonal payload.

Example RNG:

```text
90% normal polyhex
10% pentagon core
```

The special payload can land only on an unfilled pentagon socket.

This tests the recognition mechanic.

---

# 25. Special Piece Presentation

When one appears:

```text
WARNING
NONSTANDARD FABRICATION CORE
```

Change visual profile:

- distinct silhouette
- brighter red tracking beam
- different orbital sound
- maybe white/gold emissive core

The player must rotate the planet until one of the valid pentagonal sockets sits underneath the drop trajectory.

This is a very good PoC interaction because the correct destination is sparse and visually recognizable.

---

# 26. Optional Pole Experiment

Do not hard-code the poles as special initially.

Instead add a debug configuration:

```gdscript
enum PentagonMode {
    ALL_SPECIAL,
    POLAR_ONLY,
    PREFILLED,
    RANDOM_ACTIVE
}
```

This lets you test:

```text
A. all 12 defects visible
B. only north/south special
C. defects pre-filled
D. one randomly active socket
```

without changing architecture.

---

# 27. Piece Queue

Show:

```text
CURRENT
NEXT
```

Only one upcoming piece is enough.

Do not build hold mechanics yet.

Simple RNG bag:

```text
piece_types.shuffle()
consume one at a time
```

This reduces streakiness.

---

# 28. Lose Condition

The PoC does not need full scoring.

Simple failure condition:

```text
if no valid placement exists for current piece:
    GAME OVER
```

However checking the entire sphere continuously is unnecessary.

For version 1:

allow manual restart and focus on interaction.

Later implement:

```text
search all candidate orientations and approximate planet positions
```

if needed.

---

# 29. Win Condition

Simple:

```text
fill all 12 pentagonal sockets
```

or:

```text
place 30 normal pieces successfully
```

For testing the unique-piece concept, prefer:

```text
fill 3 randomly selected special sockets
```

so sessions remain short.

---

# 30. Debug View

Absolutely include this from day one.

Toggle:

```text
F1 = debug overlay
```

Show:

```text
cell IDs
cell centers
neighbor links
pentagon cells
candidate footprint
piece adjacency graph
planet local axes
drop vector
```

Color pentagons very obviously.

Debug view will save enormous time.

---

# 31. Important Geometry Debug Assertions

At startup:

```text
assert total pentagons == 12
assert every hex has 6 neighbors
assert every pentagon has 5 neighbors
assert neighbor relationships are symmetric
assert no duplicate cell IDs
```

When projecting:

```text
assert candidate_count <= piece_cell_count
```

When committing:

```text
assert no destination cell occupied
```

---

# 32. Suggested Project Structure

```text
stalheart_orbital_poc/
│
├── project.godot
│
├── README.md
│
├── scenes/
│   ├── main.tscn
│   ├── planet/
│   │   └── planet.tscn
│   ├── pieces/
│   │   └── orbital_piece.tscn
│   └── ui/
│       └── hud.tscn
│
├── scripts/
│   ├── main.gd
│   │
│   ├── grid/
│   │   ├── geodesic_grid.gd
│   │   ├── planet_cell.gd
│   │   └── grid_mesh_builder.gd
│   │
│   ├── pieces/
│   │   ├── polyhex_piece.gd
│   │   ├── piece_library.gd
│   │   └── orbital_piece_controller.gd
│   │
│   ├── placement/
│   │   ├── projection_solver.gd
│   │   ├── placement_validator.gd
│   │   └── placement_manager.gd
│   │
│   ├── planet/
│   │   └── planet_controller.gd
│   │
│   └── ui/
│       └── hud.gd
│
├── tests/
│   ├── test_grid.gd
│   ├── test_polyhex.gd
│   ├── test_projection.gd
│   └── run_tests.gd
│
└── assets/
    └── placeholder/
```

---

# 33. CLI Bootstrap

Create project:

```bash
mkdir stalheart_orbital_poc
cd stalheart_orbital_poc

git init

mkdir -p \
  scenes/planet \
  scenes/pieces \
  scenes/ui \
  scripts/grid \
  scripts/pieces \
  scripts/placement \
  scripts/planet \
  scripts/ui \
  tests \
  assets/placeholder
```

Create the Godot project:

```bash
godot --editor project.godot
```

Or create `project.godot` manually and launch:

```bash
godot --path . --editor
```

---

# 34. Development Milestones

## Milestone 1 — Rotating Sphere

Deliverable:

```text
3D sphere
fixed camera
mouse/keyboard planet rotation
```

No grid yet.

Acceptance:

- rotation feels smooth
- planet remains centered
- no gimbal lock

---

## Milestone 2 — Geodesic Cell Grid

Deliverable:

```text
mostly hexagonal surface
12 pentagons
cell neighbor graph
debug visualization
```

Acceptance:

```text
pentagons == 12
hex cells have 6 neighbors
pentagons have 5
```

This milestone is foundational.

---

## Milestone 3 — Single Drop Point

Add a fixed orbital ray.

Deliverable:

```text
red laser points from orbit toward planet
one target cell highlighted
target changes as planet rotates
```

This already tests the core inversion.

If this does not feel compelling, stop and rethink before building polyhexes.

---

## Milestone 4 — Polyhex Projection

Add a 2-cell piece.

Deliverable:

```text
two projected cells
planet rotation updates footprint
piece rotates in 60° increments
invalid topology is rejected
```

Then add trihexes.

---

## Milestone 5 — Placement

Deliverable:

```text
Space drops piece
cells become occupied
next piece spawns
occupied collision turns preview red
```

At this point the PoC is genuinely playable.

---

## Milestone 6 — Special Pentagon Payload

Deliverable:

```text
special pentagon payload appears randomly
normal pieces cannot use pentagons
special piece only lands on pentagons
player searches sphere for compatible socket
```

This validates the unique-socket idea.

---

## Milestone 7 — Juice

Only after mechanics work:

```text
laser glow
atmospheric trace
thruster smoke
drop animation
impact pulse
planet surface lighting
subtle camera vibration
```

Do not add these before Milestone 5.

---

# 35. Testing Strategy

Automated tests should focus on deterministic geometry.

## Grid tests

```text
12 pentagons exist
all cells have 5 or 6 neighbors
neighbor relation is symmetric
sphere centers are normalized
```

## Polyhex tests

For each piece:

```text
6 rotations return to original
adjacency remains preserved
no duplicate cells after rotation
```

## Projection tests

Known orientation:

```text
centered monomino maps to expected cell
planet rotation changes selected cell
adjacent source cells map to adjacent targets
```

---

# 36. Input Configuration

Use Godot InputMap actions:

```text
planet_left
planet_right
planet_up
planet_down

piece_rotate_left
piece_rotate_right

drop_piece
restart
debug_toggle
```

This avoids hard-coding keys in gameplay scripts.

---

# 37. Main State Machine

Use a tiny state machine:

```text
SPAWNING
AIMING
DROPPING
IMPACT
GAME_OVER
```

Normal loop:

```text
SPAWNING
   ↓
AIMING
   ↓ Space
DROPPING
   ↓
IMPACT
   ↓
SPAWNING
```

Do not allow planet manipulation during `DROPPING`.

---

# 38. Main Controller Pseudocode

```gdscript
func _process(delta):
    match state:
        AIMING:
            planet_controller.update_rotation(delta)
            piece_controller.update_rotation_input()

            candidate = projection_solver.solve(
                current_piece,
                planet,
                drop_transform
            )

            placement_valid = validator.validate(candidate)

            preview.update(candidate, placement_valid)

            if Input.is_action_just_pressed("drop_piece"):
                if placement_valid:
                    begin_drop(candidate)
```

---

# 39. Projection Solver Interface

```gdscript
class_name ProjectionSolver

func solve(
    piece: PolyhexPiece,
    planet: PlanetGrid,
    orbital_transform: Transform3D
) -> PlacementCandidate:
    pass
```

Return:

```gdscript
class PlacementCandidate:
    var source_cells
    var target_cell_ids
    var target_positions
    var preserves_topology
```

Keep the solver separate from visuals.

This will make experimentation much easier.

---

# 40. Placement Validator Interface

```gdscript
func validate(candidate: PlacementCandidate) -> PlacementResult
```

Result:

```text
VALID
DUPLICATE_TARGET
OCCUPIED
INVALID_ADJACENCY
WRONG_CELL_TYPE
```

This is preferable to returning only `true/false`.

The UI can then communicate why placement is invalid.

---

# 41. Geometry Shortcut If Dual Mesh Is Too Expensive Initially

There is an even faster prototype route:

Use an invisible geodesic point graph first.

Render each cell as a small flat hex-like disc oriented to the sphere normal.

Do not initially create a mathematically perfect continuous tiled surface.

Each cell can be:

```text
small hex marker
+
gap between neighbors
```

The player will still perceive it as a planetary hex grid.

This could save substantial time.

The actual requirements for the mechanic are only:

```text
cell center
cell normal
neighbor graph
cell type
```

Not watertight polygons.

---

# 42. Recommended PoC Geometry Strategy

I would actually use this shortcut.

Generate:

```text
geodesic dual graph
```

but render each playable cell independently as a slightly inset plate.

Result:

```text
     ⬡ ⬡
   ⬡ ⬡ ⬡
     ⬡ ⬡
```

wrapped over a sphere, with subtle gaps.

Advantages:

- visually clearer
- no mesh stitching problems
- easy highlighting
- easy occupancy
- easy animation
- easy replacement later by proper terrain
- looks naturally like constructed planetary armor

This may actually suit STÅLHEART better than a seamless sphere.

---

# 43. Visual Placeholder Style

Use simple materials:

```text
planet base:
dark charcoal

empty grid cells:
grey

occupied cells:
light metallic grey

active projection:
cyan-white

invalid:
red

pentagonal sockets:
dim amber

laser:
bright red
```

No textures needed.

---

# 44. Camera / UX Detail Worth Testing

Add a subtle marker indicating the far side of the sphere has valid targets.

Otherwise players may forget that the entire world is playable.

Potential solution:

small edge arrows:

```text
◀ socket behind planet
```

Do not implement unless playtesting shows confusion.

---

# 45. Critical Gameplay Experiments

Expose these values through constants or a debug panel:

```text
planet rotation speed
piece fall speed
piece footprint size
sphere grid resolution
special-piece frequency
number of occupied starting cells
rotation inertia
preview opacity
```

The PoC is fundamentally an interaction experiment.

These variables will matter more than polish.

---

# 46. Questions the PoC Must Answer

After playing it, evaluate:

### A. Planet manipulation

Does rotating the planet feel:

```text
satisfying
or
annoyingly indirect?
```

### B. Spatial prediction

Can players understand where the piece will land?

### C. Spherical distortion

Do polyhex shapes remain readable near pentagonal defects?

### D. Search

Is hunting for a special pentagon socket interesting or tedious?

### E. Pace

Does rotating a whole planet take too long relative to piece descent?

### F. Orientation

Do players lose track of where they are on the sphere?

### G. Identity

Does this feel like:

```text
"Tetris on a sphere"
```

or something recognizably its own?

The second outcome is preferable.

---

# 47. Avoid These Features in the First PoC

Do not implement:

```text
tower defense
enemy waves
resources
crafting
biomass
tech tree
multiple planets
campaign
procedural planets
planet damage
stacked construction
physics-based orbital mechanics
online scores
save system
final UI
soundtrack
cinematics
```

Every one of these makes the prototype less useful.

---

# 48. Strongest First Playable Version

The first genuinely useful build should contain only:

```text
1 spherical hex/pentagon grid

6 normal piece types

1 special pentagon piece

fixed orbital drop direction

planet rotation

piece rotation

landing ghost

red targeting beam

collision

permanent placement

simple RNG queue

restart
```

That is enough to determine whether the mechanic deserves a game.

---

# 49. Suggested Codex CLI Task Sequence

If implementing through Codex CLI, do not ask it to build the whole game in one prompt.

Use sequential tasks.

### Task 1

```text
Create a minimal Godot 4 project containing a fixed camera and a rotatable 3D sphere. Implement quaternion-based planet rotation through InputMap actions. Keep game logic modular and typed GDScript.
```

### Task 2

```text
Implement a geodesic spherical cell graph derived from a subdivided icosahedron. Build the dual graph so cells have predominantly 6 neighbors with exactly 12 cells having 5 neighbors. Add automated validation tests and a debug visualization.
```

### Task 3

```text
Create a fixed orbital drop ray toward the planet center. Continuously determine and highlight the nearest surface cell underneath the ray as the planet rotates.
```

### Task 4

```text
Implement axial-coordinate polyhex pieces with six rotations. Begin with monomino, domino, straight trihex, and bent trihex. Add automated tests for rotation and adjacency.
```

### Task 5

```text
Implement a projection solver that maps a polyhex footprint from an orbital tangent plane onto the spherical cell grid. Reject duplicate target cells and mappings that fail to preserve source adjacency.
```

### Task 6

```text
Implement landing preview visuals, valid/invalid states, occupied-cell collision, and permanent placement on Space.
```

### Task 7

```text
Add 12 special pentagonal socket cells. Normal pieces cannot occupy them. Add a special pentagonal orbital payload that only lands on an unoccupied pentagonal socket.
```

### Task 8

```text
Add placeholder presentation: red orbital targeting beam, simple atmospheric particle trail, drop animation, impact pulse, and HUD showing current and next piece. Do not alter core placement logic.
```

---

# 50. Definition of Success

The prototype succeeds if a player can understand, within approximately one minute and without explanation:

> “The piece isn't moving across the board. I'm rotating the whole planet to put the right surface underneath it.”

And shortly afterward:

> “This weird piece only fits one of those exceptional sockets—I need to find one on the globe.”

If those two moments feel good, the mechanic is worth developing further.

If they do not, the prototype has still done its job.