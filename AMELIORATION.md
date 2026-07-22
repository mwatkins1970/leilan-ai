# AMELIORATION.md — aesthetic upgrade roadmap + open technical threads

*Created 2026-07-13 (Fable 5 session); last updated 2026-07-20. Audience: the next Claude instance working on this repo.*

**How to use this file:** at the start of a session, offer the user (Matthew, "M")
whatever remains on this list and ask what he wants to work on — he picks, you don't.
As items get done, update this file (move them to *Done*, prune dead ideas, add new
threads). This file is the between-sessions memory for the *polish* workstream;
CLAUDE.md remains the master reference for how the site works.

---

## 🟡 AWAITING M's CONFIRMATION: tab-return piecemeal rebuild, round 3 (2026-07-20)

**Reported by M 2026-07-14 night, despite the two-round tab-return curtain fix
(see CLAUDE.md Resolved — was reopened).** When a chamber tab is neglected for
a while (other tabs used), returning to it shows the page rebuilding
piecemeal: **notably the background wall images take ~half a second to paint**
after the rest. M's acceptance criterion: the page should appear **all at
once**, even at the cost of a longer all-black (or black-shimmer) hold.

**Lead #1 was checked and is false.** `.wall-bg` is an `<img>` (`WallPanel.astro`
line 21), not a CSS `background-image` — nested under `.chamber`, so it was
already covered by the existing `document.querySelectorAll('.chamber img')`
sweep. Nothing to fix there.

**Round 3 fix (applied, not yet M-confirmed)**, targeting lead #2: the flat
`RETURN_CURTAIN_MIN_MS` hold has no way to know whether the compositor has
actually finished re-rasterising the big transformed 3D wall layers — it's
just a guess, and 600ms can be fine on one machine and short on another. In
`public/scripts/prism.js`, same block (search `ROUND 3`):
- Floor raised 600ms → 900ms (cheap insurance either way).
- Replaced the flat wait *after* the floor with an adaptive settle check:
  sample `requestAnimationFrame` deltas, require 4 consecutive frames ≤20ms
  (heavy re-raster shows up as slow/dropped frames) before trusting the scene
  is ready — capped at 1400ms on top of the floor so a slow device still
  can't hold the room hostage indefinitely. Worst case ≈2.3s hold, which
  matches M's stated preference for a longer hold over a ragged reveal.

Lead #3 (verify the handler fires at all for his pattern — bfcache restores,
whether `visibilitychange` fires) is still unverified; only M's hardware can
settle it. **Test recipe unchanged**: open a chamber → background the tab for
several minutes of active use elsewhere → return; M's eye is ground truth.
If round 3 doesn't fix it, the settle heuristic itself (not just its
constants) is the next thing to question — rAF timing during a GPU-bound
re-raster may not degrade as cleanly as assumed.

---

## ✅ RESOLVED (M-confirmed 2026-07-20): audio static crackle every few seconds

**Reported by M 2026-07-14 night; fixed and confirmed 2026-07-20.** Root cause
was sum clipping — the event engine's `master` bus (droplet clusters, shimmer
bursts, bell/wash accents, bed, reverb return) had no `DynamicsCompressorNode`
anywhere in the chain, so simultaneous voices could transiently exceed 1.0 and
clip at the browser's device-output stage, downstream of `userVol` (which is
why the site's own volume slider removed it but system volume didn't — first
hypothesis in the list below, confirmed). Fix: a fast, high-ratio compressor
inserted between `master` and `fade` in `_initEventEngine` (`prism.js` ~line
6118). Full incident writeup, headroom math and the exact params are in
`AUDIO.md` → Part 7: Incident Log. M confirmed clean on OVS Chapel (the
densest/highest-gain chamber) via the Cloudflare tunnel.

---

## ✅ RESOLVED (M-confirmed 2026-07-14): ghost rim wedges at wide aspect ratios

**Fixed and confirmed by M's eye on the tunnel at his ratio.**

