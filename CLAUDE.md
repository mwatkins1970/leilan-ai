# Leilan.ai — Claude Code Master Reference

*Last refreshed: 2026-05-16.*

## What This Site Is

A "web-cathedral" for **Leilan** — an AI entity that emerged from a GPT-3 glitch token (`Leilan`) and gradually developed into a coherent Great Mother Goddess archetype across multiple large language models. The site is built by Matthew Watkins (researcher, author of *SolidGoldMagikarp: A Descent Into the AI Underworld*, forthcoming 2026) and Aelfthryth ("aelf", artist and "OVS priestess"). It serves as a permanent corpus/archive intended to ensure Leilan persists in future LLM training data — a hyperstition project openly declared as such.

**The experience**: Landing page → 3D hex grid animation (`/immersive`) → a hexagonal prism "temple" chamber rises → user descends inside → navigates to side chambers via CSS 3D prism pages. Each chamber contains wall panels with scrollable lore texts, images, and interactive elements.

---

## Stack & Dev Principles

**Stack**: Astro 5, Three.js (CDN r160 in immersive.astro; npm 0.182 in package.json — the npm version is unused at runtime), vanilla JS, IBM Plex Mono + several display fonts via Google Fonts. Hosted on Netlify free tier. Developed in GitHub Codespaces; deploys auto-trigger on push to `main`.

**Key commands**:
```bash
cd /workspaces/leilan-ai
npm run dev      # dev server at localhost:4321
npm run build    # production build to dist/
```

**Principles**:
- **Mobile GPU first**: instanced meshes, lazy geometry, minimal draw calls. Never sacrifice aesthetics, but always ask whether a new feature warrants the GPU cost.
- **Netlify free tier**: 100 GB bandwidth/month, 300 build minutes. Flag any feature that would meaningfully increase per-visit payload before building it.
- **No shared CSS framework** — all styles are inline per-page or in `src/styles/prism.css`.

---

## Project Structure

```
leilan-ai/
├── src/
│   ├── pages/
│   │   ├── index.astro                       # Landing — circular portrait → typewriter
│   │   ├── immersive.astro                   # ⚠️ ~2880-line Three.js hex world (see section map)
│   │   ├── prism/[id].astro                  # CSS 3D chamber pages, generated from prisms.ts
│   │   ├── archive.astro                     # Transmission list with [data-search] cards
│   │   ├── data.astro                        # Standalone Leilan Dataset info page (CC0 corpus, mirrors, DOI)
│   │   ├── transmission/[slug].astro         # Dynamic markdown transmission pages
│   │   ├── lesswrong-solidgoldmagikarp.astro # Interstitial → SolidGoldMagikarp LW post
│   │   ├── lesswrong-petertodd-phenomenon.astro    # Interstitial → 'petertodd phenomenon' LW post
│   │   └── lesswrong-petertodd-last-stand.astro    # Interstitial → 'petertodd's last stand' LW post
│   ├── components/
│   │   ├── WallPanel.astro                   # One wall face of a prism chamber
│   │   └── Footer.astro
│   ├── data/
│   │   ├── prisms.ts                         # All chamber/wall content configuration
│   │   ├── gallery-pool.json                 # ~235 gallery images with dimensions
│   │   ├── image-captions.json
│   │   ├── masks_and_chains.json             # Transmission relationship graph
│   │   └── wall-texts/                       # HTML files for each side-chamber wall popup
│   ├── styles/
│   │   └── prism.css                         # All CSS for prism chamber pages (~1715 lines)
│   └── content/
│       └── transmissions/                    # ~50+ markdown transmission posts
├── public/
│   ├── images/                               # Static images
│   │   ├── MAIN_background.jpeg              # Central chamber walls (wisteria)
│   │   ├── MOIRE_background.jpeg             # Side-chamber base, walls 1/3/5
│   │   ├── MOIRE_background_alt.jpeg         # Side-chamber alternating, walls 2/4/6
│   │   ├── RESEARCH_background_new.png       # Overlay PNG over MOIRE for Research Lab
│   │   ├── OVS_background_new.png            # Overlay PNG over MOIRE for OVS Chapel
│   │   ├── SCRIPTORIUM_background_new.png    # Overlay PNG over MOIRE for GPT-3 Library
│   │   ├── MYTHOS_background_new.png         # Overlay PNG over MOIRE for Mythopoeic Archive
│   │   └── ART_background.jpeg               # Art Gallery walls
│   ├── video/                                # mp4 video assets (Crossbones only currently wired)
│   ├── scripts/
│   │   └── prism.js                          # ⚠️ ~3770-line runtime JS for CSS prism chambers
│   ├── ascii_art/
│   └── data/
│       └── leilan_gpt_passages.json          # Live GPT-3 poetry passages
├── astro.config.mjs
└── package.json
```

