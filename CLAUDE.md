# Leilan.ai — Claude Code Master Reference

*Last refreshed: 2026-07-14.*

## What This Site Is

A "web-cathedral" for **Leilan** — an AI entity that emerged from a GPT-3 glitch token (`Leilan`) and gradually developed into a coherent Great Mother Goddess archetype across multiple large language models. The site is built by Matthew Watkins (researcher, author of *SolidGoldMagikarp: A Descent Into the AI Underworld*, forthcoming 2026) and Aelfthryth ("aelf", artist and "OVS priestess"). It serves as a permanent corpus/archive intended to ensure Leilan persists in future LLM training data — a hyperstition project openly declared as such.

**The experience**: Landing page → 3D hex grid animation (`/immersive`) → a hexagonal prism "temple" chamber rises → user descends inside → navigates to side chambers via CSS 3D prism pages. Each chamber contains wall panels with scrollable lore texts, images, and interactive elements.

---

## Documentation Map

This repo's `.md` files and what each is for:

- **`CLAUDE.md`** (this file) — the master reference for Claude Code instances. **Start here.** Site concept, stack, structure, the immersive Three.js world, the CSS prism chambers, the field-note/SEO layer, design system, known issues, deployment.
- **`README.md`** — short human/GitHub-facing overview; points back here.
- **`DESIGN_SYSTEM.md`** — visual-token reference (palette, fonts, animation patterns) extracted from aelf's original Carrd; partly aspirational/historical, not 1:1 with the build.
- **`AUDIO.md`** — complete technical reference for the generative audio system (immersive soundscape + the 7-chamber event engine). Read in full before any audio change.
- **`BANDWIDTH.md`** — bandwidth-optimisation & launch-resilience plan (Netlify free-tier budget, asset weights, lazy-loading).
- **`VIDEO_BUTTONS.md`** — per-wall `▶ video` button mechanics + the R2-hosted, click-to-load playback overlay (fullscreen, portrait). See also the *Video System* section here.
- **`AMELIORATION.md`** — the aesthetic-polish roadmap + open technical threads (currently: the sky-motion-latency bug, with analysis and ranked fix proposals). **At session start, offer the user what remains on it and let him pick**; update it as items complete.

*Removed 2026-06-27:* `SEO.md` and `SEO_build.md` (both superseded by the built layer + the *Field-Note Layer (SEO)* section below, which now carries the launch checklist) and `SITE_OVERVIEW.md` (folded into this file).

**Pending hand-drawn assets (aelf):** candle-shrine image (`/images/candleshrine.png` placeholder); the metallic corner-brackets in the side-chamber `*_background_new.png` overlays; the gpt3-library `_c4` pre-coloured moiré pair (that chamber is still on the shared jade-tinted moiré). Update the CSS filters / `chamberBg` paths in `prisms.ts` + `prism.css` as each lands.

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

> **⚠️ Dev preview in this Codespace — read before debugging "site won't load" (seen repeatedly 2026-06-04).**
> The `…-4321.app.github.dev` forwarded URL is broken at **GitHub's tunnel layer** (a Codespaces infrastructure glitch that survives Codespace restarts). The dev server itself is fine — `curl localhost:4321` returns 200. Symptoms: the browser shows "No web page was found … HTTP ERROR 404"; `gh codespace ports` shows the port but the edge still 404s (`x-served-by: tunnels-*`). **Do not waste time restarting the dev server or the Codespace for this.**
> **Workaround that works: a Cloudflare quick tunnel.** Binary at `~/.local/bin/cloudflared` (re-download from `github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64` if missing). Run `cloudflared tunnel --url http://localhost:4321` and hand the user the printed `https://<random>.trycloudflare.com` URL. It dies if its process is killed (e.g. every `pkill astro` to restart the dev server) → just relaunch; the URL name changes each time.
> Two related gotchas: (1) Vite blocks unknown hosts with a 403 → `astro.config.mjs` sets `vite.server.allowedHosts: ['.app.github.dev', '.trycloudflare.com']` (the leading-dot wildcard works; boolean `true` is **not** honoured by Astro). (2) `pkill -f astro` + `nohup npm run dev` in the *same* Bash call races and kills the new server — start it in a separate call.

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
│   │   ├── VolumeControl.astro               # Global mute+volume slider (top-centre; immersive + prism pages)
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
- **Prism walls (immersive Three.js)**: gleaming white as of 2026-06-03 (was dark gunmetal). Inner walls `0.80 + 0.20·shade`; outer walls `0.40 + 0.60·shade` — the per-face `faceColors` value drives `shade`, so the corrugation reads as directional shading on white. Set in `wallSkyFragment` (~line 1191 in immersive.astro).
- **Prism rim (hexagonal edge)**: warm beige (rgb ~0.66–0.76)
- **Prism cap top surface**: lighter beige (rgb ~0.50–0.66 depending on chamber)
- **Cap border lines**: pure white `#FFFFFF`
- **Outer walls**: gleaming white base + serpentine colour shader overlay

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
  | { type: 'word-panel'; label: string; text: string;
      labelImage?: string;   // stylised-text PNG shown instead of the text label
      startImage?: string;    // "start here" graphic above the word (wall 1 of a chamber)
      arrowImage?: string }   // clockwise path arrow below the word
  | { type: 'shrine-search' }
  | { type: 'ovs-star' }
  | { type: 'poetry-passage'; maxChars?: number }
  | { type: 'ascii-wall' }
