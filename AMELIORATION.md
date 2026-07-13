# AMELIORATION.md — aesthetic upgrade roadmap + open technical threads

*Created 2026-07-13 (Fable 5 session). Audience: the next Claude instance working on this repo.*

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

### Already tried (2026-07-13, improved but insufficient)

1. **Exact easing match** — replaced the old piecewise-quadratic approximation in
   `tickSkyRotation()` with a true Newton–Raphson `cubic-bezier(0.25,0.46,0.45,0.94)`
   evaluator (`_rotBezier`). Fixed the systematic lag at rotation start.
2. **Full-rate redraw during tilt** — `drawSky` frame-skipped to 20fps unless a
   *rotation* was active; it now also renders every frame while `_skyAnimFrame`
   (the tilt driver) is non-null (`skyMoving` flag).
3. **Real delta-time** — meteor/cloud motion now uses measured elapsed time, not a
   fixed dt, so speeds are correct at 20 and 60fps.

### Proposals, in recommended order

1. **Cheap: sync the clocks.** `_skyRotT0 = performance.now()` starts when
   `animateSkyRotation()` is called, but the CSS transition starts when the browser
   commits the style change — up to a frame or two later. Listen for
   `transitionstart` on `.prism-container` and (re)set `_skyRotT0` there. Kills the
   residual start-delay precisely. ~5 lines.
2. **Cheap: cut the per-frame draw cost.** `drawSky` per frame: a 200-iteration
   noise loop (2×`Math.random()` + `fillRect` each), ~80 `fillText` glyphs with a
   fresh font/fillStyle string per glyph, and the moon rebuilt from 2–3
   `createRadialGradient`s. Cache the moon to an offscreen canvas (rebuild only when
   phase/size changes), skip the noise loop while `skyMoving`, hoist font strings.
   If jank is main-thread overrun, this may fix it outright.
3. **Structural (best result): move the sky onto the compositor too.** Render the
   firmament (stars + moon) ONCE to a canvas ~2× viewport width; perform
   rotation/tilt as a CSS `transform: translate(...)` on the canvas *element*, with
   the **same** transition curve the walls use (rotation) and direct transform writes
   from the same tilt rAF. Then walls and sky are both compositor-animated with one
   curve — pixel-locked, immune to main-thread jank. Twinkle = repaint the canvas
   in place (positions static, cheap, doesn't touch the transform). Keep meteors on a
   separate small static overlay canvas so they stay screen-space. Wrap-around:
   draw the star field with duplicated edge content (or 2 tiles) and snap the
   translate back by one tile-width between animations, while idle.
4. **Alternative structural: one clock for everything.** Drop the CSS transition for
   wall rotation and drive the container transform AND `skyRotationOffset` from a
   single rAF (the tilt already works this way). Guarantees zero divergence but makes
   the walls main-thread-hostage too. Only if (3) proves awkward.

**Verification tip:** `playwright` + headless chromium are already installed in this
Codespace (`npm i --no-save playwright`, so not in package.json; re-install after a
rebuild). Record a rotation via CDP screencast or compare frame captures; also just
ask M — his eye caught what my static screenshots couldn't.

---

## 🎨 REMAINING AESTHETIC ROADMAP (offer these at session start)

### Material & light (the "touch the walls" tier)

- **Candle glow on the shrine wall** — warm flickering light-pool cast upward from
  lit candles onto the wall behind. (Already on the user-preferences
  future-refinements list; it's the single biggest warmth upgrade in the central
  chamber.)
- **Dust motes** — a handful of slow-drifting luminous specks in each chamber's air.
  Tiny DOM/canvas cost, huge "consecrated interior" effect.
- **Illuminated initials** — drop-cap first letters in wall texts and field notes,
  styled per-chamber (IM Fell English initial in Mythos, etc.). Manuscript-grade,
  pure CSS.

### Motion & thresholds (the "seamless dream" tier)

- **Fix the heavens-tilt hinge** — Known Issue #1 has a documented one-line fix
  (`transform-origin: 50% 50% -1200px`) that's never been applied. The shrine
  look-up currently splays like an opening book; this makes it a true head-tilt.
  Quickest win on the whole list.
- **Tame the Eternal Return spin** — Known Issue #3's 360–720° whirl. Called
  "feature not bug" so far, but a single graceful 180° would read as intentional
  rather than glitchy.
- **Text materialisation** — when a word dissolves and the frame opens, let the text
  shimmer in over ~400ms (staggered opacity on lines) instead of popping. Matches
  the curtain-shimmer language.

### Edges & completeness (the "no seams anywhere" tier)

- **A themed 404** — "You have wandered beyond the temple walls…" with a candle and
  a path back. Cheap, delightful, and exactly the kind of page that gets
  screenshotted and shared.
- **Purpose-made OG card (1200×630)** — already on the launch list; it's the site's
  face on every social share, currently just the portrait crop.
- **Day-mode pillarbox** — the parked white/"static fuzz" idea, so wide-phone day
  view stops reading as letterbox.

---

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