### What it turned out to be
Both of the previous session's readings were true at once: M's tunnel WAS
serving stale CSS (his day-mode pillar bars were black), **and** the ghosts
are real and survive fresh CSS. With a restarted dev server + fresh tunnel,
the fuzz canary passed headlessly and the ghost triangles were still there
at 835×319 — so Attempt 2 (per-face backface culling) was verified
insufficient, for a geometric reason nobody had spotted:

**The horizontal caps' FRONT faces point DOWN.** Working the `rotateX`
matrices (and confirming empirically): the from-below view the heavens tilt
needs and the from-outside-behind ghost view above the rooflines are **the
same face** of `.rim-wedge-bottom`/`.rim-vertex-bottom` — the rear sections'
cap undersides sighted through the backface-culled rear walls (the CSS eye
point sits behind them). No backface rule can ever split those two views;
the distinction is *which wall*, not *which face*. Per-surface diagnosis
(hide-one-class-and-diff, headless) pinned the floating corner triangles to
exactly these caps; the vertical-face backface rules from Attempt 2 are
correct and retained.

### The fix (in the tree)
Attempt 1's idea, but **caps-only + heavens-gated** — it cannot gap-tooth
the tilt ring the way whole-section hiding did, because the vertical
crenellation faces are never culled and the caps un-cull for the tilt:
- `updateRimCapCulling(unionWithShrinePos?)` + `uncullRimCaps()` in prism.js
  (where the Attempt-1 comment sat, near `isWallVisible`): stamps
  `.rim-caps-culled` on `.rim-section`s whose wall is at a hidden position
  {0,4,5} and on `.rim-vertex`es where either adjacent wall is hidden
  (vertex k bridges walls k, k+1). Optional arg = union-culling with the
  pre-rotation shrinePos.
- CSS (prism.css, after `.rim-vertex-bottom`): `.rim-caps-culled` hides the
  two cap classes via `visibility: hidden`.
- Hooks: init rAF; `lookLeft`/`lookRight`/`rotateToWall` union-cull at
  rotation start, `transitionend` sets the exact set; `enterShrineHeavens` +
  `enterHeavensTilt` un-cull everything just before `startLookUpAnim`;
  `leaveShrineHeavens`'s tilt-down completion re-culls. `updateRimCapCulling`
  no-ops while `shrine-heavens-active` is on `<body>` (so the `afterRotation`
  call inside `leaveShrineHeavens`'s snap can't re-cull mid-tilt).

### Headless verification (all passed, no JS errors)
835×319 + 658×301, day + night: corners clean on load, after rotation, and
after tilt-return; cull set tracked correctly through lookLeft (union → exact);
candle heavens tilt (real `triggerShrineTransmissionFromCandle` path) and the
mythopoeic-archive horoscope tilt (`enterHeavensTilt(4)`) both show the
complete ceiling ring (culled 7 → 0 during tilt → 7 after).

### Commit state
All of the above (plus the earlier session's static-fuzz pillarbox, text
materialisation + frame melt-away, tab-return curtain round 2, archway-ring
fixes) was committed and mirrored to remote `wip` at the end of the
2026-07-14 night session — no production deploy; leilan.ai still serves the
last deliberate `main` push.

---

## 🟡 AWAITING M's CONFIRMATION: sky motion latency, round 4 — night rotation (2026-07-22)

**Symptom:** when the chamber rotates (left/right arrows) or tilts back
(shrine/horoscope heavens), the night-sky canvas (stars/moon) moves in the right
direction but **slightly jerkily and with a perceived delay** relative to the walls.
The walls glide; the sky stutters behind them. M finds it off-putting; three rounds of
fixes had improved but not cured it (see below) — round 4 is the structural fix,
scoped down to a first slice per M's "small steps" request.

### Architecture (why this happens at all)

- The **walls** move on the **compositor thread**: `.prism-container` gets a CSS
  `transition: transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)` (rotation), or a
  JS rAF driving `updatePrismTransform()` (tilt, `startLookUpAnim`-style, ~prism.js
  line 770–800). GPU-composited transforms stay smooth even when the main thread hiccups.
