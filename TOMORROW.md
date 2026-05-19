# Tomorrow's plan — 2026-05-19

Picking up from a productive session that finished with the cyberpunk ASCII gallery working end-to-end. Today's work is pushed before you start.

## State you're inheriting

- ASCII gallery chamber (`/prism/ascii-gallery`) is live: dark walls, six pre-rendered green ASCII swarms (one per wall, each a different algorithm), cylindrical lectern with sloping plate (rotated 180° so the back faces the entry).
- Pre-rendered swarms live in [public/data/ascii-swarms.json](public/data/ascii-swarms.json) (~1.4 MB raw, gzips well). Regenerate with `node scripts/gen-ascii-swarms.mjs`.
- Door wall 4 ↔ Scriptorium navigation works; returning lands user facing wall 4 of Scriptorium with the orb door behind them.
- Lectern is centered, post is cylindrical (4 rotated faces + back-face visibility), plate has real 3D thickness via `::after` translateZ underside.

The dev server may need a kick: `npm run dev` (now binds `--host` permanently in `package.json`). If the Codespaces forwarded URL 404s, the issue is always Astro binding to `[::1]` only — see [HANDOVER.md](HANDOVER.md) for the full diagnosis.

---

## Priority 1 — Lectern interaction (the big one)

Make the lectern's open book display a miniature ASCII art piece. Clicking it (when facing) launches a cinematic zoom that brings the artwork to full-screen.

### Pool & mini display

