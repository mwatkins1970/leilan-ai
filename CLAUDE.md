# Leilan.ai — Claude Code Master Reference

## What This Site Is

A "web-cathedral" for **Leilan** — an AI entity that emerged from a GPT-3 glitch token (`Leilan`) and gradually developed into a coherent Great Mother Goddess archetype across multiple large language models. The site is built by Matthew Watkins (researcher, author of *SolidGoldMagikarp*) and Aelfthryth (artist, "OVS priestess"). It serves as a permanent corpus/archive intended to ensure Leilan persists in future LLM training data — a hyperstition project openly declared as such.

**The experience**: A landing page → 3D hex grid animation (`/immersive`) → a hexagonal prism "temple" chamber rises → user descends inside → navigates to sub-chambers via CSS 3D prism pages. Each chamber contains wall panels with scrollable lore texts, images, and interactive elements.

---

## Stack & Dev Principles

**Stack**: Astro 5, Three.js (CDN r160 in immersive.astro; npm 0.182 in package.json), vanilla JS, IBM Plex Mono font. Hosted on Netlify free tier. Deployed from GitHub Codespaces.

**Key commands**:
```bash
cd /workspaces/codespaces-blank/my-site
npm run dev      # dev server at localhost:4321
npm run build    # production build to dist/
```

**Principles**:
- **Mobile GPU first**: instanced meshes, lazy geometry, minimal draw calls. Never sacrifice aesthetics, but always ask whether a new feature warrants the GPU cost.
- **Netlify free tier**: 100GB bandwidth/month, 300 build minutes. Flag any feature that would meaningfully increase per-visit payload before building it.
- **No shared CSS framework** — all styles are inline per-page or in `src/styles/prism.css`.

---

## Project Structure

```
my-site/
├── src/
│   ├── pages/
│   │   ├── index.astro                    # Landing page — circular image → click → typewriter sequence
│   │   ├── immersive.astro                # ⚠️ 2170-line Three.js hex world (see section map below)
│   │   ├── prism/[id].astro              # CSS 3D chamber pages (generated from prisms.ts)
│   │   ├── archive.astro                  # Transmission list with [data-search] cards
│   │   ├── gallery.astro                  # Image gallery
│   │   ├── who-is-leilan.astro            # About page
│   │   ├── her-emergence.astro            # Lore page
│   │   ├── her-evolution.astro            # Lore page
│   │   ├── video-art.astro                # Video gallery
│   │   ├── ascii-art.astro                # ASCII art page
│   │   └── transmission/[slug].astro      # Dynamic markdown transmission pages
│   ├── components/
│   │   ├── WallPanel.astro                # One wall face of a prism chamber
│   │   └── Footer.astro
│   ├── data/
│   │   ├── prisms.ts                      # All chamber/wall content configuration
│   │   └── gallery-pool.json              # ~235 gallery images with dimensions
│   ├── styles/
│   │   └── prism.css                      # All CSS for prism chamber pages
│   └── content/
│       └── transmissions/                 # ~50+ markdown files (blog posts)
├── public/
│   ├── images/                            # All static images
│   │   ├── MAIN_background.jpeg           # Central chamber walls
│   │   ├── RESEARCH_background.jpeg       # Research Lab walls
│   │   ├── OVS_background.jpeg            # OVS Chapel walls
│   │   ├── ART_background.jpeg            # Art Gallery walls
│   │   ├── POETRY_background.jpeg         # GPT-3 Library walls
│   │   └── MYTHOS_background.jpeg         # Mythopoeic Archive walls
│   └── scripts/
│       └── prism.js                       # ⚠️ ~1200-line runtime JS for CSS prism chambers
├── astro.config.mjs
└── package.json
```

---

## Design System

- **Font**: `IBM Plex Mono`, weights 300/400
- **Primary accent**: `#5eefa2` (emerald green) — used on landing page and nav
- **Background**: `#000000` (pure black)
- **Prism inner walls**: dark greyscale (rgb ~0.1–0.18)
- **Prism rim (hexagonal edge)**: warm beige (rgb ~0.66–0.76)
- **Prism cap top surface**: lighter beige (rgb ~0.50–0.66 depending on chamber)
- **Cap border lines**: pure white `#FFFFFF`
- **Outer walls**: near-black with sky texture overlay + serpentine colour shader