- The **sky** is a 2D `<canvas>` (`drawSky`, prism.js ~line 2050+) repainted on the
  **main thread** every frame. Star positions are offset by `skyRotationOffset`
  (animated by `tickSkyRotation()` against `SKY_ROT_DURATION = 800`) and
  `skyTiltOffset` (written directly by the tilt rAF).
- So walls and sky are animated by **two different clocks on two different threads**.
  Any main-thread jank (style/layout work during the transition, GC, the draw cost of
  the sky itself) freezes the stars for a frame while the walls keep gliding.
  That divergence is the jerk.

### Already tried (improved but insufficient)

**Round 1–2 (2026-07-13, earlier session):**

1. **Exact easing match** — replaced the old piecewise-quadratic approximation in
   `tickSkyRotation()` with a true Newton–Raphson `cubic-bezier(0.25,0.46,0.45,0.94)`
   evaluator (`_rotBezier`). Fixed the systematic lag at rotation start.
2. **Full-rate redraw during tilt** — `drawSky` frame-skipped to 20fps unless a
   *rotation* was active; it now also renders every frame while `_skyAnimFrame`
   (the tilt driver) is non-null (`skyMoving` flag).
3. **Real delta-time** — meteor/cloud motion now uses measured elapsed time, not a
   fixed dt, so speeds are correct at 20 and 60fps.

**Round 3 (2026-07-13, later session) — the two "cheap" proposals + one new find,
all implemented, verified working headlessly (no JS errors, sprites render
correctly), but M reports the jerkiness is NOT cured:**

4. **Clock sync via `transitionstart`** — `_skyRotT0` was seeded when
   `animateSkyRotation()` ran, but the walls' CSS transition only starts when the
   browser commits the style change, a frame or two later. The sky now holds still
   (`_skyRotWaiting`) until a `transitionstart` event from `.prism-container`
   (target + `propertyName === 'transform'` guarded) re-seeds `_skyRotT0` with
   `e.timeStamp`; 120ms fallback if the event never fires.
5. **Per-frame draw-cost cuts** — film-grain noise loop (200 random `fillRect`s)
   skipped while `skyMoving`; per-star font/rgba-prefix strings precomputed once
   (`s.font`, `s.colPre`); moon cached to an offscreen sprite (`moonSprite()`,
   rebuilt only on resize/phase/dpr change); day clouds pre-rendered to per-cloud
   sprites (`cloudSprite()`) instead of 3–5 fresh radial gradients each per frame.
6. **Serpentine-strip suspension** — `renderSerpStrip` writes CSS custom properties
   onto `#wall-area` every 6th frame (style invalidation on the transitioning tree)
   + rebuilds an SVG gradient; now suspended while `skyMoving`.

**Conclusion so far:** timing precision and main-thread cost have both been
addressed and the stutter survives — which points at the *architecture itself*
(canvas repaint can never be frame-locked to a compositor transition from the main
thread). The structural proposal below is the remaining credible fix.

### Round 4 (2026-07-22): the structural fix, night-mode rotation only

**Implemented, build-verified and Playwright-verified, not yet M-confirmed on
real hardware** (this bug lives in main-thread-jank territory that headless
Chromium in a Codespace can't reproduce the way M's actual device does — his
eye on the tunnel is still the ground truth, same as every other round).