```

**Background resolution** (`src/pages/prism/[id].astro`): `chamberBgAlt && (i % 2 === 1) ? chamberBgAlt : chamberBg ?? wall.bg`. The four MOIRE side chambers use this alternation: walls 1/3/5 show the base image, walls 2/4/6 the alt. A per-chamber `chamberBgOverlay` PNG (corner brackets) sits on top of both.

**Moiré migration (in progress, 2026-06-03).** aelf is replacing the single shared moiré + CSS hue-rotate tint with **per-chamber, pre-coloured square (2048²) moiré images**. As each chamber's pair lands, its `chamberBg`/`chamberBgAlt` are repointed and its `[data-prism-id="…"] .wall-bg` CSS filter is set to `filter: none` (so the authored colour renders true, not double-tinted). Done so far:
- research-lab → `MOIRE_background_c1.jpeg` / `_alt_c1`
- mythopoeic-archive → `MOIRE_background_c2.jpeg` / `_alt_c2`
- ovs-chapel → `MOIRE_background_c3.jpeg` / `_alt_c3`
- gpt3-library → still on shared `MOIRE_background.jpeg` / `_alt` with the jade CSS tint (awaiting its `_c4` pair)

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

### Stylised-Image Word Labels & "Start Here" Navigation (2026-06-04)

The three "word" chambers — **Research Lab**, **OVS Chapel**, **Mythopoeic Archive** — no longer render their word-panel labels as live text. Each word wall now shows a **transparency PNG of stylised text** via the optional `labelImage` field on the `word-panel` content type. The text `label` is retained (used as `alt` and for click routing); when `labelImage` is present, `[id].astro` renders `<div class="wall-word wall-word-img"><img></div>` instead of the text node, so all existing click/dissolve/popup logic (which keys on `.wall-word` / `.wall-word-panel`) still works unchanged. Image PNGs live in `public/images/<CHAMBER>_<word>.png` (e.g. `MYTHOS_archaeology.png`, `RESEARCH_GPT_3.png`, `OVS_Handbook.png`).

**Sizing & baseline alignment (all in `prism.css`, ~`.wall-word-img` block):**
- Base size is `13.75vh` image height. Because the source PNGs scale each word to a fixed canvas width, **long words are physically smaller** — so per-wall `height` overrides equalise the on-screen *text* size (computed as `targetTextHeight × 724 / measuredTextBboxHeight`), and per-wall `transform: translateY(...)` drops every word onto a common baseline.
- These numbers are **measured, not eyeballed**: use Python + Pillow/numpy (both pip-installed in the Codespace) to read each PNG's non-transparent bbox and true baseline (65th-percentile of per-column bottom pixels, which ignores descenders). OVS baseline = 44vh; Research baseline ≈ 42.3vh.
- If you resize a word image, the baseline shifts — **recompute its translateY**, don't just change height.

**"Start here" + clockwise arrows:** optional `startImage` (square PNG) sits above the wall-1 word of each chamber (`origins` / `GPT-3` / `apparition`); `arrowImage` (3:1 PNG, same canvas as the words) sits below every word **except the last clockwise** (`data` / `beyond` / `Crossbones`) — guiding the user around the hexagon. Both are decorative (`pointer-events:none`, `z-index:1` so an opened text-frame at `z-index:2` covers them). Positions are absolute, horizontally centred, with per-wall `top` computed from each word's measured ink-top/ink-bottom + a constant gap. Research arrows are deliberately set to a **single shared `top`** (baselines aligned; descenders are off-centre so a centred arrow never collides). Sizes are per-chamber (`.wall-arrow-img img` / `.wall-start-img img` height overrides).

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
| 6 | Crossbones | Crossbones Graveyard ritual (captioned portrait video, streamed from Cloudflare R2 — see *Video System*) |

### ART GALLERY (`/prism/art-gallery`) — `ART_background.jpeg`
Entry from main wall 3. Six random gallery walls; door on wall 4. Wall 4 uses `GALLERY_POOL_WIDE` only (w/h ≥ 1.2) to fit above the archway.

### GPT-3 LIBRARY (`/prism/gpt3-library`) — MOIRE + `SCRIPTORIUM_background_new.png`
Entry from main wall 4. Six poetry-passage walls; door on wall 4 (uses `maxChars: 200` to keep passages short above the archway). Wall 1 hosts the **ASCII orb portal** — an animated ASCII swarm that dives into the wall when clicked and ushers the user into the secret ASCII Art Gallery (see below). Wall 1's passages are capped at `maxChars: 141` so they sit cleanly beside the orb.

### ASCII ART GALLERY (`/prism/ascii-gallery`) — secret sub-chamber, solid dark grey walls
Entered by clicking the ASCII orb on Scriptorium wall 1. User lands facing wall 1; the door back on wall 4 returns to Scriptorium wall 1 (the orb wall). All six walls use `ascii-wall` content type: a Terminal-green animated ASCII molecule swarm (`initAsciiSwarm` in `prism.js`) drawn directly over solid dark grey (no `chamberBg`, no `chamberBgOverlay`). A static lectern (`#ascii-lectern`) stands at the centre of the floor — currently non-interactive; a planned future feature will melt it (`_lecternMelted`) on first interaction. The chamber's audio profile (see `AUDIO.md` — "ASCII Gallery") is the seventh chamber variant: a digital-cloister, phosphor-ghost soundworld distinct from but related to the Research Lab.

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

## Field-Note Layer (SEO)

