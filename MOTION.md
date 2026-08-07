# MOTION.md — the feel of the geometrical motions

*Created 2026-08-07; slices A–D implemented the same day. Audience: the next Claude instance, and M.
Scope: how the chamber's two big movements — **wall rotation** (left/right) and
**heavens-tilt** (up to the sky and back) — actually feel, and what to change to
make them feel better. This is the investigation + plan for the standing item
"geometric-motion polish" in `AMELIORATION.md`.*

> ## Status: SIGNED OFF by M, 2026-08-07
>
> Rotation: *"the rotations seem a lot smoother now. I'm going to take this!"*
> Tilt latency: *"a LOT less jittery/latency-plagued. Maybe still a touch of it
> still there, but I reckon we should sign off on this issue."*
>
> **Built and accepted:** slices A–D (the rotation engine) and finding 9 (the
> tilt's one-frame sky lag). **Deliberately not built:** slices E and F — the
> tilt is still per-frame JS on the main thread at a measured ~27fps in the
> headless harness. That residual is the most likely source of the "touch of
> it still there" M can still feel, and it is a known, scoped, unstarted piece
> of work — **not** a mystery. Don't reopen this file speculatively; reopen it
> if and when someone wants slice E.

> **Not to be confused with** the sky-motion work (`AMELIORATION.md`, round 4).
> That was about the *star canvas* keeping pace with the walls, and is
> provisionally sorted. **This file is about how the wall motion itself feels.**

---

## M's brief (2026-08-07)

> "There are two actions — rotating the hex chamber view left or right, or
> tilting back to the heavens (by lighting a candle at the shrine or via the
> search interface above it, or clicking on the horoscope in the Mythopoeia
> chamber) — which sometimes are a touch clunky. I mean, it's OKAY… but if I
> were a professional game developer, I'd be looking to smooth that out."

So: not a bug, a quality bar. Book drops ~2026-08-28, so there is a real (if
soft) deadline for making the temple shine.

---

## How this was investigated

Playwright against the local dev server (`/prism/main`, 1280×800, night mode),
instrumenting the page's own globals — `prism.js` is loaded as a classic
`<script is:inline src>`, so its top-level function declarations are on
`window` and can be wrapped and timed from the harness without touching source.
Three measurements: rotation-step accounting from the live `matrix3d`,
`PerformanceObserver('long-animation-frame')` totals, and self-timing wrappers
around `drawSky` / `paintStarLayerTiles` / `renderSerpStrip` / `drawMotes` /
`updatePrismTransform`.

**Caveat on absolute numbers:** headless Chromium here rasterises on
SwiftShader (CPU), so absolute frame times are pessimistic and GPU-side raster
cost is inflated. *Ratios and call counts are trustworthy; milliseconds are
not.* Where a finding rests on a count or a code path rather than a timing, it
is marked ✔ measured.

---

## Findings, ranked by likely payoff

### 1. ✔ Three out of four rapid clicks are silently swallowed

`lookLeft`/`lookRight`/`rotateToWall` all open with
`if (isRotating || archwayAnimating || shrineHeavensLocked()) return;`
([prism.js:1338](public/scripts/prism.js#L1338),
[1356](public/scripts/prism.js#L1356),
[1378](public/scripts/prism.js#L1378)). `isRotating` clears only on the
container's `transitionend`, ~800 ms later. There is **no queue** — extra
clicks are dropped on the floor.

Measured, four clicks at a fixed interval, counting 60° steps actually taken:

| click interval | steps registered |
|---|---|
| 100 ms | **1 of 4** |
| 250 ms | **1 of 4** |
| 500 ms | 2 of 4 |
| 900 ms | 3 of 4 |

Note the last row: even clicking *slower* than the animation, one click is
still lost, because `transitionend` lands slightly after the nominal 800 ms.

This is almost certainly the biggest single contributor to "clunky". A user who
wants to look round the room clicks three times and the room turns once. It
doesn't read as "input rejected", it reads as *the room is sticky*. Every game
in existence queues or blends this input.

*(`AMELIORATION.md` currently says rapid clicks "restart rather than blend" —
that's wrong, they're discarded. Fix that line when this work lands.)*

### 2. The rotation easing curve jumps into motion and mushes out of it

`cubic-bezier(0.25, 0.46, 0.45, 0.94)` — jQuery's `easeOutQuad` — is a pure
ease-**out**. Its initial slope is `0.46/0.25 = 1.84`, i.e. the chamber leaves
rest at **1.84× the average angular velocity, instantly**. Its final slope is
`(1−0.94)/(1−0.45) = 0.109`. Start-to-end velocity ratio ≈ **17 : 1**.

For a UI button that's fine and snappy. For a room of stone with mass, an
instantaneous velocity step at t=0 is exactly the thing that reads as a lurch,
and the long slow tail then reads as drift. An ease-in-out (zero velocity at
both ends) is what a game would use to sell weight.

**Where the curve lives — all three must change together or the sky desyncs:**
- [prism.css:181](src/styles/prism.css#L181) — `.prism-container` transition
- [prism.css:134](src/styles/prism.css#L134) — `#star-layer-canvas` transition
  (compositor star layer, must match the walls *exactly*)
- [prism.js:2190](public/scripts/prism.js#L2190) — `_rotBezier()`, the
  Newton–Raphson evaluator that drives the JS-drawn sky (day mode, and the
  fallback path)

Plus `SKY_ROT_DURATION = 800` ([prism.js:2173](public/scripts/prism.js#L2173))
must equal the CSS duration. Four places, no single source of truth — the
obvious hygiene fix is CSS custom properties `--rot-dur` / `--rot-ease` on
`.wall-area`, read once by JS via `getComputedStyle`.

Candidate curves to put side by side for M:
| candidate | character |
|---|---|
| `cubic-bezier(0.4, 0.0, 0.2, 1)` | Material standard; gentle in, firm out |
| `cubic-bezier(0.45, 0.05, 0.25, 1)` | heavier, more stone-like |
| `cubic-bezier(0.33, 0, 0.15, 1)` @ 700 ms | quicker but still eased both ends |

### 3. ✔ A multi-step turn goes 2–3× faster than a single step

`rotateToWall` sets `currentRotation ± steps * 60` in one write
([prism.js:1392](public/scripts/prism.js#L1392)) and the CSS duration is a flat
0.8 s regardless. So clicking a far wall (or the minimap) sweeps 180° in the
same time a nudge sweeps 60° — triple angular velocity, same curve. The room
has no consistent sense of how fast it turns.

Fix: scale duration with step count sub-linearly, e.g.
`dur = BASE * steps ** 0.6` (60°→800 ms, 120°→1212 ms, 180°→1550 ms), applied
as an inline `transition-duration` on both `.prism-container` and
`#star-layer-canvas`, with `SKY_ROT_DURATION` following.

### 4. The landing frame is the heaviest frame of the whole rotation

Everything deferred during the glide fires in the single `transitionend` frame
([prism.js:1427](public/scripts/prism.js#L1427)):
`setFacingTag()` → `updateRimCapCulling()` (exact set, touches every rim
section/vertex) → `updateAlephChars()`, plus the star layer's own
`transitionend` rebase which does **two forced reflows**
(`setStarLayerTransform(false)`,
[prism.js:2438–2442](public/scripts/prism.js#L2438-L2442)), plus the grain /
serpentine-strip / star-twinkle repaints all un-suspending at once
([prism.js:2586](public/scripts/prism.js#L2586),
[2697](public/scripts/prism.js#L2697),
[2575](public/scripts/prism.js#L2575)).

So the motion decelerates beautifully and then **thuds** on arrival. Worth
spreading: keep `setFacingTag` on the settle frame (hit-testing depends on it),
push culling/aleph/twinkle to the *next* rAF, and only run the star-layer
rebase when `|offset| ≥ 0.5` actually needs it (it's already conditional —
verify how often it fires per rotation; if it's every time, the threshold
isn't doing its job).

### 5. ✔ The heavens-tilt runs at roughly two-thirds of the frame rate

`startLookUpAnim` ([prism.js:854](public/scripts/prism.js#L854)) is a
per-frame JS animation: it sets `transition: none`, forces a reflow, then
writes `prismContainer.style.transform` every rAF for 4200 ms up / 2000 ms
down. Measured on a real 4200 ms up-tilt: **`updatePrismTransform` called 113
times ⇒ ~27 fps**, in a page that was managing ~40 fps ambient in the same
harness. The JS itself is negligible (0.04 ms/call) — the cost is the browser
re-running the whole `preserve-3d` subtree's transform every frame with no
compositor promotion, plus `drawSky` un-throttling to full rate for the
duration (`skyMoving` is true, 233 ms of canvas work across the tilt) because
the compositor star layer is deliberately *off* during tilt.

This is the tilt equivalent of the problem round 4 already solved for
rotation, and it's the reason tilt is main-thread-hostage: **anything else the
page does during those 4.2 seconds shows up as a stutter in the sky.**

`will-change: transform` on `.prism-container` was tried in the harness and did
**not** help (it measured slightly worse, within noise) — don't ship it as a
"quick win" without re-measuring on real hardware.

### 6. The tilt back is 2.1× faster than the tilt up

Up: `SHRINE_HEAVENS_UP_MS = 4200`. Down:
`SHRINE_HEAVENS_DOWN_MS - PANEL_FADE_MS = 3200 − 1200 = 2000`
([prism.js:125–126](public/scripts/prism.js#L125-L126),
[1052](public/scripts/prism.js#L1052)). Same 90°. M named the tilt-*back*
specifically as the clunky one — a ceremonial 4.2 s ascent answered by a 2 s
descent, on the least smooth animation path in the codebase, is a good
explanation for that. Both use `easeInOutCubic`, which over 4.2 s also means
the first ~700 ms are nearly motionless (feels like lag before it feels like
motion).

### 7. ✔ The chamber is never idle-quiet — and that's the tilt's headroom

At rest, at night, doing nothing: `drawSky` 117 calls / 3 s costing 121 ms, of
which **`paintStarLayerTiles` is 75 ms** — because the compositor star layer is
three lap-copies wide, so a twinkle refresh redraws **3 × 80 stars + 3 moon
sprites** every third frame, whether or not they're on screen. Round 4 traded
per-frame cost during rotation for a permanent 3× twinkle cost at rest.

Fix: at rest, repaint only the tile under the viewport; repaint the two
flanking tiles once, on the first frame of a rotation (they're static during
the glide anyway, since twinkle is suspended). Should cut idle sky cost ~3×,
which is headroom the tilt needs.

### 8. A CSS-transitioned tilt needs the transform lists to match

`updatePrismTransform` ([prism.js:355](public/scripts/prism.js#L355)) omits
`rotateX` entirely when `currentTilt === 0`:

```js
const tiltPart = currentTilt !== 0 ? ` rotateX(${currentTilt.toFixed(2)}deg)` : '';
```

Two transforms with different function lists can't be interpolated
function-by-function — the browser falls back to matrix decomposition, which
takes a different path through 3D space. **Before any of finding 5's work,
always emit `rotateX(0deg)`.** Cheap, invisible, and a prerequisite.

Also relevant: the 2026-07-13 note above `startLookUpAnim` — do **not**
re-attempt an eye-point pivot. That was tried and reverted (rear rim geometry
swings into frame). The wall-plane hinge stays.

---

## Proposed plan — small slices, M's eye between each

Ordered by payoff-per-risk. Slices A–D are independent of each other; E is the
big one and should not start until A–D are settled and confirmed good.

| # | Slice | Touches | Risk |
|---|---|---|---|
| ~~**A**~~ | ~~**Queue rotation input.**~~ **DONE** — built as mid-flight *re-targeting* rather than a step queue; see *What shipped*. | `lookLeft`/`lookRight`/`rotateToWall`/`transitionend` | low |
| ~~**B**~~ | ~~**Easing + duration as tokens.**~~ **DONE** — `--rot-dur` / `--rot-ease` / `--rot-ease-continue` on `:root`. | `prism.css`, `_rotBezier`, `SKY_ROT_DURATION` | low, but **all four sites must move together** |
| ~~**C**~~ | ~~**Constant angular velocity**~~ **DONE** — `steps ** 0.6`, not literally constant; see *What shipped*. | `rotateToWall` | low |
| ~~**D**~~ | ~~**De-thud the landing.**~~ **DONE**, plus finding 7. | `transitionend`, `drawSky`, `paintStarLayerTiles` | low |
| **E** | **Tilt onto the compositor.** Always emit `rotateX(0deg)` (finding 8), then convert `startLookUpAnim` from rAF to a CSS `transition` on `.prism-container`, with completion via `transitionend`; extend the star layer vertically (tilt pans up to 0.7 h, always returns to 0, so no rebase logic — just enough canvas) and give it a matching vertical transition. Drops `drawSky`'s full-rate tilt path entirely. | `startLookUpAnim`, both heavens entry/exit paths, star layer, `skyTiltOffset` consumers | **high** — this is the load-bearing one |
| **F** | **Tilt timing/symmetry.** Once E lands and the tilt is cheap, revisit 4200/2000 and the `easeInOutCubic` curve. Probably down → ~3000–3400 ms. Pure taste; M picks. | two constants | trivial |

**Slice E notes / traps**
- Interruption: the current rAF version can be cancelled mid-flight
  (`_skyAnimFrame`); a CSS transition needs the same two-reflow instant-snap
  technique used by `leaveShrineHeavens` and `setStarLayerTransform(false)` to
  be interrupted cleanly. That pattern has bitten this codebase twice already
  (the Eternal Return multi-spin) — reuse it verbatim, don't reinvent.
- `transitionend` on `.prism-container` is already listened to for *rotation*
  and sets `isRotating = false`. A tilt transition on the same element fires the
  same event. That handler needs to learn the difference, or the tilt will
  trip the rotation bookkeeping.
- `skyTiltOffset` currently drives day-mode clouds and the JS-drawn stars. If
  the star layer takes over the tilt at night, day mode still needs the old
  path — keep both, switch on `isNight`, exactly as `useStarLayer` already does.
- Consider doing E as **night-only first**, matching how round 4 was scoped.

---

## Test recipe

1. `npm run dev`, then `cloudflared tunnel --url http://localhost:4321` for M's
   eye (see CLAUDE.md's dev-preview note — the `app.github.dev` URL is broken at
   GitHub's tunnel layer).
2. Rotation input accounting (the finding-1 table): drive
   `document.getElementById('nav-left').click()` N times at a fixed interval,
   read the yaw back out of the live matrix:
   ```js
   const m = new DOMMatrix(getComputedStyle(document.querySelector('.prism-container')).transform);
   Math.round(Math.atan2(m.m13, m.m11) * 180 / Math.PI)
   ```
3. Tilt frame rate: wrap `window.updatePrismTransform` with a counter, call
   `enterShrineHeavens(window.LEILAN_INDEX[0])`, divide calls by 4200 ms.
   **Do not** try to trigger the tilt by clicking a `.shrine-candle` from
   Playwright — it doesn't take (the capture-phase zone router owns that click);
   an early probe silently measured nothing this way. Call
   `enterShrineHeavens` / `leaveShrineHeavens` directly.
4. Per-function cost: wrap `drawSky`, `paintStarLayerTiles`, `renderSerpStrip`,
   `drawMotes` the same way and sum.
5. **Ground truth is M's hardware via the tunnel**, as always — headless
   SwiftShader timings only tell you which way things moved.

Regression checks for any slice: rotate through all six walls in both
directions; a minimap jump (multi-step); enter *and* leave heavens-tilt from
both the shrine candle **and** the Mythos horoscope wall (`enterHeavensTilt`);
confirm the Eternal Return still doesn't multi-spin; day mode as well as night;
`prefers-reduced-motion`; and the archway dive still works after a tilt (the
`updateArchwayOverlay` call in `leaveShrineHeavens`'s completion).

---

## What shipped (2026-08-07) — slices A–D

### The rotation engine was rebuilt, not patched

`lookLeft` / `lookRight` / `rotateToWall` are now thin callers of one core,
`turnBy(dir, steps)` ([prism.js](public/scripts/prism.js), search
`Rotation engine`). The `isRotating` early-return is gone from all three.

**A click during a turn re-targets the turn in flight** rather than being
queued as a discrete step. Writing a new transform *plus* a new
duration/timing-function in a single style change makes the browser start a
fresh transition from the current computed value — no jump — and because the
continuation curve (`--rot-ease-continue`) starts at roughly the velocity the
room already has, the turn extends instead of stopping and restarting. A step
queue was considered and rejected: it would stop dead every 60°, trading one
clunk for another. Clicking the *other* way mid-turn reverses through the same
path, which is also what you'd want.

Mash guard: `ROT_MAX_PENDING_STEPS = 4`. Beyond four steps still in flight,
further clicks are ignored — the room shouldn't keep spinning long after the
visitor stopped asking.

A watchdog (`dur + 400ms`) clears `isRotating` if `transitionend` never
arrives — a coalesced no-op style change or a backgrounded tab would otherwise
lock the chamber. It explicitly never touches the archway dive's own use of
`isRotating`.

### Measured, before → after

| | before | after |
|---|---|---|
| 4 clicks 60 ms apart | — | **4 of 4 steps** |
| 4 clicks 100 ms apart | **1 of 4** | **4 of 4** |
| 4 clicks 250 ms apart | **1 of 4** | **4 of 4** |
| 4 clicks 500 ms apart | 2 of 4 | **4 of 4** |
| 4 clicks 900 ms apart | 3 of 4 | **4 of 4** |
| 10 clicks 40 ms apart | — | 4 of 10 (mash guard) |
| 1-step vs 3-step angular velocity | 3.0× apart | **1.55× apart** |
| idle sky work per 3 s | 121 ms (`drawSky`), 75 ms of it star tiles | **46 ms / 20 ms** |

*(Counting steps needs the unbounded `currentRotation`, not the rendered
matrix — 4 steps is 240°, which wraps to −120° and reads as "2 steps" if you
normalise the yaw. An intermediate verification run was wrong for exactly that
reason.)*

### On "constant angular velocity"

Duration scales as `BASE_ROT_MS * steps ** 0.6`, floored at 120 ms — *not*
linear. Linear would make a 3-step minimap jump take 2.4 s, which is tedious;
`** 0.6` narrows the 1-step/3-step velocity gap from 3.0× to 1.55× while
keeping a long jump brisk. `ROT_STEP_EXP` is one constant if M wants it flatter
(1.0 = literally constant velocity) or sharper.

### The landing

`settleRotation()` keeps only `setFacingTag()` on the settle frame — click
hit-testing depends on it and on `.wall-panel[data-facing]`'s
`transform-style: flat`. Rim-cap culling, aleph chars and the archway tip move
to the next rAF (and bail if another turn has already begun). Separately, the
repaints suspended for the duration of a turn now come back on *different*
frames — grain at +1, star twinkle at +3, serpentine strip at +6 — instead of
all landing on the settle frame together.

`updateRimCapCulling` now takes an array of every `shrinePos` the motion passes
through, not just the start. For 1- and 2-step turns this is provably identical
to the old endpoint union; for 3-step turns both cull essentially everything
(a wall can't be visible at four positions out of six), so it's a no-op in
practice — but it states the intent correctly and stays correct as
re-targeting accumulates positions.

### Star twinkle cadence

`STAR_TWINKLE_EVERY = 9` (was every 3rd frame). The compositor star layer is
three lap-copies wide, so one refresh redraws 3 × 80 stars and 3 moon sprites.
Each star's brightness cycle has a period of **8–31 seconds** (`speed`
0.2–0.8 against `t * 0.001`), so ~7 fps renders it perfectly smoothly. All
three tiles are always painted in the same pass at the same phase, so the
one-lap rebase at `transitionend` can never produce a brightness pop.

### Regression-tested (Playwright, no console or page errors anywhere)

All six walls via `rotateToWall` in both directions; arrow turns; reversal
mid-turn (returns to exactly the starting rotation); a minimap jump
interrupting an arrow turn; day mode; portrait + `prefers-reduced-motion` in
the Research Lab; the ASCII gallery; the 835×319 wide/short viewport that
produced the original ghost rim wedges (cull counts behave: 7 at rest, 9 mid
single turn, 11 mid 3-step, back to 7 on settle); the shrine-candle heavens
tilt *and* the Mythos horoscope heavens tilt, each with a full enter/leave
cycle, Eternal Return landing back at yaw 0 with no multi-spin, and a rotation
afterwards.

### Left for M's eye

The curve itself. `--rot-ease` is now `cubic-bezier(0.4, 0, 0.2, 1)` — a real
ease-in-out, replacing the ease-out that left rest at 1.84× average velocity.
It is one line in `prism.css` (`:root`) and everything else follows
automatically, so trying `cubic-bezier(0.45, 0.05, 0.25, 1)` (heavier) or a
different `--rot-dur` costs nothing. Same for `--rot-ease-continue`, whose
initial slope (~1.45) is a considered guess at the velocity a re-targeted turn
inherits, not a measured match.


---

## Creative flourishes M green-lit (2026-08-07) — build after the tilt work

Offered alongside this investigation; M picked three of four. Not started.

1. **The air responds to the motion.** Dust motes take a velocity impulse
   against the turn, and candle flames bend as the chamber moves — the room's
   air noticing that the room moved. Both systems already exist (`initMotes`/
   `drawMotes`, and the `candleFlicker`/`candleGlowBreath` CSS), and the mote
   canvas is already screen-space, so this is cheap. It also does real work for
   *this* file's problem: motion the eye can read against a moving reference
   feels smoother than motion against a static one.
2. **Sky parallax.** Split the compositor star layer in two — near stars pan
   slightly further than the moon and the far field during a rotation. Almost
   free now that the layer exists: a second canvas with a shorter transition
   distance and the same curve.
3. ~~**Moonlight in the chamber.**~~ **BUILT 2026-08-07, awaiting M's eye.**
   Permanent writeup in CLAUDE.md → *Chamber Sky & Ritual Layer* → Moonlight.
   One finding worth carrying forward: an **additive wall wash alone cannot
   carry this feature**. Measured, it lifts the Research Lab's moiré by 11/255
   at the wall top and does *nothing whatever* in the Central Chamber or the
   OVS Chapel, whose art already sits at 210–240 luminance with no headroom
   left. The component that actually makes a full-moon night look like one is
   the **star wash** — subtractive, and on the shared sky, so it reads in every
   chamber. Any future "light the room" idea should be tested against a pale
   chamber before being called done.

Declined for now: coupling rotation and tilt to the audio engine (a stone-grind
swell under the turn, a rising tone on the tilt).


---

## 9. ✔ The sky ran exactly one frame behind the walls for the whole tilt

**Found 2026-08-07, after M tried slices A–D:** *"The tiltback isn't clunky in
the same way the chamber view rotation was. It's more like the starry sky field
doesn't quite move right, like there's a tiny bit of latency."*

He was right, and it was measurable. The walls are moved by
`startLookUpAnim`'s rAF tick, which **wrote** `skyTiltOffset`; the sky is drawn
by `drawSky`'s *separate* rAF loop, which **read** it. Two callbacks, one
shared variable — so which ran first inside a frame decided whether the sky was
current or stale.

`drawSky`'s loop has been running since page load and therefore always
registers its next callback before the tilt tick registers its own, so it
always ran first. Measured across a full 4200ms ascent: **113 frames out of
114, the sky drew with the previous frame's tilt.** Mean **0.80°** behind the
walls, peaking at **3.72°** at the steepest part of the easing curve — on an
800px viewport, where 90° of tilt pans the sky by 0.7 of the height, that's
about **23px of sky displacement** at the worst moment. Comfortably visible,
and constant, which is exactly why it read as *latency* rather than as jitter.

Note this had nothing to do with frame rate, main-thread load, or the
compositor. Three previous rounds of sky-motion work (`AMELIORATION.md`) all
attacked timing precision and per-frame cost. This was an ordering bug sitting
underneath all of them, and it would have survived slice E untouched.

**Fix:** the tilt is now data (`_tiltAnim = {t0, dur, from, span}`) plus a pure
function `tiltAt(now)`. Both rAF callbacks in a frame receive the *same*
timestamp, so both deriving the angle from that timestamp makes the ordering
irrelevant. `drawSky` re-derives `skyTiltOffset` from its own frame timestamp
instead of trusting what the tick left behind.

**Verified:** `tiltAt` instrumented across a full up-tilt and a full down-tilt —
113 and 52 frames respectively, **every** frame has both callers asking with
the same timestamp and receiving an identical angle, worst disagreement
0.0000°, no unpaired frames. Regression-tested with no console or page errors:
night and day shrine tilts, the Mythos horoscope tilt, a tilt interrupted
mid-ascent by `leaveShrineHeavens` (settles clean — `_tiltAnim` null,
`currentTilt` 0), portrait + `prefers-reduced-motion`, the ASCII gallery, and
rotation after each tilt.

**What this does NOT fix:** the tilt still runs per-frame on the main thread at
a measured ~27fps in the headless harness (finding 5). The sky no longer *lags*
the walls, but both can still drop frames together under load. That's slice E,
and it's still the right next move — just no longer the thing M could see.
