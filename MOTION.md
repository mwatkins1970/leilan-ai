# MOTION.md — the feel of the geometrical motions

*Created 2026-08-07. Audience: the next Claude instance, and M.
Scope: how the chamber's two big movements — **wall rotation** (left/right) and
**heavens-tilt** (up to the sky and back) — actually feel, and what to change to
make them feel better. This is the investigation + plan for the standing item
"geometric-motion polish" in `AMELIORATION.md`. Nothing here is implemented yet.*

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
| **A** | **Queue rotation input.** Keep a `pendingRotationSteps` counter; on `transitionend`, if pending, immediately fire the next step. Cap at ~4 so a mashed button can't spin the room forever. | `lookLeft`/`lookRight`/`rotateToWall`/`transitionend` | low |
| **B** | **Easing + duration as tokens.** `--rot-dur` / `--rot-ease` on `.wall-area`; CSS reads them, JS reads them once via `getComputedStyle`; `_rotBezier` derives its control points from the same string. Then try the three candidate curves. | `prism.css`, `_rotBezier`, `SKY_ROT_DURATION` | low, but **all four sites must move together** |
| **C** | **Constant angular velocity** for multi-step turns (`steps ** 0.6`), inline duration on both animated layers. | `rotateToWall` | low |
| **D** | **De-thud the landing.** Defer culling/aleph/twinkle one rAF past `transitionend`; verify the star-layer rebase isn't firing every rotation. Also finding 7's single-tile idle repaint. | `transitionend`, `drawSky`, `paintStarLayerTiles` | low |
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
