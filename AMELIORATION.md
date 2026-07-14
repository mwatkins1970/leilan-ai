# AMELIORATION.md — aesthetic upgrade roadmap + open technical threads

*Created 2026-07-13 (Fable 5 session); last updated 2026-07-14. Audience: the next Claude instance working on this repo.*

**How to use this file:** at the start of a session, offer the user (Matthew, "M")
whatever remains on this list and ask what he wants to work on — he picks, you don't.
As items get done, update this file (move them to *Done*, prune dead ideas, add new
threads). This file is the between-sessions memory for the *polish* workstream;
CLAUDE.md remains the master reference for how the site works.

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
- **Text materialisation** — when a word dissolves and the frame opens, let the text
  shimmer in over ~400ms (staggered opacity on lines) instead of popping. Matches
  the curtain-shimmer language.

### Edges & completeness (the "no seams anywhere" tier)

- **Purpose-made OG card (1200×630)** — already on the launch list; it's the site's
  face on every social share, currently just the portrait crop.
- **Day-mode pillarbox** — the parked white/"static fuzz" idea, so wide-phone day
  view stops reading as letterbox.

---

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
- **Tab-return piecemeal rebuild fix** — see CLAUDE.md Resolved for the full note;
  summary: visibilitychange re-arms a fast scene-curtain (synchronous insert, so the
  first paint after unhide is the curtain), re-`decode()`s chamber imagery behind
  it, lifts in 180ms; only after 10s+ hidden; 1.5s cap.
- **Themed 404** (`src/pages/404.astro`) — "You have wandered beyond the temple
  walls…": black + the sanctuary firmament (same mulberry32 seed as the chambers,
  generated at build time), a CSS candle with breathing light-pool (after the
  shrine candles), Cormorant italic line, emerald paths back to `/` and
  `/field-notes/`. Self-contained (~15KB HTML), `noindex`, honours reduced-motion;
  Netlify serves `dist/404.html` automatically. Not in the sitemap.

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