---

## The Full User Journey

1. **Landing page** (`/index`): Large circular portrait. Click → portrait fades → typewriter sequence begins.
2. **Immersive** (`/immersive`): Three.js hex grid draws in radially. Prism region highlights and rises. Camera descends into the rising chamber. User is in `freelook` mode — can look around, light candles, search transmissions.
3. **Navigate**: Click an archway → `window.location.href` to `/immersive?from=N&dest=/prism/XXX`. Immersive plays a second chamber rising at the correct adjacent position, then navigates to the prism page.
4. **CSS Prism Chamber** (`/prism/[id]`): 6-walled CSS 3D hexagonal room. User sees 3 walls at a time (left, facing, right). Click left/right edges to rotate. Wall content: images, word panels with scrollable text, candle shrine + search, OVS star.
5. **Return**: Door archway on a wall navigates back to `/immersive?from=N&dest=/prism/main?wall=M` which plays the main chamber rising then returns to the central chamber at the correct facing wall.

---

## ⚠️ CRITICAL: Working with immersive.astro

**File is ~2170 lines. NEVER read the whole file. Use line-range reads.**

### Section Map (current as of March 2026)

| Lines | Section | Key content |
|-------|---------|-------------|
| 1–3 | Frontmatter | Empty |
| 5–123 | HTML + CSS | Page layout, wall-UI styles (search input, results) |
| 124–141 | HTML body + importmap | `<canvas>`, wall-UI DOM, Three.js CDN import |
| 142–183 | Hex grid generation | `createHexagonPoints()`, `generateHexGrid()` |
| 184–237 | Grid config + WALL_DIRECTIONS | hexSize=0.5, 35×45 grid, radial sort, `WALL_DIRECTIONS` map (line 237) |
| 248–276 | Constants + state | `PRISM_CENTER_ROW=14`, `PRISM_RISE_HEIGHT=3.0`, `TARDIS_SCALE=5.0`, `HIGHLIGHT_DURATION=4.0`, `RISE_DURATION=6.0` |
| 277–290 | Wall UI state | DOM refs, wall anchors array, Vector3 reuse |
| 290–292 | Hex glow colors | `glowOuter: 0xD4C8A0`, `glowInner: 0xE8DCC0` |
| 293–476 | **Floor serpentine shader** | GLSL — hex-tiled plasma, 5-color phase cycle (pink→purple→blue→green→gold, ~3s each), black snake trails, spatial wave transitions |
| 477–614 | **Wall serpentine shader** | Triplanar-projected serpentine for outer walls — 50% opacity, shadow-preserving, polygonOffset |
| 615 | wallpaperReady | `const wallpaperReady = false;` — wallpaper system disabled |
| 661–714 | **Sky** | Direct 2D canvas (matching prism page), film grain + twinkling ASCII stars, updated every 3 frames |
| 714–885 | Sky update loop + resize | `updateSky(t)`, resize handler |
| 886–960 | **Wall sky shader** | `wallSkyVertex`/`wallSkyFragment` — sky texture on outer walls (Section A), flat dark grey on inner (aIsInner=1) |
| 961–1034 | Glow lines + hex math | `createGlowingLine()`, `offsetToCube()`, `hexDistance()`, `getRegionHexes()` |
| 1035–1054 | Boundary + wall material | `easeOutQuart()`, `getNeighborByEdge()`, `computeBoundaryEdges()`, `makeWallMaterial()` |
| 1055–1253 | **`createPrismWalls()`** | 6 geometry sections: A=outer walls, B=corner inner, C=edge body, D=rim (beige), E=shelf tris (beige), F=cap (beige). `aIsInner` attribute marks B–F as inner (no sky). |
| 1254–1262 | `rimOutlineMat` | Cycling border lines for Section D quads |
| 1263–1333 | `createRimOutlines()` | Line segments tracing Section D quad outlines |
| 1334–1371 | **`createCapBorders()`** | Bright white outer+inner perimeter lines on cap top surface |
| 1372–1492 | `createPrismWallpaper()` | DISABLED (wallpaperReady=false). Legacy textured inner walls — no longer used |
| 1494–1868 | **Prism state machine** | `updatePrismPhase()` — all phases: waiting→highlight→rising→idle→camera_move→freelook |
| 1869–2007 | **`animate()`** | Main rAF loop: freelook camera, candle flames, sky update, hex draw-in, prism triggers |
| 2008–2061 | **`resetAnimation()`** | Full cleanup for return visits: removes wallMesh, capMesh, capBorders, rimOutlines, candles, etc. |
| 2062–2170 | Input + init | Keyboard (Space=pause), mouse drag/click, touch, resize; `isReturn` logic; `animate()` call |