Per M's "small steps" request, this slice covers **only** night-mode wall
ROTATION (not tilt, not heavens-tilt, not day-mode clouds) — the case that's
architecturally the worst offender (a real CSS-transition-driven compositor
animation for the walls vs. a JS-clock-tweened canvas repaint for the sky;
tilt, by contrast, already drives both walls and sky from the same rAF, so
it's less structurally broken even if some jank remains there too).

**What changed** (`public/scripts/prism.js`, search `2026-07-22` /
`star-layer`): a new `#star-layer-canvas`, 3× viewport width, pre-painted
with 3 side-by-side lap-copies of the starfield + moon. Its CSS `transform`
uses the *exact same* `transition: transform 0.8s cubic-bezier(0.25, 0.46,
0.45, 0.94)` as `.prism-container`, driven by a new `bumpStarLayerRotation
(delta)` called at the same three sites as `animateSkyRotation`
(`lookRight`/`lookLeft`/`rotateToWall`) — so the browser interpolates both
in lockstep on the compositor thread, with zero JS involved during the
0.8s animation itself. Twinkle still repaints the tile pixels in place at
the old throttle (suspended during motion, like the grain/serp work
already was) since repainting doesn't require moving anything mid-tile.
The offset counter is unbounded like `currentRotation` (Known Issue #3's
old failure mode) but self-rebases by exactly one lap on `transitionend`
once it drifts past half a tile, using the *same* two-reflow instant-snap
technique as the Eternal Return fix — verified over 15+ consecutive
rotations with no drift, no out-of-range reveals, no errors.

Heavens-tilt and the separate `isSkyView` full-sky entry mode are
**unchanged** — they still use the original per-frame JS-drawn stars
(rotation can't happen while either is active, so the two layers never
need to animate at once; `drawSky`'s `useStarLayer` check just swaps which
one is visible, verified working in both directions). Day mode is
untouched — the new layer only ever activates at night in normal chamber
view.

**Verification done this session:** headless Playwright — no console/page
errors across day mode, 15+ night rotations, and a full heavens-tilt
enter/leave cycle on the main chamber; screenshots confirm stars + moon
visibly pan with the walls at rest and mid-rotation, no gaps or artifacts.
**Not yet checked:** whether this actually *reads as smoother* on M's
hardware — that's the whole point of the fix and headless Chromium can't
judge it.

### Proposals remaining (tilt + day mode), in recommended order

1. **Extend the round-4 approach to tilt.** Same idea, but the star-layer
   canvas would need vertical tile duplication too (tilt pans up to 0.7 of
   the viewport height and, unlike rotation, isn't wrapped/unbounded — it
   always returns to 0 — so no rebase logic needed, just enough vertical
   canvas to cover the excursion without redrawing).
2. **Extend to day-mode clouds**, if rotation jank is still perceptible
   there once M's confirmed the night-mode slice.
3. **Alternative structural (if the above prove awkward): one clock for
   everything.** Drop the CSS transition for wall rotation and drive the
   container transform AND `skyRotationOffset` from a single rAF (tilt
   already works this way). Guarantees zero divergence but makes the walls
   main-thread-hostage too.

**Verification tip:** `playwright` + headless chromium are already installed in this
Codespace (`npm i --no-save playwright`, so not in package.json; re-install after a
rebuild). Record a rotation via CDP screencast or compare frame captures; also just
ask M — his eye caught what my static screenshots couldn't.

---

## 🎨 REMAINING AESTHETIC ROADMAP (offer these at session start)

**M's agreed order (2026-07-14):** text materialisation → day-mode pillarbox →
Eternal Return spin → sky-motion structural fix (the big one, start it fresh at
the top of a session).

### Motion & thresholds (the "seamless dream" tier)

- ~~**Fix the heavens-tilt hinge**~~ — **NON-ISSUE, do not revisit (2026-07-13).**
  Known Issue #1 was bad information: M confirms the tilt animation was fine all
  along. The prescribed eye-point pivot was nonetheless implemented (rotateX on
  `#world-tilt`, `transform-origin: 50% 50% var(--perspective-dist)`) and made
  things WORSE — at full tilt it swings the rear rim/wall-top geometry (never
  designed to be seen) into view overhead as huge bare planes. Reverted same
  day. CLAUDE.md Known Issue #1 rewritten as NON-ISSUE with the details.
- ~~**Tame the Eternal Return spin**~~ — **DONE 2026-07-20, M-confirmed.** Was a
  real bug, not a feature: `currentRotation` drifts unbounded (never wrapped
  mod 360) across a session, and `leaveShrineHeavens()`'s instant-snap-back
  was missing a forced reflow between the transform write and re-enabling the
  transition, letting the browser coalesce the two and animate the raw drift
  as a multi-turn spin. Fixed with a second reflow. Full root-cause writeup
  moved to CLAUDE.md's Resolved section (was Known Issue #3).
- ~~**Text materialisation**~~ — **DONE 2026-07-14**, both directions: on open,
  paragraphs bloom in staggered (0.42s rise+fade each, ~80ms stagger, capped at
  8 slots — nth-child rules after `frameFadeIn` in prism.css); on close (any
  route — all funnel through `closeFrameOnWall`), the frame **melts away**:
  opacity-only fade on the frame (its base transform differs per chamber — a
  transform keyframe would snap it, the wordDissolve-slide trap) while the
  body/controls sag downward. `FRAME_MELT_MS` in prism.js must match the CSS
  duration. Both honour reduced-motion.

### Edges & completeness (the "no seams anywhere" tier)

- ~~**Day-mode pillarbox**~~ — **DONE 2026-07-14, extended to night next
  session**: the bars carry animated "static fuzz" in BOTH modes — day a pale
  paper-grain (`--pillar-noise`, `body.day-mode .chamber-pillarbox`), night a
  dark dead-channel static (`--pillar-noise-night`, base `.chamber-pillarbox`
  rule; near-black base 18 with sparse +34 glints) after M flagged that black
  night bars still read as letterboxing beside the lit walls. Three 96px tiles
  per palette from `initPillarNoise` (prism.js), cycled ~9fps, only the active
  mode's property written per tick; gated on bars-exist + tab-visible;
  reduced-motion gets one static frame.

---

## ✅ DONE (2026-07-14 night session, M-confirmed)

- **Rim ghost wedges** — see the RESOLVED section above.
- **Night pillarbox static** — see the updated day-mode pillarbox entry below;
  first cut (base 18) was invisible at 1:1, shipped at base 58 / `#383f46`.
- **Landing corner margin symmetry** — the UL menu glyph sat 6px (1.9%) from
  the left edge vs the UR moon cluster's 22px (6.15%) right inset. Menu glyph
  shifted 14px right inside `landing_UL.webp` (lossless glyph surgery, same
  method as the UR edit; pristine original in git history); both margins now
  6.15% of the rendered width. Click + hover-tooltip hit zones updated in
  `index.astro` (menu zone x 0→0.02, 0.18→0.23); sidebar-open verified.
  Phone `_top` variant has no menu glyph — untouched.

## ✅ DONE (2026-07-14 session — the whole "material & light" tier, commit `aa8fa18` + follow-ups)

- **Candle glow on the shrine wall** — every lit candle casts a warm light-pool up
  the wall: a `::before` radial gradient on `.shrine-candle` shown by the existing
  `.lit` class (so it follows clicks, ambient and persistence for free), each
  breathing on its own randomised rhythm (`--glow-dur`/`--glow-delay` set in
  `initShrine`). No blend modes (Chrome preserve-3d + blends is untrustworthy).
  Knobs: the gradient in the `.shrine-candle::before` rule (prism.css).
- **Persisted-candle relight cap** — the persisted set grows monotonically (every
  candle ever clicked), so a devoted pilgrim arrived to a shrine ablaze. Only the
  **5 most recent** relight now (`PERSISTED_RELIT_MAX` in `initShrine`); the full
  history stays in localStorage.
- **Dust motes** — 1–2px hard pinpricks on a screen-space overlay canvas
  (`#mote-canvas`, z-index 2, created in prism.js), Brownian-jittered drift with
  occasional sharp glints (pow-envelope) rather than constant glow; they pan with
  `skyRotationOffset`/`skyTiltOffset` so the dust belongs to the chamber, not the
  glass. Drawn from the drawSky rAF. Skipped under `prefers-reduced-motion` and in
  the ASCII gallery. First version (big soft glowy orbs) was rejected — keep them
  tiny, sharp, glinting. Knobs: density `/36000`, `s:`, `a:`, `aS:` in `initMotes`.
- **Illuminated initials** — per-chamber `::first-letter` drop caps on every
  word-wall text (full 3.3em size): Mythos = gold IM Fell English w/ candle bloom,
  OVS = deep vermillion-star purple Marcellus, Research = phosphor ice-blue Space
  Mono. One shared rule + three colour rules in prism.css. Wall-text HTML untouched
  (shared with field notes). Not yet in the portrait/fullscreen reader (clones text
  outside the wall panel) — possible follow-up, as are field-note drop caps.
- **Landing "day/night"** — tooltip/alt/aria all unified to "toggle day/night", and
  `landing_UR.webp` itself edited by glyph surgery (day+ight blocks transplanted,
  n rebuilt from h with synthesised edging matched to measured glyph-outline stats,
  / drawn to stroke weight; lossless WebP). Pristine original recoverable via
  `git show` if aelf ever redraws it.
- **Tab-return piecemeal rebuild fix (two rounds)** — see CLAUDE.md Resolved for
  the full note; summary: visibilitychange re-arms a scene-curtain (synchronous
  insert, so the first paint after unhide is the curtain), re-`decode()`s chamber
  imagery behind it, and — round 2 — **holds ≥600ms** before a 250ms fade, because
  decode() resolves instantly on return while the evicted GPU wall textures take
  ~½s to re-rasterise. Only after 10s+ hidden; 1.5s cap.
- **Themed 404** (`src/pages/404.astro`) — "You have wandered beyond the temple
  walls…": black + the sanctuary firmament (same mulberry32 seed as the chambers,
  generated at build time), the pulsing OVS vermillion star (mirrors the chapel
  wall star — keep in sync), Cormorant italic line, emerald paths back to `/` and
  `/field-notes/`, and a soft radial "clearing" (`main::before`) so stars never
  sit in the text. Self-contained, `noindex`, honours reduced-motion; Netlify
  serves `dist/404.html` automatically. Not in the sitemap.