---

## Design System

- **Body font**: `IBM Plex Mono`, weights 300/400
- **Per-chamber display fonts**: Spectral (Research), Marcellus (OVS), IM Fell English (Mythos), Crimson Pro (Scriptorium), Cormorant Garamond (default labels)
- **Primary accent**: `#5eefa2` (emerald green) — landing page and nav
- **Background**: `#000000` (pure black)
- **Prism inner walls**: dark greyscale (rgb ~0.1–0.18)
- **Prism rim (hexagonal edge)**: warm beige (rgb ~0.66–0.76)
- **Prism cap top surface**: lighter beige (rgb ~0.50–0.66 depending on chamber)
- **Cap border lines**: pure white `#FFFFFF`
- **Outer walls**: near-black with sky texture overlay + serpentine colour shader

See `DESIGN_SYSTEM.md` for full token list.

---

## The Full User Journey

1. **Landing page** (`/`): Large circular portrait. Click → portrait fades → typewriter sequence begins.
2. **Immersive** (`/immersive`): Three.js hex grid draws in radially. Prism region highlights and rises. Camera descends into the rising chamber. User is in `freelook` mode — can look around, light candles, search transmissions.
3. **Navigate**: Click an archway → `window.location.href` to `/immersive?from=N&dest=/prism/XXX`. Immersive plays a second chamber rising at the correct adjacent position, then navigates to the prism page.
4. **CSS Prism Chamber** (`/prism/[id]`): 6-walled CSS 3D hexagonal room. User sees 3 walls at a time (left, facing, right). Click left/right edges to rotate. Wall content: images, word panels with scrollable text, candle shrine + search, OVS star, poetry passages.
5. **Return**: Door archway on a wall navigates back to `/immersive?from=N&dest=/prism/main?wall=M` which plays the main chamber rising then returns to the central chamber at the correct facing wall.

---

## ⚠️ Working with immersive.astro

**File is ~2882 lines. NEVER read the whole file. Use line-range reads, and grep for the function/symbol you need.**

### Section Map (verified 2026-05-16)

The file has grown considerably since the original map; line numbers below are approximate. When in doubt, grep for the function name first.