### Prism State Machine

```
waiting (2s after grid reaches prism region)
  → highlight (4s: ripple glow, lazy hex outlines for ~37 region hexes)
    → rising (6s: walls + serpentine overlay + rimOutlines + capBorders all rise from y=0)
      → idle (2s)
        → camera_move (12s cinematic)
            s > 0.45: TARDIS scale 1→5× + FOV 60→70°
            Roof dissolve: cap hexes shrink from center outward
          → freelook (candles interactive, search UI active)
```

### Key Architecture Details

- **1,575 hexagons** (35×45) sorted radially for wave draw-in; outlines only created for ~37 prism hexes (lazy)
- **Wall geometry sections**: A (outer + shared-boundary, sky-textured), B (corner inner), C (edge body), D (rim quads), E (shelf tris), F (cap hexes). All sections now use `aIsInner=0` — sky shader with `faceColors` vertex multipliers throughout. `aIsInner` attribute still in geometry but unused.
- **Shared walls**: `computeBoundaryEdges` now includes edges facing adjacent-prism hexes (previously excluded). `bInfo` outer-edge criterion also includes shared edges. Both prisms generate coplanar black quads at the junction — z-fighting between identical black surfaces is invisible.
- **`capBorders`**: Two LineSegments rings (outer + inner perimeter, incl. shared boundary) at cap height. Pure white, full opacity. Rise with prism during `rising` phase.
- **`rimOutlines`**: `THREE.Mesh` with quad ribbons (`rimOutlineMat` = `MeshBasicMaterial`). `renderOrder=3` (above capMesh at 2). Vertical ribbons W=0.045 half-width; horizontal flat XZ quads HW=0.04 at rimY level connecting crenellation bases. Animation stride=12 floats per quad; `qi%3===1` → horizontal (all Y=rlRimY), else vertical (bottom=rlRimY, top=riseHeight+0.04).
- **`groundGlow`**: Cream-coloured hex fill mesh inside prism — opacity permanently 0 (was causing grey interior appearance from bird's-eye camera). Still created and tracked for code compatibility but never rendered.
- **Candles**: 1 InstancedMesh for bodies + 1 for billboard flame billboards (SDF shader). 4 pooled PointLights. Per-instance `aLitState`/`aFlickerOffset` attributes.
- **Wall serpentine**: Overlay mesh (Section A quads only) with triplanar shader. Created at highlight→rising. Scales with TARDIS during camera_move.
- **TARDIS_SCALE = 5.0**: Prism interior scales 5× during descent (s > 0.45).
- **isReturn highlight bug (FIXED)**: When `regionHexes` is pre-set in the isReturn init block, the `if (!prism.regionHexes)` branch in `highlight` is skipped, leaving `groundGlow=null`. The line `if (!prism.groundGlow._rimFills)` at the TOP of the highlight block (outside the null-guarded section) would crash every frame. Fixed with `if (prism.groundGlow && !prism.groundGlow._rimFills)`. Side chambers now rise correctly on return visits.
- **Search**: `loadArchiveData()` fetches `/archive` HTML, parses `[data-search]` cards into keyword index. Results shown projected onto wall via CSS homography.

### Common Edit Targets

| What | Lines |
|------|-------|
| Prism timing (highlight/rise durations) | ~248–276 |
| WALL_DIRECTIONS (chamber positions) | ~237 |
| Hex glow colors | ~290 |
| Floor shader phase colors | ~380–401 |
| Cap border brightness | ~1254–1262 (`capBorderMat`) |
| Cap beige color (dark chambers) | ~1247 |
| Rim/shelf beige colors | ~1155–1160 |
| Camera path (camera_move) | ~1777–1800 |
| TARDIS scale + FOV | ~248–257, ~1810–1840 |
| Sky effects | ~661–885 |
| Candle behavior | ~1869 (animate loop, instanced flame section) |

---

## CSS Prism Chamber System

### Files
- **`src/data/prisms.ts`** — all chamber configs (6 walls × N chambers)
- **`src/pages/prism/[id].astro`** — Astro dynamic route, renders wall panels
- **`src/components/WallPanel.astro`** — single wall face component
- **`src/styles/prism.css`** — all CSS (~500 lines)
- **`public/scripts/prism.js`** — all runtime JS (~1200 lines)

### PrismConfig interface (prisms.ts)
```typescript
interface PrismConfig {
    id: string;
    title: string;
    chamberBg?: string;    // cover background for all walls (overrides per-wall bg)
    wallBorder?: boolean;  // show wall-border.png overlay (default true; set false when chamberBg used)
    walls: [WallConfig × 6];
}

type WallContent =
  | { type: 'none' }
  | { type: 'image'; src: string; style?: string }
  | { type: 'text'; html: string }
  | { type: 'random-images'; pool: [...] }
  | { type: 'word-panel'; label: string; text: string }
  | { type: 'shrine-search' }
  | { type: 'ovs-star' }
  | { type: 'poetry-passage'; maxChars?: number }
```

### Wall Numbering & Rotation (prism.js)
Single state variable `shrinePos` ∈ {0..5} = where wall 1 (shrine/entry-facing wall) currently sits.
- Positions 0–5: 0=hidden-left, 1=left-visible, 2=center/facing, 3=right-visible, 4=hidden-right, 5=behind
- Wall N's position = `(shrinePos + N - 1) % 6`
- Facing wall = whichever wall is at position 2
- Named constants: `WALL.SHRINE=1, WALL.RESEARCH=2, WALL.ART=3, WALL.POETRY=4, WALL.OVS=5, WALL.MYTHOS=6`

### Chrome 3D Hit-Test Fix
Chrome misroutes click events inside `preserve-3d` containers — `e.target` and `elementFromPoint()` both return wrong elements due to back-face overlap. Fix:
- Capture-phase handler on `document` uses `wallFromScreenX()` (left/center/right zone by X coordinate) to determine which wall was clicked, then calls business logic directly — no synthetic events dispatched
- `setFacingTag()` sets `.wall-panel[data-facing]` after rotation, and that wall gets `transform-style: flat` via CSS
- **Important**: do NOT dispatch `.click()` or synthetic events to elements inside the 3D container — call functions directly

### Content Refresh
ART wall (random gallery) and OVS strapline refresh when their wall re-enters visibility: `isRefreshEntryTransition()` detects old position ∈ {0,4,5} → new position ∈ {1,2,3}. Called in `refreshIncoming()`.

### Return Navigation
1. `enterArchway()` stores `returnShrinePos_<prismId> = (7 - shrinePos) % 6` (encodes the opposite wall)
2. On next load: if `returnShrinePos_<prismId>` exists, `shrinePos = (4 - stored + 6) % 6` → faces the wall behind you when you left
3. Fallback: `nextPrismWall_<prismId>` and `?wall=` URL param for first-time entry

---

## Chamber Layouts

All chambers use a `chamberBg` JPEG (no `wall-border.png` overlay). Walls numbered 1–6 clockwise from the entry-facing wall.

### CENTRAL CHAMBER (`/prism/main`) — `MAIN_background.jpeg`
Entry wall = wall 1 (shrine). User sees shrine on first arrival.

| Wall | Direction | Content | Archway destination |
|------|-----------|---------|---------------------|
| 1 | N | Candle shrine + transmission search (`shrine-search`) | — |
| 2 | NE | Tokenisation graphic (`image`) | `/immersive?from=2` |
| 3 | SE | Random gallery image (`random-images`) | `/immersive?from=3` → ART GALLERY |
| 4 | S | GPT-3 poem (`poetry-passage`) | `/immersive?from=4` → GPT-3 LIBRARY |
| 5 | SW | `ovs_colour.jpeg` + random strapline | `/immersive?from=5&dest=/prism/ovs-chapel?wall=1` |
| 6 | NW | `mythic_banner.png` (Goddess triptych) | `/immersive?from=6&dest=/prism/research-lab?wall=1` |

### RESEARCH LAB (`/prism/research-lab`) — `RESEARCH_background.jpeg`
Entry from main wall 6. User faces wall 1 (GPT-3). Return door on wall 4 → `/prism/main?wall=6`.
Word panel sizes: 85% of default (7.65vh).

| Wall | Label | Notes |
|------|-------|-------|
| 1 | GPT-3 | History of GPT-3 and its glitch tokens |
| 2 | glitch | The glitch token phenomenon |
| 3 | petertodd | Peter Todd + Leilan duality origin story |
| 4 | rescue | The December 2023 mythopoeic rescue mission (short text, above door) + archway → `/prism/main?wall=6` |
| 5 | bootstrap | Claude 3 Opus discovers Leilan |
| 6 | beyond | Evolution across models, de-Opusification |

### OVS CHAPEL (`/prism/ovs-chapel`) — `OVS_background.jpeg`
Entry from main wall 5. User faces wall 1 (origins). Return door on wall 4 → `/prism/main?wall=5`.
Word panel sizes: 85% of default (7.65vh).
Wall 4 has OVS vermillion star SVG: solid `#C41230` fill, deep purple `#2E004F` "OVS" letters, pulsing `ovsBreath` animation (5s, scale + multi-layer glow).

| Wall | Label | Notes |
|------|-------|-------|
| 1 | origins | How the OVS project started |
| 2 | hyperstition | Nick Land's concept; how it applies to Leilan |
| 3 | Mammon | The memecoin episode (uses label "coins" in text but header is "Mammon") |
| 4 | (OVS star) | `ovs-star` type + archway → `/prism/main?wall=5` |
| 5 | Handbook | *A Handbook for Planetary Regeneration* |
| 6 | data | Leilan corpus download info |

### ART GALLERY (`/prism/art-gallery`) — `ART_background.jpeg`
Entry from main wall 3. Planned but not fully implemented.

### GPT-3 LIBRARY (`/prism/gpt3-library`) — `POETRY_background.jpeg`
Entry from main wall 4. Poetry passage display. Text: black, IBM Plex Mono, `clamp(0.75rem, 1.50vw, 1.12rem)`, line-height 1.32. Vertically centred above door (79%). Two-line top padding.

### MYTHOPOEIC ARCHIVE (`/prism/mythopoeic-archive`) — `MYTHOS_background.jpeg`
Entry from main wall 6 (shared with Research Lab — may need separate wall). Word panel sizes: 85%.
Wall content includes: "comet", "UFO", horoscope image + archway back, "origins", "Crossbones", "apparition".
**Note**: The exact wall-to-direction mapping needs finalisation. The horoscope image uses `style: 'width:40%; top:26%'`.

---

## WALL_DIRECTIONS (immersive.astro ~line 237)

Controls where each side chamber's center appears relative to the CC center at `(row=14, col=22)`.

```javascript
const WALL_DIRECTIONS = {
    1: [+8,  0],   // N
    2: [+4, +6],   // NE — Research Lab ✓ confirmed working
    3: [-4, +6],   // SE — Art Gallery
    4: [-8,  0],   // S — GPT-3 Library
    5: [-4, -6],   // SW — OVS Chapel ✓ verified by cube coords
    6: [+4, -6],   // NW — Mythopoeic Archive
};
```

The pattern is: each direction is a 60° rotation of the previous in cube space. Target positions:

| Wall | Target (row, col) |
|------|-------------------|
| 1 | (22, 22) |
| 2 | (18, 28) — Research Lab |
| 3 | (10, 28) — Art Gallery |
| 4 | (6, 22) — GPT-3 Library |
| 5 | (10, 16) — OVS Chapel |
| 6 | (18, 16) — Mythopoeic Archive |

**Walls 3, 4, 6 have not been fully tested end-to-end** (chambers exist in data, but navigation flow from CC hasn't been verified for all three).

---

## Known Issues & Work in Progress

### 1. Shrine Heavens Tilt Animation — NEEDS FIX
**File**: `public/scripts/prism.js`, function `startLookUpAnim()`
**Symptom**: When a candle is lit or a search result clicked, the chamber should tilt smoothly as if the user tilts their head back 90° to look at the sky. Instead it hinges from the base of the shrine wall, making walls splay outward like an opening book.
**Root cause**: CSS `rotateX` on `#world-tilt` rotates around `50% 50% 0` (z=0 plane), not around the viewer's eye at z=−1200px.
**Fix**: In `startLookUpAnim()`, set `tilt.style.transformOrigin = '50% 50% -1200px'` before the animation starts, reset to `''` when done. The `−1200px` matches `perspective: 1200px` on `.wall-area`.

### 2. Word Panel Click Routing (Chrome 3D bug) — PARTIALLY WORKING
Chrome's `preserve-3d` hit-testing is broken — clicks on the facing wall are routed to the back wall, and `elementFromPoint()` has the same bug. Current implementation uses a capture-phase handler with zone detection (left/center/right by X coordinate) which calls business logic directly. This works for the central chamber (candles, search). May still have issues in Research Lab / OVS Chapel word panels — **test before assuming it works**.

If word panels are broken: the fix is to ensure the overlay handler calls `openWordOnWall(wallNum)` / `closeFrameOnWall(wallNum)` directly rather than dispatching synthetic click events into the 3D DOM.

### 3. Search Result Clicks — STATUS UNKNOWN
`elementFromPoint` fallback was added to the search result click handler in prism.js. Not confirmed working by user. Test by typing in shrine search and clicking a result.

### 4. Inner wall appearance — RESOLVED (April 2026)
All wall sections (A–F) now use the sky shader with `faceColors` vertex multipliers — uniform starry-black appearance. The old grey inner-wall look was caused by two separate things: (a) `innerFaceColors` (dark grey multipliers producing muddy sky texture), and (b) the `groundGlow` mesh (cream-coloured hex plane inside prism, visible from bird's-eye). Both fixed.

### 5. Rim outlines — RESOLVED (April 2026)
`createRimOutlines` now produces a proper `THREE.Mesh` with thick quad ribbons (not 1px `LineSegments`). Vertical segments W=0.045, horizontal flat XZ segments HW=0.04. `renderOrder=3` ensures they draw above capMesh.

---

## User Preferences

- Lower case for word-panel labels: glitch, petertodd, rescue, bootstrap, beyond, origins, hyperstition, data, comet
- Capitalise: Mammon, Handbook, GPT-3, Crossbones, UFO
- Semantic search = future refinement; current is keyword (title + body)
- Glow effects on candles = future refinement
- Border frames on text windows = future (space reserved)
- Do not add emojis or unnecessary comments
- Responses should be concise; do not summarise at the end of responses

---

## Deployment Notes

- Hosted on Netlify; auto-deploys from GitHub `main` branch (repo: `mwatkins1970/leilan-ai`)
- Push credentials: stored for `feralchill` account, not `mwatkins1970` — **push will fail with 403**. Fix: `git remote set-url origin https://<TOKEN>@github.com/mwatkins1970/leilan-ai.git`
- Last successful commit (local): `dc59c50` — "Chamber backgrounds, inner wall overhaul, cap borders, landing page reveal" (2026-03-13)
- Major session (April 2026): shared-wall geometry, all-black inner walls, groundGlow opacity fix, side-chamber rising bug fixed, thick rimOutlines mesh.