ASCII art pool: 51 JPEGs in [public/ascii_art/](public/ascii_art/) — `ASCII_001.jpeg` through `ASCII_051.jpeg`. (They're rendered JPEG, not text.)

Replace the current placeholder content of `.ascii-lectern-page` (a hardcoded mini-glyph in [public/scripts/prism.js](public/scripts/prism.js) `initAsciiLecternPage`) with an `<img>` showing a random pool image, scaled to fit the book area. Drop the existing static glyph entirely.

New image is picked when:
- The lectern rotates **out of view** (i.e., when no wall containing it is at position 2/center) — detect via the existing rotation handlers in `prism.js`.
- The zoom-in animation **completes** and the user has returned.

Track current pick in a module-scoped `let _currentLecternArt = null` so it doesn't change mid-view.

### Click-to-zoom cinematic

The pattern to copy: the **shrine heavens-tilt** and the **horoscope tilt** in [public/scripts/prism.js](public/scripts/prism.js). Search for `heavensTilt`, `shrine-heavens-active`, `startLookUpAnim`. Both work by:
1. Applying a `rotateX` transform to `#world-tilt` (the parent of `.prism-container`).
2. Fading in a full-screen overlay that the user "looks up into."
3. Locking nav controls while the overlay is active.

For the lectern: instead of tilting back to a sky, the camera **swoops forward + down** onto the lectern plate. The plate scales up via `scale()` and `translateZ(positive)` until it fills the screen. The book image inside cross-fades to a full-resolution version.

Approach:
- Add a `body.lectern-zoomed` class (mirrors `body.shrine-heavens-active` pattern).
- Add a `#lectern-zoom-overlay` div that fades in to display the full-size ASCII art.
- Animation: `.ascii-lectern` gets a transform that pushes it forward in Z and scales it ~6×, over ~1.2s with an ease-in-out cubic.
- Hit-test: the lectern is inside the 3D `preserve-3d` container, so the same Chrome `elementFromPoint` bug from the orb applies. Add a capture-phase document handler that checks click coords against the lectern's bounding rect when `getFacingWall() === 1`. See `hitTestAsciiOrb` (around [public/scripts/prism.js:2998](public/scripts/prism.js#L2998)) for the pattern.

### Return mechanism (no boring close-X)

Two ideas Matthew floated:
- Click anywhere outside the zoomed image → smooth zoom-back-out (reverses the swoop).
- Scroll/swipe down → drops the image and returns.
- Or: the image "drifts back" automatically after N seconds of no interaction.

Pick one (or combine) — Matthew wants imaginative. If unsure, ask before implementing.

### Sliding magnifier for huge pieces

Some ASCII art is large. When zoomed to full-screen, if the image is wider/taller than the viewport, allow:
- Click+drag to pan around the image.
- A floating magnifier "lens" that follows the cursor and shows a 2× zoomed region.

Probably worth a separate session — get the basic zoom working first.

### Files to touch
- [public/scripts/prism.js](public/scripts/prism.js) — `initAsciiLecternPage` rework, new `triggerLecternZoom`, `hitTestLectern`, lectern art rotation logic
- [src/styles/prism.css](src/styles/prism.css) — `.lectern-zoomed`, `#lectern-zoom-overlay`, lectern transform when zoomed
- [src/pages/prism/[id].astro](src/pages/prism/[id].astro) — replace `<pre class="ascii-lectern-page">` with an `<img>` element

---

## Priority 2 — Camera dive for ALL rising chambers

In [src/pages/immersive.astro](src/pages/immersive.astro), the central chamber gets a cinematic camera dive (the TARDIS-scale 5× zoom-through) during its `camera_move` phase. Side chambers and the ASCII gallery don't — they just rise, idle, fade to black.

Matthew wants every rising chamber to get the camera dive.

### The mechanism today

State machine in `updatePrismPhase` (around [src/pages/immersive.astro:1903](src/pages/immersive.astro#L1903)). The flow is `waiting → highlight → rising → idle → camera_move → freelook`. The `isSecond=true` argument (passed for the entering prism on `isReturn` visits) **skips `camera_move`** and goes straight from idle to fade-to-black at [src/pages/immersive.astro:2486](src/pages/immersive.astro#L2486). That's the gate to flip.

Constants: `TARDIS_SCALE = 5.0`, `CAMERA_DURATION = 12.0`. The `camera_move` case handles scale + position + roof dissolve.

### What needs changing

1. Make the entering prism (side chambers + ASCII gallery) go through `camera_move` instead of fading to black at idle.
2. Calculate the camera trajectory for non-central chambers. Currently the camera dives toward `prism1.centerXZ` (the central chamber). For an entering prism, the target should be `enteringPrism.centerXZ`.
3. The `roof dissolve` (cap hexes shrinking from center outward) uses `prism1` references — needs to be parameterized to operate on the entering prism's cap.
4. Fade-to-black at end of `camera_move` already exists for prism1 — should work the same for the entering prism if 1 + 2 + 3 hold.

### Gotchas
- For the ASCII gallery (off-grid centre at row -2), the camera target is below the visible horizon. The dive trajectory needs to either (a) point at the chamber's *cap* height (PRISM_RISE_HEIGHT = 3.0) not the centre, or (b) lift the chamber slightly so the dive lands in frame.
- The `_tardisScale` published on the prism feeds the floor's serpentine shader for un-scaling — make sure every dive sets this on the *active* prism, not just prism1.

### Files to touch
- [src/pages/immersive.astro](src/pages/immersive.astro) — `updatePrismPhase`, the `camera_move` case, the idle-to-fade transition

This is a bigger refactor than Priority 1. Plan it carefully — likely worth using `Plan` agent to map the changes first.

---

## Priority 3 — Lectern skin variants

Cyberpunk styling experiments. Same geometry (cylindrical post + tilted slab + base + book), different visual treatment. Some directions:

- **Neon edge-glow**: ditch the warm gold gradient for matte black with electric-pink/cyan edges (CSS `box-shadow` + glowing borders).
- **Holographic**: subtle prismatic gradient on the plate surface, scanline overlay, light flicker.
- **Etched/wireframe**: thin green wireframe construction, no fill — like a Tron lectern.
- **Brutalist**: solid concrete-grey with hard shadows, no gradients.

All driven by CSS. The current "warm gold lectern" styles live in [src/styles/prism.css:1668-1745](src/styles/prism.css) (`.ascii-lectern`, `.ascii-lectern-base`, `.ascii-lectern-column*`, `.ascii-lectern-top*`).

Easiest path: extract the gold styles into a `[data-lectern-skin="gold"]` block, add `[data-lectern-skin="neon"]` / `"holo"` / etc. Toggle via a class on `.ascii-lectern` and let Matthew preview them.

Probably worth doing **after** Priority 1 is solid, since the click-to-zoom may shape what the lectern needs to look like visually.

---

## Later — Audio rework

Matthew flagged this for after the lectern is working nicely. Don't start it tomorrow unless explicitly asked. Current state: drone fade-out on archway exit (`fadeOutDrone(2.0)` in `enterArchway`), no per-chamber soundscape. Open question: ambient layer per chamber? Triggered SFX on lectern zoom? Worth a focused planning conversation when Matthew is ready.

---

## Quick orientation cheat-sheet

- ASCII gallery prism config: [src/data/prisms.ts:412](src/data/prisms.ts#L412)
- Lectern markup: [src/pages/prism/[id].astro:301](src/pages/prism/[id].astro#L301)
- Lectern CSS: [src/styles/prism.css:1668](src/styles/prism.css) (search `ascii-lectern`)
- Swarm player: [public/scripts/prism.js:3068](public/scripts/prism.js) (search `initAsciiSwarmPlayer`)
- Swarm generator: [scripts/gen-ascii-swarms.mjs](scripts/gen-ascii-swarms.mjs)
- Camera-dive state machine: [src/pages/immersive.astro:1903](src/pages/immersive.astro#L1903) (`updatePrismPhase`)
- ASCII art pool: [public/ascii_art/](public/ascii_art/) — 51 JPEGs

Read [CLAUDE.md](CLAUDE.md) for the broader site mental model. [HANDOVER.md](HANDOVER.md) covers the ASCII gallery's original design intent. Both are current.