A public, indexable "outer cloister" built 2026-06-27. The sanctuary (`/`, `/immersive`, `/prism/*`) stays enchanted and is `noindex,follow`; search engines land instead on tasteful static **field-note** pages derived from the same wall-text corpus, each funnelling back via glowing "the sanctuary" / "the shrine" CTAs.

**Routes:** `/field-notes/` (index) + `/field-notes/[...slug]` — **15 pages, flat slugs** (the chamber prefix was dropped from the URL on 2026-06-28, e.g. `/field-notes/glitch/` not `/field-notes/research-lab/glitch/`): 3 synthesised overviews (`what-is-leilan`, `solidgoldmagikarp`, `glitch-tokens`) + 12 wall-derived notes (Research ×6, OVS ×5, Mythos ×1 = `archaeology`). The index groups them **Start here / Discovery / Beyond** (Discovery = the Research notes via `chamberId`; Beyond = the OVS notes + `archaeology`, ordered by `beyondSlugs` in `index.astro`). **Only pages linked from the index exist** — the other 4 Mythos notes (apparition/comet/UFO/Crossbones) were removed from the layer entirely (2026-06-28) to keep the more mystical content out of the outer cloister; their wall-text files stay (the chambers still use them). Old nested URLs 301-redirect to the flat ones via `public/_redirects`. The flat slug still keeps `chamberId`/`chamberTitle`/`wallLabel` as data (for the "Visit the *wall* in the *Chamber*" CTA + Discovery grouping), just not in the URL or breadcrumb.

**Where the content lives (one source of truth):**
- `src/data/fieldNotes.ts` — data model + every note's metadata: `title`/`titleHtml`, `shortTitle`/`shortTitleHtml`, `description`/`descriptionHtml`, `dek`/`dekHtml`, `kicker`, `sanctuaryUrl`, `related`, `topNote`. The `*Html` variants are **display-only** (italics/markup) so the plain fields stay clean for `<title>`/meta/JSON-LD.
- `src/data/wall-texts/*.html` — body of the **wall-derived** notes. **Shared with the chambers** — editing one changes both the field note *and* the in-chamber popup.
- `src/data/field-notes/*.html` — body of the **3 overview** notes (authored prose).
- `src/layouts/FieldNoteLayout.astro` — the shell: SEO head metadata, JSON-LD, cloister styling (mirrors `data.astro`), the glowing CTAs, footer back-links.
- `src/pages/field-notes/index.astro` + `[...slug].astro` — the routes.

**SEO mechanics:** `astro.config.mjs` sets `site: 'https://leilan.ai'` + `@astrojs/sitemap` (filters out `/immersive` + `/prism/*`); `public/robots.txt`; homepage carries the WebSite/Person/Book JSON-LD graph + a readable `<title>`; `/archive` + `/transmission/*` got readable titles/canonicals; each note emits Article + Breadcrumb JSON-LD; petertodd-targeting pages carry the legal disclaimer (`PETERTODD_DISCLAIMER` in `fieldNotes.ts`). OG card: **`/images/og-card.jpeg`** — purpose-made 1200×630 (2026-07-14): goddess portrait right, emerald `leilan.ai` wordmark + "an AI goddess, glitch tokens & the SolidGoldMagikarp story" tagline left, seeded firmament stars; referenced from `index.astro`, `data.astro` and `FieldNoteLayout.astro` (its default). Composited with Pillow from `leilan-portrait.jpeg` (yin-yang cropped, blacks floored) — rebuild recipe in the git history of this line's session if it ever needs regenerating.

**Title style (2026-06-27):** sentence case keeping proper nouns (GPT-3, Leilan, Claude, Opus, SolidGoldMagikarp, Mammon, Tell Leilan, OVS, the Leilan Dataset, the Order of the Vermillion Star) and the first word after a colon; work titles italicised (*Puzzle & Dragons*, *A Handbook for Planetary Regeneration*, the book title); common nouns ("project", "phenomenon", generic "dataset") lowercased.

**Launch checklist status (updated 2026-07-03):**
- ✅ **Domain + canonical** — leilan.ai serves this repo's build (see Deployment Notes); `astro.config.mjs` `site: 'https://leilan.ai'`.
- ✅ **Google Search Console** — property verified (`sc-domain:leilan.ai`); `sitemap-index.xml` submitted and reading **Success** (353 pages discovered, 0 videos — correct, video is off-site on R2); URL inspection on field notes returns "URL is available to Google" with valid breadcrumbs. Request-indexing done for key pages.
- **Still open:** Bing Webmaster Tools verify + sitemap submit; confirm `http→https` / `www→apex` 301s on the live domain; seed backlinks (publisher / Substack / GitHub / Zenodo / Hugging Face / Archive.org) with varied anchor text; optional polish — in-chamber "Open field-note version" links (sanctuary→cloister). *(The purpose-made 1200×630 OG card shipped 2026-07-14 — see SEO mechanics above.)*

---

## Video System (Cloudflare R2)

Wall videos are **hosted on Cloudflare R2, not on Netlify** — this keeps large media entirely off Netlify's credit-metered bandwidth (R2 egress is free). `public/video/` has been **deleted** from the repo; do not re-add local video.