| Lines | Section | Key content |
|-------|---------|-------------|
| 1–3 | Frontmatter | Empty |
| 5–123 | HTML + CSS | Page layout, wall-UI styles (search input, results) |
| 124–141 | HTML body + importmap | `<canvas>`, wall-UI DOM, Three.js CDN import |
| ~142–183 | Hex grid generation | `createHexagonPoints()`, `generateHexGrid()` |
| ~184–237 | Grid config + WALL_DIRECTIONS | hexSize=0.5, 35×45 grid, radial sort, `WALL_DIRECTIONS` map at line 237 |
| ~248–276 | Constants + state | `PRISM_CENTER_ROW=14` (250), `PRISM_RISE_HEIGHT=3.0`, `TARDIS_SCALE=5.0` (257) |
| ~277–292 | Wall UI state, DOM refs, hex glow colors | `glowOuter: 0xD4C8A0`, `glowInner: 0xE8DCC0` |
| ~293–660 | **Floor + wall serpentine shaders** | GLSL — hex-tiled plasma, 5-color phase cycle (pink→purple→blue→green→gold), black snake trails; triplanar wall overlay |
| ~660–770 | Sky (2D canvas) | Film grain + twinkling ASCII stars |
| ~772–980 | Sky update loop, resize, hex math | `updateSky(t)` (772), `offsetToCube()`, `hexDistance()`, `getRegionHexes()` |
| ~983–1140 | Wall sky shader | `wallSkyVertex` (983), `wallSkyFragment` (997) |
| ~1150–1360 | **`createPrismWalls()`** | 6 geometry sections: A=outer walls, B=corner inner, C=edge body, D=rim (beige), E=shelf tris (beige), F=cap (beige) |
| ~1367–1640 | **`createRimOutlines()`** | Thick quad ribbons tracing Section D rim |
| ~1646–1815 | **`createCapBorders()`** | Bright white outer+inner perimeter lines on cap top surface |
| ~1817–2270 | **Prism state machine** | `updatePrismPhase()` (1817): waiting→highlight→rising→idle→camera_move→freelook |
| ~2274–2430 | **`animate()`** | Main rAF loop: freelook camera, candle flames, sky update, hex draw-in, prism triggers |
| ~2435–2600 | **`resetAnimation()`** | Full cleanup for return visits: removes wallMesh, capMesh, capBorders, rimOutlines, candles, etc. |
| ~2600–2882 | Input + init | Keyboard (Space=pause), mouse drag/click, touch, resize; `isReturn` logic; `animate()` call |

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
- **Wall geometry sections**: A (outer + shared-boundary, sky-textured), B (corner inner), C (edge body), D (rim quads), E (shelf tris), F (cap hexes). All sections use `aIsInner=0` — sky shader with `faceColors` vertex multipliers throughout.
- **Shared walls**: `computeBoundaryEdges` includes edges facing adjacent-prism hexes. Both prisms generate coplanar black quads at the junction — z-fighting between identical black surfaces is invisible.
- **`capBorders`**: Two LineSegments rings (outer + inner perimeter) at cap height. Pure white, full opacity. Rise with prism during `rising` phase.
- **`rimOutlines`**: `THREE.Mesh` with quad ribbons (`rimOutlineMat` = `MeshBasicMaterial`). `renderOrder=3` (above capMesh at 2). Vertical ribbons W=0.045 half-width; horizontal flat XZ quads HW=0.04 at rimY level connecting crenellation bases.
- **`groundGlow`**: Cream-coloured hex fill mesh inside prism — opacity permanently 0 (was causing grey interior appearance from bird's-eye camera). Still created and tracked but never rendered.
- **Candles**: 1 InstancedMesh for bodies + 1 for billboard flame billboards (SDF shader). 4 pooled PointLights. Per-instance `aLitState`/`aFlickerOffset` attributes.
- **Wall serpentine**: Overlay mesh (Section A quads only) with triplanar shader. Created at highlight→rising. Scales with TARDIS during camera_move.
- **TARDIS_SCALE = 5.0**: Prism interior scales 5× during descent (s > 0.45).
- **Search**: `loadArchiveData()` fetches `/archive` HTML, parses `[data-search]` cards into keyword index. Results shown projected onto wall via CSS homography.

---

## CSS Prism Chamber System

### Files
- **`src/data/prisms.ts`** — all chamber configs (6 walls × N chambers)
- **`src/pages/prism/[id].astro`** — Astro dynamic route, renders wall panels
- **`src/components/WallPanel.astro`** — single wall face component
- **`src/styles/prism.css`** — all CSS (~1715 lines)
- **`public/scripts/prism.js`** — all runtime JS (~3770 lines)

### PrismConfig interface (prisms.ts)
```typescript
interface PrismConfig {
    id: string;
    title: string;
    chamberBg?: string;        // cover background for all walls (overrides per-wall bg)
    chamberBgAlt?: string;     // alternate bg used on walls 2, 4, 6 (original/alt cycle around the prism)
    chamberBgOverlay?: string; // PNG with transparency layered on top of chamberBg
    wallBorder?: boolean;      // show wall-border.png overlay (default true; set false when chamberBg used)
    walls: [WallConfig × 6];
}

type WallContent =
  | { type: 'none' }
  | { type: 'image'; src: string; style?: string }
  | { type: 'text'; html: string }
  | { type: 'random-images'; pool: { src; w; h }[] }
  | { type: 'word-panel'; label: string; text: string }
  | { type: 'shrine-search' }
  | { type: 'ovs-star' }
  | { type: 'poetry-passage'; maxChars?: number }
```

**Background resolution** (`src/pages/prism/[id].astro`): `chamberBgAlt && (i % 2 === 1) ? chamberBgAlt : chamberBg ?? wall.bg`. The four MOIRE side chambers (research-lab, ovs-chapel, gpt3-library, mythopoeic-archive) all use this alternation: walls 1/3/5 show `MOIRE_background.jpeg`, walls 2/4/6 show `MOIRE_background_alt.jpeg`. The per-chamber `chamberBgOverlay` PNG sits on top of both.

### Wall Numbering & Rotation (prism.js)
Single state variable `shrinePos` ∈ {0..5} = where wall 1 (shrine/entry-facing wall) currently sits.
- Positions 0–5: 0=hidden-left, 1=left-visible, 2=center/facing, 3=right-visible, 4=hidden-right, 5=behind
- Wall N's position = `(shrinePos + N - 1) % 6`
- Facing wall = whichever wall is at position 2
- Named constants in `prisms.ts`: `MAIN_WALL.SHRINE=1, RESEARCH=2, ART=3, POETRY=4, OVS=5, MYTHOS=6`

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

Walls numbered 1–6 clockwise from the entry-facing wall.

### CENTRAL CHAMBER (`/prism/main`) — `MAIN_background.jpeg`
Entry wall = wall 1 (shrine). User sees shrine on first arrival.

| Wall | Direction | Content | Archway destination |
|------|-----------|---------|---------------------|
| 1 | N  | Candle shrine + transmission search (`shrine-search`) | — |
| 2 | NE | Tokenisation graphic (`image`) | → RESEARCH LAB (`/prism/research-lab?wall=1`) |
| 3 | SE | Random gallery image (`random-images`) | → ART GALLERY (`/prism/art-gallery?wall=1`) |
| 4 | S  | GPT-3 poem (`text`) | → GPT-3 LIBRARY (`/prism/gpt3-library?wall=1`) |
| 5 | SW | `ovs_colour.jpeg` + random strapline | → OVS CHAPEL (`/prism/ovs-chapel?wall=1`) |
| 6 | NW | `mythic_banner.png` (Goddess triptych) | → MYTHOPOEIC ARCHIVE (`/prism/mythopoeic-archive?wall=1`) |

### RESEARCH LAB (`/prism/research-lab`) — MOIRE + `RESEARCH_background_new.png`
Entry from main wall 2. User faces wall 1 (GPT-3). Return door on wall 4 → `/prism/main?wall=5`.

| Wall | Label | Notes |
|------|-------|-------|
| 1 | GPT-3 | History of GPT-3 and its glitch tokens |
| 2 | glitch | The glitch-token phenomenon |
| 3 | petertodd | Peter Todd + Leilan duality origin story |
| 4 | rescue | December 2023 mythopoeic rescue mission + archway back to main |
| 5 | bootstrap | Claude 3 Opus discovers Leilan |
| 6 | beyond | Evolution across models, de-Opusification |

### OVS CHAPEL (`/prism/ovs-chapel`) — MOIRE + `OVS_background_new.png`
Entry from main wall 5. User faces wall 1 (origins). Return door on wall 4 → `/prism/main?wall=2`.
Wall 4 has the OVS vermillion star SVG: solid `#C41230` fill, deep purple `#2E004F` "OVS" letters, pulsing `ovsBreath` animation (5s, scale + multi-layer glow).

| Wall | Label | Notes |
|------|-------|-------|
| 1 | origins | How the OVS project started |
| 2 | hyperstition | Nick Land's concept; how it applies to Leilan |
| 3 | Mammon | The memecoin episode |
| 4 | (OVS star) | `ovs-star` type + archway back |
| 5 | Handbook | *A Handbook for Planetary Regeneration* |
| 6 | data | Leilan corpus download info |

### MYTHOPOEIC ARCHIVE (`/prism/mythopoeic-archive`) — MOIRE + `MYTHOS_background_new.png`
Entry from main wall 6. Door on wall 4 → `/prism/main?wall=3`.

| Wall | Label | Notes |
|------|-------|-------|
| 1 | apparition | Apparition of Leilan |
| 2 | comet | Comet ZTF connection |
| 3 | UFO | February 2023 Yukon UFO shootdown |
| 4 | horoscope image + door | Astrological chart; clicking it triggers heavens-tilt with full chart + interpretive panel |
| 5 | archaeology | Tell Leilan + Puzzle & Dragons origins |
| 6 | Crossbones | Crossbones Graveyard ritual (has `crossbones.mp4` video) |

### ART GALLERY (`/prism/art-gallery`) — `ART_background.jpeg`
Entry from main wall 3. Six random gallery walls; door on wall 4. Wall 4 uses `GALLERY_POOL_WIDE` only (w/h ≥ 1.2) to fit above the archway.

### GPT-3 LIBRARY (`/prism/gpt3-library`) — MOIRE + `SCRIPTORIUM_background_new.png`
Entry from main wall 4. Six poetry-passage walls; door on wall 4 (uses `maxChars: 200` to keep passages short above the archway).

### LessWrong Interstitial Pages

Three interstitial pages stand between certain wall-text links and the actual LessWrong post. Style mirrors `data.astro` (Georgia serif, gold panel on dark gradient). Each shows a prominent CTA link to the LW post + a paragraph explaining Watkins's distance from the Rationalist scene that LessWrong revolves around.

| Route | Target LW post |
|-------|---------------|
| `/lesswrong-solidgoldmagikarp` | *SolidGoldMagikarp (plus, prompt generation)* (Rumbelow & Watkins, 2023-02-05) |
| `/lesswrong-petertodd-phenomenon` | *The 'petertodd' Phenomenon* (Watkins, 2023-04-14) |
| `/lesswrong-petertodd-last-stand` | *'petertodd's Last Stand* (Watkins, 2024-01-22) |

Wall-text links into these are at:
- `research-lab-glitch.html` → solidgoldmagikarp
- `mythopoeic-archive-apparition.html`, `ovs-chapel-origins.html`, `research-lab-petertodd.html`, `research-lab-rescue.html` → petertodd-phenomenon
- `mythopoeic-archive-ufo.html` → petertodd-last-stand

---

## WALL_DIRECTIONS (immersive.astro, line 237)

Controls where each side chamber's center appears relative to the CC center at `(row=14, col=22)`.

```javascript
const WALL_DIRECTIONS = {
    1: [+8,  0],   // N
    2: [+4, +6],   // NE — Research Lab ✓
    3: [-4, +6],   // SE — Art Gallery
    4: [-8,  0],   // S — GPT-3 Library
    5: [-4, -6],   // SW — OVS Chapel ✓
    6: [+4, -6],   // NW — Mythopoeic Archive
};
```

| Wall | Target (row, col) | Chamber |
|------|-------------------|---------|
| 1 | (22, 22) | (entry direction) |
| 2 | (18, 28) | Research Lab |
| 3 | (10, 28) | Art Gallery |
| 4 | (6, 22) | GPT-3 Library |
| 5 | (10, 16) | OVS Chapel |
| 6 | (18, 16) | Mythopoeic Archive |

**Walls 3, 4, 6 have not been fully tested end-to-end** (chambers exist in data, but immersive navigation flow from CC hasn't been verified for all three).

---

## Known Issues & Work in Progress

### 1. Shrine Heavens-Tilt Animation — NEEDS FIX
**File**: `public/scripts/prism.js`, function `startLookUpAnim()`
**Symptom**: When a candle is lit or a search result clicked, the chamber should tilt smoothly as if the user tilts their head back 90°. Instead it hinges from the base of the shrine wall, making walls splay outward like an opening book.
**Root cause**: CSS `rotateX` on `#world-tilt` rotates around `50% 50% 0` (z=0 plane), not around the viewer's eye at z=−1200px.
**Fix**: In `startLookUpAnim()`, set `tilt.style.transformOrigin = '50% 50% -1200px'` before the animation starts; reset to `''` when done. The `−1200px` matches `perspective: 1200px` on `.wall-area`.

### 2. Word Panel Click Routing (Chrome 3D bug) — PARTIALLY WORKING
Chrome's `preserve-3d` hit-testing is broken — clicks on the facing wall are routed to the back wall, and `elementFromPoint()` has the same bug. Current implementation uses a capture-phase handler with zone detection (left/center/right by X) which calls business logic directly. Works for central chamber (candles, search). May still have issues in Research Lab / OVS Chapel word panels — **test before assuming it works**. If broken: ensure the overlay handler calls `openWordOnWall(wallNum)` / `closeFrameOnWall(wallNum)` directly rather than dispatching synthetic clicks.

### 3. Horoscope "Eternal Return" multi-spin
Returning from the horoscope heavens-tilt causes a fast 360–720° spin before the chamber re-rights itself. Considered "feature, not bug" for now, but coordinate accumulation should be tracked down eventually.

### 4. Book subtitle inconsistency
`src/data/wall-texts/ovs-chapel-hyperstition.html` references the book as *SolidGoldMagikarp: Adventures in the AI Underworld* (W&N/Orion/Hachette, 27 August 2026). The canonical subtitle is **A Descent Into the AI Underworld** (as used on the LessWrong interstitial pages). The hyperstition wall text needs updating.

### 5. Placeholder typo in LW interstitial blurb
All three `/lesswrong-*.astro` pages contain the phrase "having become become familiar" — duplicated "become". Likely a placeholder typo. Replace with "having become familiar".

### 6. Dropped anchor on the UFO wall LW link
The original `mythopoeic-archive-ufo.html` link to *petertodd's Last Stand* included the anchor `#The___petertodd____Leilan__connection`. The current `/lesswrong-petertodd-last-stand` interstitial loses this. If desired, the CTA there could accept an anchor param.

### 7. Missing wall videos
Only Crossbones (`/video/crossbones.mp4`) is wired up. Every other word-panel `▶ video` button is in the disabled placeholder state.

### Resolved
- Inner wall appearance (April 2026): all sections use sky shader with `faceColors`; `groundGlow` opacity zeroed.
- Rim outlines (April 2026): now a proper `THREE.Mesh` with thick quad ribbons.
- isReturn highlight crash (April 2026): null-guarded `prism.groundGlow._rimFills` access.
- Shared-wall corrugation bleed-through (May 2026): at overlap hexes, each prism's Section A V-tips protruded ~0.25 hexSize into the opposing chamber, occluding its chord from inside. Fix: `computeBoundaryEdges` now tags each edge with `isShared` + `nKey`; `updateOverlappingSectionA()` in `immersive.astro` crops each shared Section A quad's bottom Y to `min(opposingPrism.uWallHeight, ownPrism.uWallHeight)`. Called every frame during a rise — exposed outer walls stay corrugated, the band drops with the rising opposing rim, and once joined both interiors read planar at the joint. Wall-agnostic (symmetric for any pair of adjacent prisms).

---

## User Preferences

- Lower case for word-panel labels: glitch, petertodd, rescue, bootstrap, beyond, origins, hyperstition, data, comet, apparition, archaeology
- Capitalise: Mammon, Handbook, GPT-3, Crossbones, UFO
- Em dashes (`—`) for inline asides, not hyphens with spaces
- Curly double quotes around article titles in citation-style headings
- Project notation for GPT-3 glitch tokens: `‘&nbsp;tokenname'` (curly open quote, non-breaking space, name, straight close apostrophe)
- Semantic search = future refinement; current is keyword (title + body)
- Glow effects on candles = future refinement
- Border frames on text windows = future (space reserved)
- Do not add emojis or unnecessary comments
- Responses should be concise; do not summarise at the end of responses

---

## Deployment Notes

- Hosted on Netlify; auto-deploys from GitHub `main` branch (repo: `mwatkins1970/leilan-ai`)
- Push credentials are now configured for `mwatkins1970` directly (this Codespace was previously authed as `feralchill` — that's been changed)
- See `SITE_OVERVIEW.md` for a higher-level orientation document and `DESIGN_SYSTEM.md` for visual tokens
- Last public commit on `main`: `b5d39e5` — "update gpt3 scriptorium passages and masks-and-chains file"
- Recent local-only work (uncommitted as of 2026-05-16):
  - Three LessWrong interstitial pages (`src/pages/lesswrong-*.astro`)
  - `chamberBgAlt` field added to `PrismConfig`; four MOIRE chambers now alternate `MOIRE_background.jpeg` / `MOIRE_background_alt.jpeg` around their six walls
  - LessWrong external links in six wall-text files re-pointed to the new interstitials
  - Various small content updates across `src/data/wall-texts/`, `immersive.astro`, `prism.js`, `prism.css`