- **Purpose-made OG card** (`public/images/og-card.jpeg`, 1200×630, ~143KB) —
  goddess portrait right (yin-yang cropped, JPEG blacks floored to pure black),
  emerald mono `leilan.ai` + Cormorant italic "an AI goddess, glitch tokens & the
  SolidGoldMagikarp story" left, seeded firmament stars. Wired as `og:image`/
  `twitter:image` in `index.astro`, `data.astro`, and the `FieldNoteLayout`
  default. Composited with Pillow (fonts fetched as TTF from Google Fonts).
  Launch-checklist item retired in CLAUDE.md.

## ✅ DONE (from the original 2026-07-13 pitch — for context)

- **Candle persistence** — shrine candles the visitor lit stay lit across visits
  (`localStorage.shrineLitCandles`; ambient random ~18% still reshuffle). Immersive
  3D candles NOT yet persisted (possible follow-up).
- **True celestial time** — first visit with no stored preference defaults night/day
  from the visitor's local clock (day 07:00–18:59; seeds `sessionStorage.skyMode` in
  index.astro, prism.js, immersive.astro). Toggle still overrides.
- **Fixed firmament** — chamber-sky stars are seeded (`_mulberry32(0x1E11A2)`): same
  constellation every visit/chamber; no blink-out/respawn; twinkle 45–100% only.
- **Real-phase moon** — chamber night sky shows the moon's actual current phase
  (`moonAge01`/`drawMoon`), halo + earthshine + maria, opaque (occludes stars),
  rest position (0.62, 0.075) in the sky pocket above the facing wall.
- **Shooting stars** — one per ~16–44s, spawned top 3–13% on shallow trajectories so
  they show in normal (non-tilt) view too.
- **Comet ZTF cameo** — built, then CUT for realism (real comets hang still night to
  night). Could return someday as a *fixed* apparition on rare nights.
- **Curtain shimmer** — the scene-curtain now breathes an emerald glow + shimmer
  sweep while chamber assets decode ("materialising", not "loading").
- **Landing corner fixes** — 1px edge-hairline export artifact erased from all six
  landing_*.webp; "daylight" moon cluster nudged 14px in from the asset edge (click
  zone re-centred). Note for aelf: her export tool leaves that 1px canvas-edge ghost.

*(Moon/meteors/firmament are chamber-sky only; the immersive hex-world has its own
sky in immersive.astro — porting them there is an available follow-up.)*