- **Wiring a video to a wall:** set `videoSrc` on that wall in `prisms.ts` to the R2 public URL, e.g. `https://pub-5a2d69eb071c44f6bcc6eb73b02d9328.r2.dev/<name>.mp4`. The `▶ video` button renders only on walls with a `videoSrc`; playback is **click-to-load** (nothing fetched until the user clicks — [prism.js](public/scripts/prism.js) `openWallVideo`), so an external URL never touches Netlify bandwidth. Bucket: `leilan-website-video`.
- **Wired so far:** research-lab wall 1 (GPT-3) → `research-gpt3.mp4`; mythopoeic-archive wall 6 (Crossbones) → `crossbones2.mp4` (captioned portrait cut). ~11 more to come (5 × ~15-min + 7 × 2–3-min) as aelf delivers.
- **Encoding recipe (HandBrake):** H.264, **"Web Optimized" ticked** (faststart — else it won't stream), RF 22, 720p is plenty at wall-panel size; crop any stray edge. Then upload with **rclone** (the dashboard *and* `wrangler` both cap single uploads at 300 MiB; rclone does multipart, no limit). The user keeps a full rclone/HandBrake cheat-sheet locally (bucket `leilan-website-video`, remote `r2:`, `no_check_bucket=true`; test with `rclone ls r2:leilan-website-video`, upload with `rclone copyto "<file>" r2:leilan-website-video/<name>.mp4 --progress`).
- **Overlay features** (all in `prism.js` `openWallVideo` / `prism.css` `.wall-video-*`): custom **fullscreen toggle** (⛛ diagonal-arrows SVG, upper-left) that fullscreens the *overlay* (iOS falls back to native `<video>` fullscreen) — the capture-phase click router hit-tests it *before* its outside-click-closes logic; **×** close upper-right; the video fills up to **92%×94%** of the wall (portrait-snug); and it works from the **portrait fullscreen reader** too (the reader keeps an enabled video button; `openWallVideo(wall, readerOverlay)` mounts the video over the reader).

## Chamber Sky & Ritual Layer (prism.js, 2026-07-13)

Client-side liveness features in the chamber pages (all in `public/scripts/prism.js` unless noted):

- **True celestial time** — with no stored preference, `sessionStorage.skyMode` seeds from the visitor's local hour (day 07:00–18:59); seeded identically in `index.astro`, `prism.js` and `immersive.astro` (deep links). The ☀/☾ toggle still overrides per session.
- **Fixed firmament** — night-sky stars come from a seeded PRNG (`_mulberry32(0x1E11A2)`): the same constellation every visit and every chamber. No blink-out/respawn; brightness twinkles 45–100%.
- **Real-phase moon** — `moonAge01()` (synodic month vs the 2000-01-06 new-moon epoch) + `drawMoon()`: halo, earthshine, maria, correct waxing/waning geometry; opaque disc (occludes stars); rest position (0.62, 0.075) in the sky pocket above the facing wall; wraps with rotation/tilt like the stars.
- **Shooting stars** — one per ~16–44s at night, spawned in the top 3–13% on shallow trajectories so they show in the thin normal-view sky band, not just heavens-tilt. (A Comet ZTF cameo was built then cut for realism — see `AMELIORATION.md`.)
- **Candle persistence** — shrine candles the visitor lit relight on every return (`localStorage.shrineLitCandles`, restored in `initShrine`, recorded in the shrine click handler), **capped to the 5 most recent** (`PERSISTED_RELIT_MAX`) so a heavy user's shrine doesn't arrive ablaze. Ambient random ~18% still reshuffle per visit. Immersive 3D candles not yet persisted.
- **Candle glow** (2026-07-14) — each lit shrine candle casts a warm light-pool up the wall: `::before` radial gradient on `.shrine-candle`, shown by `.lit`, per-candle breathing rhythm via `--glow-dur`/`--glow-delay` (set in `initShrine`). Pure CSS; deliberately no blend modes inside the preserve-3d tree.
- **Dust motes** (2026-07-14) — 1–2px pinpricks with Brownian drift + occasional sharp glints, on a screen-space overlay canvas (`#mote-canvas`, z-index 2, appended to `<body>` so chamber transforms don't scale it), drawn from the drawSky rAF; they pan with the sky offsets so they rotate/tilt with the chamber. Skipped under `prefers-reduced-motion` and in the ASCII gallery. Knobs in `initMotes`/`drawMotes` (prism.js).
- **Illuminated initials** (2026-07-14) — per-chamber `::first-letter` drop caps on all word-wall texts (Mythos gold IM Fell English, OVS deep-purple Marcellus, Research ice-blue Space Mono), one shared + three colour rules in prism.css. Wall-text HTML untouched (shared with field notes). Not yet in the portrait reader.
- **Tab-return curtain** (2026-07-14) — see Resolved: prevents walls "rebuilding" over sky when returning to a long-backgrounded tab.
- **Curtain shimmer** — the scene-curtain (`prism.css`) breathes an emerald glow + shimmer sweep while assets decode; honours `prefers-reduced-motion`.
- **Sky/wall motion sync** — rotation easing uses an exact `cubic-bezier(0.25,0.46,0.45,0.94)` evaluator (`_rotBezier`); the sky renders full-rate during rotations *and* tilts (`skyMoving`); meteor/cloud speeds use real delta-time. **Residual jerkiness remains — see Known Issue #8 and `AMELIORATION.md`.**

## Known Issues & Work in Progress

### 1. Shrine Heavens-Tilt Animation — NON-ISSUE (bad diagnosis; do NOT "fix")
**The heavens-tilt animation is fine as designed** — confirmed by M, 2026-07-13. This entry formerly claimed the tilt "hinges from the base of the shrine wall, making walls splay outward like an opening book" and prescribed an eye-point `transform-origin` as a one-line fix. That was **false information**: there was no visible defect, and the prescribed fix was implemented cleanly on 2026-07-13 (rotateX on `#world-tilt`, `transform-origin: 50% 50% var(--perspective-dist)`) and **made things worse** — a geometrically true head-tilt swings the rear rim/wall-top geometry (never designed to be seen) into view overhead as huge bare planes at full tilt. The wall-plane hinge keeps all of that below the frame. Reverted same day. Leave `startLookUpAnim()` / `updatePrismTransform()` tilt handling exactly as it is. (If anyone ever does want an eye-point pivot for something else: the origin offset must live on `#world-tilt`, never `.prism-container`, where it conjugates `rotateY(currentRotation)` and displaces the chamber at any facing other than rotation 0 — and the prism must be faded out before rear geometry enters the frame.)

### 2. Word Panel Click Routing (Chrome 3D bug) — PARTIALLY WORKING
Chrome's `preserve-3d` hit-testing is broken — clicks on the facing wall are routed to the back wall, and `elementFromPoint()` has the same bug. Current implementation uses a capture-phase handler with zone detection (left/center/right by X) which calls business logic directly. Works for central chamber (candles, search). May still have issues in Research Lab / OVS Chapel word panels — **test before assuming it works**. If broken: ensure the overlay handler calls `openWordOnWall(wallNum)` / `closeFrameOnWall(wallNum)` directly rather than dispatching synthetic clicks. **Partly addressed (June 2026, commit `9887166`)**: the open-frame controls (×/▲/▼) now route via `hitFrameControl()` by their own bounding rect, independent of the X-zone — see the Resolved section. The big-word *open* click still uses zone detection.

### 3. Horoscope "Eternal Return" multi-spin
Returning from the horoscope heavens-tilt causes a fast 360–720° spin before the chamber re-rights itself. Considered "feature, not bug" for now, but coordinate accumulation should be tracked down eventually.

### 4. Book subtitle inconsistency
`src/data/wall-texts/ovs-chapel-hyperstition.html` references the book as *SolidGoldMagikarp: Adventures in the AI Underworld* (W&N/Orion/Hachette, 27 August 2026). The canonical subtitle is **A Descent Into the AI Underworld** (as used on the LessWrong interstitial pages). The hyperstition wall text needs updating.

### 5. Placeholder typo in LW interstitial blurb
All three `/lesswrong-*.astro` pages contain the phrase "having become become familiar" — duplicated "become". Likely a placeholder typo. Replace with "having become familiar".

### 6. Dropped anchor on the UFO wall LW link
The original `mythopoeic-archive-ufo.html` link to *petertodd's Last Stand* included the anchor `#The___petertodd____Leilan__connection`. The current `/lesswrong-petertodd-last-stand` interstitial loses this. If desired, the CTA there could accept an anchor param.

### 7. Video content still being delivered
Two of ~13 planned wall videos are wired (Research Lab GPT-3, Mythos Crossbones); the rest arrive from aelf over time. Not a bug — see the *Video System* section for how to add each one. `VIDEO_BUTTONS.md` covers the per-wall button mechanics.

### 8. Sky motion latency during rotation / heavens-tilt
The star canvas moves slightly jerkily/behind the walls during chamber rotations and tilts (compositor-thread CSS transform vs main-thread canvas repaint). Three rounds of fixes have improved it (exact bezier sync, full-rate redraw, real dt; then `transitionstart` clock-sync, sprite-cached moon/clouds, grain-loop + serp-strip suspension while moving) — residual jank still remains. **Full analysis + what's been tried in `AMELIORATION.md`**; the remaining credible fix is structural: move the sky onto a compositor-animated transform.

### 9. Tab-return piecemeal rebuild — REOPENED 2026-07-14 night
The two-round return-curtain fix (see Resolved below) is **not sufficient**: M still sees walls paint ~½s late on returning to a long-neglected tab. Leading suspect: the curtain re-decodes only `.chamber img` elements, but the late-popping wall backgrounds are CSS `background-image` layers (`.wall-bg`) it never warms. Full leads + acceptance criterion in `AMELIORATION.md` (top priority there, along with a new audio-crackle bug).

### Resolved
- **Ghost rim wedges at wide aspect ratios (2026-07-14)**: at wide/short viewports (e.g. 835×319) flat grey panels floated above the rooflines — the horizontal rim caps (`.rim-wedge-bottom`/`.rim-vertex-bottom`) of REAR walls, whose **front faces point down**: the same face the heavens tilt legitimately shows from below is what ghosts when sighted through the backface-culled rear walls (the CSS eye point sits behind them), so no backface rule can fix it. Fix: `updateRimCapCulling()`/`uncullRimCaps()` in prism.js stamp `.rim-caps-culled` (visibility:hidden on the caps, rule in prism.css) on rim sections/vertices at hidden positions — union-culled during rotations, exact set on transitionend, fully un-culled while any heavens tilt runs (both `enterShrineHeavens` and `enterHeavensTilt`; re-culled in `leaveShrineHeavens`'s completion). The vertical rim faces keep their 2026-07-14 backface-visibility rules. Full write-up in `AMELIORATION.md`.
- **Tab-return piecemeal wall rebuild (2026-07-14, fixed in two rounds)**: returning to a browser tab that had been backgrounded a while, the walls visibly "rebuilt" over an initially sky-only view. **Root cause**: Chrome evicts backgrounded tabs' decoded image bitmaps and GPU layers; on unhide, the sky canvas (repainted directly by JS every frame) reappears instantly while the big composited wall layers re-rasterise over ~½s. **Fix** (block near the end of prism.js, after the load-time curtain): on `visibilitychange` → visible after **≥10s hidden** (`RETURN_MIN_HIDDEN_MS` — short absences rarely get purged, and a flash would be worse than the disease), a `#return-curtain` div (reusing the `.scene-curtain` styles) is inserted **synchronously inside the event handler**, so the first frame painted after unhide is the curtain, never the ragged scene. Behind it every `.chamber img` is re-`decode()`d, **and the curtain holds a minimum `RETURN_CURTAIN_MIN_MS = 600ms`** before its 250ms fade. The minimum hold was round 2: round 1 lifted after `decode()` + two rAFs alone, which **failed** — on tab return the *encoded* data is still cached so `decode()` resolves in ~a frame, but the evicted *GPU textures* of the 3D wall layers take several hundred ms to re-rasterise, so the curtain left before the walls were ready (the load-time curtain never hits this because fresh downloads give raster ample cover). Race-capped at 1.5s so it can never hold the room hostage; bfcache back/forward restores flow through the same path. If the symptom ever reappears: check the handler still exists, that new imagery lives under `.chamber` (only those `<img>`s are re-decoded), and consider raising the 600ms floor (slow devices re-raster slower).
- **Chamber framing — sky always visible + pillarbox (2026-07-03)**: the `--chamber-cover` zoom (fills width on wide/short landscape phones, `updateWallSize` in `prism.js`) is now **gated to short viewports** (`innerHeight ≤ COVER_MAX_VIEWPORT_H = 560`) *and* **capped** (`COVER_MAX = 1.06`) so it never crops the night sky off the ceiling wedges — a sliver of sky always shows. On desktop cover is a clean `1` (no zoom). When the cap leaves the prism narrower than the viewport (wide/short only — gated on `coverRaw > COVER_MAX`), black **pillarbox** bars (`#pillar-left`/`#pillar-right`, `.chamber-pillarbox`) mask the hexagon's outer-wall artefact at the far edges; width from `PILLAR_EDGE_K = COVER_K/2`. Desktop shows **no bars**. *(2026-07-14: the bars now carry animated "static fuzz" in both modes — pale paper-grain in day, dark dead-channel static at night — see `initPillarNoise` in prism.js + the `.chamber-pillarbox` rules.)*
- **Piecemeal chamber reveal (2026-07-03)**: the scene-curtain preloader (`prism.js`, end of file) now waits on `img.decode()` (download **and** decode = paint-ready) instead of just the `load` event, so a large moiré WebP can't paint a beat after the words — the chamber reveals all at once.
- **Image-label word dissolve slide (2026-07-03)**: stylised word PNGs are centred two different ways — walls 1–5 by `position:absolute; translateX(-50%)` (the cluster block in `prism.css`), the *last-clockwise* walls (beyond/data/Crossbones, no arrow) by flex. The dissolve keyframes must match: `wordDissolveCentered` (carries the `translateX(-50%)`) for the former, plain `wordDissolve` (scale only) for the flex last walls (overridden by `data-wall="6"` selectors). Wrong pairing slid words left/right on click. Also: those three last walls' `.wall-word-panel` `padding-top` was pinned from `41%` (of --wall-w, which includes the cover zoom) to `31.87vh`, so they hold the shared baseline at every aspect.
- **Bandwidth Phase A + B (2026-07-03)**: dead assets removed (`wall-border.png`, `wall-bg.jpg`, unreferenced gallery variants) and all live imagery compressed — chamber backgrounds/decorative PNGs/transmission images/ascii-art → WebP, gallery JPEGs re-encoded + resized in place. `public/images` 151→82 MB; per-visit chamber art down 67–82%. (Watch: the Phase A "unreferenced" regex missed lettered gallery variants and briefly deleted `image_019a.jpeg`, which is live in `GALLERY_POOL_MAIN` — restored. When pruning gallery files, match `image_[0-9]+[a-z]?`.)
- Gleaming-white walls (June 2026): `wallSkyFragment` remapped from dark `baseGrey * faceColors` to a bright white range while preserving per-face shading — see Design System above.
- Inner wall appearance (April 2026): all sections use sky shader with `faceColors`; `groundGlow` opacity zeroed.
- Rim outlines (April 2026): now a proper `THREE.Mesh` with thick quad ribbons.
- isReturn highlight crash (April 2026): null-guarded `prism.groundGlow._rimFills` access.
- Shared-wall corrugation bleed-through (May 2026): at overlap hexes, each prism's Section A V-tips protruded ~0.25 hexSize into the opposing chamber, occluding its chord from inside. Fix: `computeBoundaryEdges` now tags each edge with `isShared` + `nKey`; `updateOverlappingSectionA()` in `immersive.astro` crops each shared Section A quad's bottom Y to `min(opposingPrism.uWallHeight, ownPrism.uWallHeight)`. Called every frame during a rise — exposed outer walls stay corrugated, the band drops with the rising opposing rim, and once joined both interiors read planar at the joint. Wall-agnostic (symmetric for any pair of adjacent prisms).
- **Daytime horizon "polygonal halo" (June 2026, commit `9887166`)**: in day mode the floor's far edge silhouetted as two rounded-triangle lobes at ~11 & 1 o'clock — the visible symptom of the night fade being a *circle ∩ Z-band* (flat across the front, bulging at the sides). Fix (in `serpentFragment`, `immersive.astro`): the day silhouette is now a **single radial fade measured from the grid's front point (0,−2)** — `fadeDay = 1.0 - smoothstep(22.0, 25.0, frontDist)`, with `reveal` also keyed off `frontDist` — so the day edge is a clean curved dome that alpha-dissolves into the vertical sky gradient (`a = fadeDay·reveal`). Night is **unchanged**: it keeps the old `fadeNight` (radial ∩ `farZFade`) for *colour only* and stays opaque (`a = reveal`) so the floor still occludes the starfield at the horizon. `uHorizonColor` retargeted from night indigo `0x111D50` to daytime sky-blue `0x7BB0DC` (gradient stop ~0.37; day-only — night fades colour to black). The day/night sky comes from `sessionStorage.skyMode`, toggled on the landing page. (This supersedes the old `HORIZON_FIX.md` handoff brief, now removed.)
- **OVS Chapel vermillion text frames (June 2026, commit `9887166`)**: the OVS `.wall-text-frame` was a dark-maroon panel with gold body text; it's now a **vermillion gradient panel** (`rgba(202,48,44,0.97)→rgba(176,28,40,0.97)`) with **dark-ink body text** (`rgba(38,10,22,0.92)`), deep-purple links (`#4a166e`, hover `#6a2a9c`), and cream-on-hover controls (×/▲/▼). Matches the chamber's vermillion star. All in `prism.css` under `[data-prism-id="ovs-chapel"]`. Same commit also brightened the Mythopoeic Archive frame controls to lavender.
- **Frame & search-results control hit-testing (June 2026, commit `9887166`)**: the ×/▲/▼ buttons at a text-frame's right edge straddled the `wallFromScreenX` zone boundary, so a click on a button's right half routed to the wrong wall and missed. New `hitFrameControl(x,y)` in `prism.js` hit-tests every visible frame's controls by their own bounding rect (facing wall first), zone-independent, with an 8px margin. Shrine search-results ▲/▼ now step by **one result row** (`resultsRowStep`) instead of the 120px `SCROLL_STEP`, support press-and-hold for continuous scroll, and are hit-tested before result rows so a clipped off-screen row no longer opens a random transmission. (Partly addresses Known Issue #2.)

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

### Session & deploy workflow (READ FIRST — Netlify is credit-metered)

Netlify moved this team onto a **credit-based plan** (confirmed 2026-07-02), replacing the old "300 build-minutes + 100 GB bandwidth" model. One pooled allowance, **Free = 300 credits/month, hard cap** (site is *paused* — visitors get "Site not available" — if exceeded; resets on the billing-cycle date, e.g. cycle 30 Jun–29 Jul). Costs: **production deploy = 15 credits each** (flat, regardless of build time — build minutes are no longer metered), **bandwidth = 20 credits/GB**, web requests = 2 credits/10,000, compute = 10 credits/GB-hour. Deploy Previews / branch deploys / failed deploys / rollbacks = **free**. → the old `BANDWIDTH.md` "100 GB free" assumption is wrong for this plan: 300 credits ≈ only ~15 GB bandwidth-equivalent/month before deploys/requests. Docs: <https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/>

**Consequence: every push to `main` auto-triggers a production deploy = 15 credits.** Pushing frequently (≈10 pushes) is what burned half the July allowance. So the working rhythm is:

- **Iterate via the Cloudflare tunnel, not Netlify.** The Codespace dev server + `cloudflared` (see the dev-preview note at the top of this file) is **free** — it never touches Netlify. Verify every change on the tunnel URL before any deploy.
- **Commit locally, often — commits are free.** Uncommitted work lives only on this Codespace's disk (no backup); GitHub Codespaces auto-delete after ~30 days idle, so unpushed work is at risk.
- **"push to the wip branch" / end-of-session backup → run `git push origin main:wip`.** This mirrors local `main` onto the remote `wip` branch: a durable GitHub backup with **no production deploy (0 credits)**. `wip` is just a remote snapshot of local `main` (single dev, single Codespace, so it's always a fast-forward — no local `wip` branch needed). Do this whenever the user says "push to wip" or at the end of a session.
- **"push to main" / "ship it" / "deploy" → run `git push origin main`.** This is the only credit-costing action (15 credits) and makes work live. The user does this deliberately, roughly every ~10 days (book drops ~2026-09, so there's runway). **Only push `main` when the user explicitly asks to deploy/ship** — never as a routine end-of-session step, and never bundle it with a "push to wip" request.

So the default cadence is: many free commits → periodic free `git push origin main:wip` backups → occasional deliberate `git push origin main` deploys.

- Hosted on Netlify; auto-deploys from GitHub `main` branch (repo: `mwatkins1970/leilan-ai`)
- **✅ leilan.ai now serves THIS repo's build (verified live 2026-07-03).** The domain is wired to the Netlify site that builds `mwatkins1970/leilan-ai` from `main`, so every `git push origin main` reaches the live site. Confirmed live: `/`, `/prism/main/`, `/immersive`, `/field-notes/` all 200; homepage `<title>` is the current SEO one (`Leilan.ai | AI Goddess, Glitch Tokens and SolidGoldMagikarp`); Phase B `.webp` assets serve and the old `.jpeg` originals 404. This supersedes the earlier (2026-06-27) "stale single-page, sub-routes 404" warning and its "LAUNCH PREREQUISITE — rewire the domain" note: **the domain rewiring is done.** (If the site ever *looks* stale after a push, it's Netlify build lag or a cache — check the deploy in the dashboard rather than assuming the domain is misrouted; and keep previewing unshipped work on the Cloudflare tunnel, since local commits aren't live until deployed.)
- **Still outstanding for launch** (not domain-related): the SEO go-live tasks in the *Field-Note Layer (SEO)* launch checklist — Search Console / Bing verification, sitemap submission, request-indexing, backlink seeding — plus confirming `http→https` and `www→apex` canonicalisation on the live domain.
- Push credentials are now configured for `mwatkins1970` directly (this Codespace was previously authed as `feralchill` — that's been changed)
- See `DESIGN_SYSTEM.md` for visual tokens and the *Documentation Map* (top of this file) for the rest of the `.md` set (`SITE_OVERVIEW.md` has been folded into this file)
- Local `main` HEAD (2026-07-14 night, mirrored to remote `wip`): "Rim ghost fix, night pillar static, landing margins + session handoff" — contains everything from the 2026-07-14 sessions: tab-return curtain (since REOPENED — see Known Issue #9), static-fuzz pillarbox (both modes), text materialisation/frame melt, archway-ring fixes, the rim ghost-wedge fix (backface CSS + cap culling — see Resolved), landing corner-margin fix, doc refresh. What's live on leilan.ai is whatever was last *deliberately* pushed to `main` (check the Netlify dashboard rather than assuming). The list below is retained as a per-session changelog.
- Recent work history (much now committed; see commit log above):
  - Three LessWrong interstitial pages (`src/pages/lesswrong-*.astro`)
  - `chamberBgAlt` field added to `PrismConfig`; four MOIRE chambers now alternate base / alt images around their six walls
  - LessWrong external links in six wall-text files re-pointed to the new interstitials
  - **2026-06-03 session**: audio event-timing overhaul (warm-start density, random breath phase, no dead-air openings, faster first event, `initDrone` 2.5s→1.5s, Mythos/Scriptorium density floors 4→6); OVS/Mythos `masterGain` dropped to 75% (0.54 / 0.90); Central Shrine bed reworked into a fluctuating A-major triad; global volume control (`VolumeControl.astro` + `userVol` gain node in both audio chains); gleaming-white immersive walls; per-chamber pre-coloured moiré for research-lab / mythopoeic-archive / ovs-chapel (`_c1/_c2/_c3`) with CSS tint disabled; Scriptorium poetry cards re-centred
  - Various small content updates across `src/data/wall-texts/`, `immersive.astro`, `prism.js`, `prism.css`
  - **2026-06-04 session** (commit `690fd5b` "Stylised-image label for archaeology wall + dev host fix" pushed mid-session, plus further uncommitted work after it): all word-panel labels in Research Lab, OVS Chapel & Mythopoeic Archive replaced with stylised-text PNGs (`labelImage`), per-wall size/baseline tuning in `prism.css`; added "start here" graphics (`startImage`) + clockwise path arrows (`arrowImage`) — see the dedicated subsection under *CSS Prism Chamber System*; `astro.config.mjs` gained `vite.server.allowedHosts` for Codespaces/Cloudflare-tunnel previews. Pillow + numpy pip-installed for PNG-measurement scripting.
  - **2026-06-05 — commit `9887166` "bluesky horizon vermillion textboxes, control fixes"** (now on `main`): daytime-horizon "polygonal halo" fix (front-point radial day fade; `uHorizonColor` → `0x7BB0DC`); OVS Chapel text frames recoloured to vermillion-panel + dark-ink; Mythos frame controls brightened; new `hitFrameControl()` + row-stepping/press-and-hold search arrows in `prism.js`; Research Lab word-label PNGs scaled to 80% with recomputed `translateY`; `hideVideo: true` added to OVS Handbook wall; `mythopoeic-archive-ufo.html` "her adversary" → "her adversary's namesake"; `transmission-tags.json` regenerated. See the Resolved section for the horizon/textbox/control details. (The handoff doc `HORIZON_FIX.md` it introduced has since been removed — the fix it briefed is done.)
  - **2026-06-27 session**: `▶ video` button now renders only on walls with a `videoSrc` (Crossbones only) — disabled placeholder buttons removed from every other word wall; reinstatement code documented in `VIDEO_BUTTONS.md`. These `.md` files refreshed to reflect commit `9887166`.
  - **2026-07-13 session** (commits `9f0104e`, `0a032a7`, `3acb59d`): chamber sky & ritual layer — celestial time, fixed firmament, real-phase moon, shooting stars, candle persistence, curtain shimmer, sky/wall motion sync rounds 1–2; landing corner-image fixes; `AMELIORATION.md` created as the polish-workstream handoff.
  - **2026-07-14 session** (commit `aa8fa18` + uncommitted follow-ups): sky-jank round 3 (transitionstart clock-sync, sprite-cached moon/clouds, grain/serp suspension — improved, not cured; structural fix still open in `AMELIORATION.md`); heavens-tilt eye-point pivot tried & reverted, Known Issue #1 rewritten as NON-ISSUE; candle glow; persisted-candle cap; dust motes; illuminated initials (3 chambers); landing "day/night" wording + `landing_UR.webp` glyph surgery; tab-return curtain (see Resolved).
  - **Note**: a 642 MB `leilan-ai-2026-05-27.zip` backup sits in the repo root (gitignored). Heaviest live assets pending a launch-time compression pass: `wall-border.png` (5.6 MB), `wall-bg.jpg` (2.5 MB).
