# AMELIORATION.md — aesthetic upgrade roadmap + open technical threads

*Created 2026-07-13 (Fable 5 session); last updated 2026-07-14. Audience: the next Claude instance working on this repo.*

**How to use this file:** at the start of a session, offer the user (Matthew, "M")
whatever remains on this list and ask what he wants to work on — he picks, you don't.
As items get done, update this file (move them to *Done*, prune dead ideas, add new
threads). This file is the between-sessions memory for the *polish* workstream;
CLAUDE.md remains the master reference for how the site works.

---

## 🔴 TOP PRIORITY: tab-return piecemeal rebuild STILL OCCURRING (curtain fix insufficient)

**Reported by M 2026-07-14 night, despite the two-round tab-return curtain fix
(see CLAUDE.md Resolved — now reopened).** When a chamber tab is neglected for
a while (other tabs used), returning to it shows the page rebuilding
piecemeal: **notably the background wall images take ~half a second to paint**
after the rest. M's acceptance criterion: the page should appear **all at
once**, even at the cost of a longer all-black (or black-shimmer) hold.

Leads, in credibility order:
1. **The `.wall-bg` layers are CSS `background-image`s, not `<img>` elements**
   — and M specifically names "background wall images" as the late-poppers.
   The return-curtain only re-`decode()`s `.chamber img` ELEMENTS; the big
   moiré wall backgrounds are never warmed. Fix candidates: on return, also
   `new Image(src).decode()` every distinct `.wall-bg`/chamber background URL
   (warms the shared image cache) before lifting; and/or hold longer.
2. **`RETURN_CURTAIN_MIN_MS = 600` may simply be too short** on M's hardware —
   the GPU re-raster of the big composited 3D layers can exceed it. Raising
   the floor (900–1200ms) is cheap; better: lift only after N consecutive
   fast rAF frames (re-raster settled heuristic), still capped.
3. **Verify the handler even fires for his pattern** — `RETURN_MIN_HIDDEN_MS`
   (10s) gate, bfcache restores, and whether Chrome fired `visibilitychange`
   at all. Temporary logging / a visible debug beacon would settle it.
The handler lives near the end of prism.js (after the load-time curtain);
1.5s race cap. Test recipe: open chamber → background the tab ≥ a few minutes
of active use elsewhere → return; M's eye is the ground truth.

---

## 🔊 NEW BUG: audio static crackle every few seconds

**Reported by M 2026-07-14 night.** An intermittent static crackle cuts
through the chamber soundscape every few seconds — **aperiodic**, not on a
regular beat. Confirmed to be the site, not his laptop: turning the site's
own volume slider down removes it while all other system audio stays clean.
(Not yet known whether it's chamber-specific or global; ask M which chambers
he had open.)

Hypotheses to check (READ `AUDIO.md` IN FULL FIRST, per its own warning):
- **Sum clipping**: the aperiodic every-few-seconds cadence matches the event
  engine's density — simultaneous event voices + bed may transiently exceed
  1.0 and hard-clip. Check headroom at/above `masterGain`; a
  `DynamicsCompressorNode` (or lower master levels) would both diagnose and
  fix — crackle scaling with the user volume slider is consistent with
  clipping upstream of `userVol`.
- **Un-ramped gain steps**: any `gain.value =` / `setValueAtTime` jumps at
  event onsets/offsets click; audit for missing `linearRamp`/`setTargetAtTime`.
- **Source restarts without envelope** (pooled/reused nodes starting at a
  non-zero-crossing).
- Main-thread jank starving the render quantum is *possible* (the sky rAF got
  busier this fortnight) but WebAudio runs on its own thread — lower priority.

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

## 🔧 OPEN BUG: sky motion latency during chamber rotation / heavens-tilt

**Symptom:** when the chamber rotates (left/right arrows) or tilts back
(shrine/horoscope heavens), the night-sky canvas (stars/moon) moves in the right
direction but **slightly jerkily and with a perceived delay** relative to the walls.
The walls glide; the sky stutters behind them. M finds it off-putting; two rounds of
fixes have improved but not cured it.

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

### Proposals remaining, in recommended order

1. **Structural (best result): move the sky onto the compositor too.** Render the
   firmament (stars + moon) ONCE to a canvas ~2× viewport width; perform
   rotation/tilt as a CSS `transform: translate(...)` on the canvas *element*, with
   the **same** transition curve the walls use (rotation) and direct transform writes
   from the same tilt rAF. Then walls and sky are both compositor-animated with one
   curve — pixel-locked, immune to main-thread jank. Twinkle = repaint the canvas
   in place (positions static, cheap, doesn't touch the transform). Keep meteors on a
   separate small static overlay canvas so they stay screen-space. Wrap-around:
   draw the star field with duplicated edge content (or 2 tiles) and snap the
   translate back by one tile-width between animations, while idle.
2. **Alternative structural: one clock for everything.** Drop the CSS transition for
   wall rotation and drive the container transform AND `skyRotationOffset` from a
   single rAF (the tilt already works this way). Guarantees zero divergence but makes
   the walls main-thread-hostage too. Only if (1) proves awkward.

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
- **Tame the Eternal Return spin** — Known Issue #3's 360–720° whirl. Called
  "feature not bug" so far, but a single graceful 180° would read as intentional
  rather than glitchy.
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
