# AMELIORATION.md — aesthetic upgrade roadmap + open technical threads

*Created 2026-07-13 (Fable 5 session); last updated 2026-07-23. Audience: the next Claude instance working on this repo.*

**How to use this file:** at the start of a session, offer the user (Matthew, "M")
whatever remains on this list and ask what he wants to work on — he picks, you don't.
As items get done, update this file (move them to *Resolved*, prune dead ideas, add new
threads). This file is the between-sessions memory for the *polish* workstream;
CLAUDE.md remains the master reference for how the site works, and is where fully-shipped
features get their permanent writeup — don't duplicate that detail back into this file.

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

**M's status report, 2026-08-07:** still not sure — "I think it MIGHT still be
happening, but I got a bit confused with various git pushes, so it MIGHT also
be fixed." That uncertainty is itself consistent with the hypothesis below (a
git push on the dev preview triggers a *reload*, which is the load-curtain
path, not the tab-return one). **Next step is unchanged: run the diagnostic
below and report which lines appear.** Don't build the fix until the
`navigation type` line says which curtain is actually at fault.

**M's status report, 2026-08-03:** "it seems ok, but every now and again I
return to an old tab and see the piecemeal re-assembly, but that's often
after there's been a git push or something. I need a better way to test
this."

### Diagnostic mode (built 2026-08-03) — use this before touching anything

In the browser console: `localStorage.curtainDebug = '1'` then reload. It
persists across reloads on purpose (a reload is one of the cases under
investigation, so a URL flag would be lost exactly when needed), and is inert
and free when off. `delete localStorage.curtainDebug` to stop.

It logs which curtain path actually ran and what it waited on. **The
`navigation type` line is the discriminator**: `reload` or `navigate` means
the page *loaded* and the tab-return handler never fired at all — a different
code path with a different failure mode, and the one round 3 did **not**
touch.

### Strong hypothesis from M's "after a git push" clue

That clue probably means the tab **reloaded** rather than merely
unhid — a Vite HMR full-reload on the dev/tunnel preview, or his own refresh.
If so he has been looking at the **load** curtain, not the tab-return curtain,
and rounds 2/3 could never have fixed it.

And the load curtain still has the exact weakness round 1 was killed for: it
lifts as soon as `decode()` resolves plus two rAFs, with **no minimum hold and
no settle check**. The stated justification was that "fresh downloads give
raster ample cover" — but on a warm-cache reload there is no download to give
cover. Measured with the new diagnostic on `/prism/main`:

| load | navigation type | asset wait before lift |
|---|---|---|
| cold | `navigate` | 570ms |
| warm-cache reload | `reload` | **272ms** |

Less than half the cover, on a real machine with a warm disk cache probably
less again — while the GPU still has the same wall layers to rasterise.

### Test recipe

1. `localStorage.curtainDebug = '1'`, reload, open the console.
2. **Warm-cache reload case** (deterministic, try this first): let a chamber
   fully settle, then hit reload. Watch for `navigation type: reload` and a
   short asset wait. This is the case that can be reproduced on demand.
3. **True tab-return case**: leave the tab for >10s
   (`RETURN_MIN_HIDDEN_MS`) of real use elsewhere, then come back. Look for
   `RETURN curtain: shown`. If instead you see a fresh `page load` line, the
   tab reloaded and you are in case 2.
4. Report which lines appeared alongside what you saw.

**Not yet verified:** the tab-return branch could not be exercised headlessly
— Playwright's `bringToFront()` doesn't reliably drive `visibilitychange` in
headless Chromium, so those log lines are untested in practice. The load-path
lines are confirmed working. M's hardware remains ground truth.

### The obvious fix, NOT applied — needs M's call

Give the load curtain the same floor + adaptive settle the tab-return curtain
got in rounds 2/3. Deliberately not done, because a flat floor would slow
**every** first visit for every visitor to fix a case that only bites on
reload. The targeted version — apply the floor/settle only when the load was
warm-cache (`navigation type === 'reload'`, or a small `transferSize`) — costs
first-time visitors nothing. That's the one to build if the diagnostic
confirms the hypothesis.

---

## 🟢 PROVISIONALLY SORTED (M: "everything's loads smoother", 2026-07-23):
## sky motion latency, round 4 — night rotation

**Symptom:** the chamber walls rotate on the CSS-transition compositor path;
the night-sky canvas (stars/moon), redrawn by JS every frame with its own
hand-synced clock, visibly lagged/stuttered behind them. Three earlier
rounds (2026-07-13/14) fixed the easing curve, redraw rate, and per-frame
draw cost, but the jerkiness survived — pointing at the architecture itself
(a canvas repaint can never be frame-locked to a compositor transition from
the main thread). Full round 1–3 blow-by-blow is in git history of this
file if ever needed; the short version is "timing precision and main-thread
cost were both addressed and it still stuttered."

**Round 4 (2026-07-22), implemented and M-tried-live on the tunnel, 2026-07-23:**
scoped to *night-mode wall rotation only* (M's "small steps" request) — the
architecturally worst case (real compositor transition for the walls vs. JS
canvas repaint for the sky; tilt already drives both from the same rAF, so
it's less broken even if some jank remains there too). A new
`#star-layer-canvas` (`public/scripts/prism.js`, search `2026-07-22` /
`star-layer`), 3× viewport width, pre-painted with 3 side-by-side lap-copies
of the starfield + moon. Its CSS `transform` uses the *exact same*
`transition: transform 0.8s cubic-bezier(0.25,0.46,0.45,0.94)` as
`.prism-container`, driven by `bumpStarLayerRotation(delta)` at the same
three call sites as `animateSkyRotation` — so the browser interpolates both
on the compositor thread in lockstep, no JS involved during the animation
itself. Twinkle still repaints tile pixels in place at the old throttle
(suspended during motion). The offset counter is unbounded like
`currentRotation` used to be, but self-rebases by exactly one lap on
`transitionend` using the same two-reflow instant-snap technique as the
Eternal Return fix below.

Heavens-tilt and the separate `isSkyView` full-sky entry mode are
**unchanged** (still the original per-frame JS-drawn stars — rotation can't
happen during either, so the two layers never animate at once; `drawSky`'s
`useStarLayer` check just swaps which one is visible). Day mode is
untouched.

**Verified headlessly** (Playwright): no errors across day mode, 15+ night
rotations (offset stays bounded, cycles cleanly, rebases correctly), and a
full heavens-tilt enter/leave cycle; screenshots confirm correct panning at
rest and mid-transition. **M's live read (2026-07-23, via tunnel): noticeably
smoother.** He's doing a fuller site test soon before this is called fully
done — leave this section here (don't move to Resolved) until he confirms.

**Remaining work, if M wants to continue this thread:**
1. **Extend to tilt.** Same idea, but needs vertical tile duplication too
   (tilt pans up to 0.7 of viewport height and, unlike rotation, isn't
   unbounded — it always returns to 0 — so no rebase logic needed, just
   enough vertical canvas to cover the excursion without redrawing).
2. **Extend to day-mode clouds**, if rotation jank is still perceptible
   there.
3. **Alternative, if the above prove awkward:** drop the CSS transition for
   wall rotation entirely and drive both the wall transform and the star
   layer from one rAF (tilt already works this way). Guarantees zero
   divergence but makes the walls main-thread-hostage too — last resort.

---

## 🔨 IN PROGRESS: immersive hex-world sky parity (started 2026-07-23)

**The ask:** M likes it, wants it attempted. The chamber sky (`prism.js`) has a
fixed/seeded firmament (stars hold position, never respawn), a real-phase
moon, and shooting stars. `immersive.astro`'s sky — the hex-grid dive/transit
page — has none of that: its stars are unseeded and *respawn* at random
positions on a life-cycle, no moon, no meteors.

**Why this isn't a straight copy-paste** (checked directly against the code
before planning this): immersive's sky canvas is genuinely different
architecture, not just an unported version of the same thing —
- It's **2× viewport height**, positioned to translate with the camera pitch
  during the dive/tilt (`resizeSkyCanvas`, `updateSky`, `updateSkyTransform`
  in immersive.astro). The chamber sky canvas is a plain 1× W×H.
- Its stars **respawn** at a new random position when their life-cycle ends
  (`lifeT`/`lifeDur`, ~52 stars, no seed) — the opposite of the chamber's
  "fixed firmament, twinkle only" design.
- **No moon, no meteor code exists there at all** — these would be new
  builds adapted to the taller/translating canvas, not ports.
- Day mode uses simple flat-colour bands + radial-gradient "clouds," a
  different technique from the chamber's sprite-cached day clouds.

**Plan — small steps, same as the sky-rotation work:**
1. ~~**First slice: seeded, non-respawning stars.**~~ **DONE 2026-08-03,
   awaiting M's look** — see below.
2. ~~**Then the moon**~~ **DONE 2026-08-03, awaiting M's look** — see below.
3. ~~**Then meteors**~~ **DONE 2026-08-03, awaiting M's look** — see below.

Each slice gets M's look before moving to the next, matching how the
sky-rotation compositor fix went.

### Slice 1 done (2026-08-03): the immersive sky is now *the same firmament*

Not merely "also seeded" — literally the same constellation as the chambers.
`starSymbols` and the night palette turned out to be identical tables in
identical order in both files, so generating the first 45 + 35 stars with the
same `_mulberry32(0x1E11A2)` stream, same draw order and same parameter
ranges as `prism.js` makes star *i* here the same star as star *i* there.

Geometry: immersive draws stars at canvas-y `s.y * 1.5h`, and its canvas sits
at `top: -0.5h` (verified live: 1600px canvas at top −400 in an 800px
viewport), so the chamber's viewport corresponds to `s.y ∈ [1/3, 1]`. Shared
stars are therefore placed at `1/3 + y_chamber · 2/3`; the strip above (only
seen mid-dive) gets 23 + 17 extra stars from the same stream at matching
per-area density, preserving the previous 68 + 52 totals. Lifecycle
respawn is gone: brightness now breathes 45–100% exactly as in the chamber,
and font/rgba strings are precomputed per star as `prism.js` does.

**Verified**: star-for-star equality with `prism.js`'s generator checked
numerically (0 mismatches across all 80 shared stars, all seven fields);
Playwright run through a full dive — no console/page errors, canvas geometry
identical across loads, and the starfield pixel-identical between separate
page loads (best vertical alignment offset 0px, residual diff 0.49/255 =
twinkle only). Day mode untouched.

**Not touched, deliberately:** `wallSkyStars` — the separate 4096×2048 star
texture mapped onto the *outer* prism walls — still uses random respawn. It
tiles across 3D geometry so it can't correspond to anything star-for-star,
and at wall-render size the stars read as faint texture rather than a
firmament. Worth doing only if M notices them twinkling out.

### Slice 2 done (2026-08-03): the moon

`moonAge01`, `drawMoon` and the `moonSprite` cache ported verbatim from
`prism.js` into `immersive.astro`, drawn in the night branch of `updateSky`
after the stars (its opaque backing disc occludes them, as designed).

Placement fell out of slice 1 for free. The shared-star mapping preserves
on-screen position *exactly* — a chamber star at viewport-y `y_c` is drawn at
canvas-y `(1/3 + y_c·2/3)·1.5h = 0.5h + y_c·h`, and the canvas top sits at
viewport-y `−0.5h`, so it lands back at `y_c·h`. The moon therefore just
reuses the chamber's own rest position `(0.62, 0.075)` plus the `skyTop`
offset, and shows in the same place on both pages — no jump when the dive
hands over to the prism page (fresh chamber loads start at
`skyRotationOffset = 0`, so the horizontal position agrees too).

**Verified**: rendered at 1:1 and inspected — today's real phase (age 0.671,
73.8% waning gibbous) draws with the lit limb on the left, maria and halo
present, stars correctly occluded; measured centre (794, 60) matches the
intended (0.62w, 0.075h) exactly. Full dive run, no console/page errors; day
mode confirmed moonless.

**Cosmetic note for M:** at 1280×800 the halo's left edge just grazes the
volume control at top-centre. It's very faint and the position is the
principled one (matching the chambers), so it's left as is — say the word and
it can be nudged right/down.

### Slice 3 done (2026-08-03): shooting stars

Same look and physics as the chamber's (identical gradient/envelope/head
code), with two deliberate adaptations:
- **Spawn band widened.** The chambers use the top 3–13% of the viewport
  because only a sliver of sky shows above the ceiling wedges; here there's a
  whole open sky, so meteors spawn across `skyTop + (0.03…0.45)·h` — the
  upper ~45% of the frame, safely above the horizon at every point in the
  dive. Positions are canvas-space, so meteors pan with the stars and moon.
- **Cadence tightened.** The chamber's first-at-8–28s / then-16–44s suits a
  visit of any length; the dive only lasts ~50s, so it's first at 5–14s then
  every 12–26s.

**Verified**: with the timing constants rewritten in-flight by the test
harness (Playwright request interception — source untouched) every spawn
logged `y` inside the intended 424–760px band at 1280×800, and 1:1
screenshots show correct tapered streaks with bright heads and mixed
left/right directions. At the shipped constants a full dive produced 4
meteors at 12.7s / 36.1s / 51.0s / 64.4s (headless runs slower than real
hardware, so expect ~3), no page errors.

### Follow-up (2026-08-03): the moon popped in a beat after the page

M reported the moon arriving a split second late on `/immersive`, and asked
for "everything appears at once" as a general rule for page transitions.

**Cause, measured not guessed:** `updateSky` is throttled to every 3rd call
(`skyFrame % 3`), and `skyFrame` started at 0 — so the first *two* calls
returned without drawing and the sky canvas stayed empty until the third
animation frame. Those opening frames are the most expensive in the page's
life (WebGL init + shader compile), so instrumentation showed **first paint
at 248ms but first sky draw at 2312ms** on a cold headless load. The stars
are too faint for anyone to notice arriving late; a big bright moon is not.

**Fix** (`immersive.astro`): `skyFrame` starts at −1 so the first call draws
(cadence otherwise unchanged), plus one synchronous `updateSky()` at the end
of init, before the sequence starts. The wall-sky texture is deliberately
*not* warmed there — a 4096×2048 fill that nothing shows until the prism
rises ~40s in has no business on the first-paint path. `startImmersive()`
re-seeds `_nextMeteorAtMs`, since the init paint would otherwise set the
meteor clock from page load, which on the gated re-entry path can be long
before the sequence actually begins.

**Verified**: across three runs the first sky draw now precedes the first
`composer.render()` by 51–122ms, so nothing visible can arrive before the
sky; both pages screenshot correctly, no errors.

The same `skyFrame = 0` pattern in `prism.js` got the same one-line change.
Nothing there is user-visible today (the scene-curtain holds far longer than
three frames), but it makes "the sky is never blank once the room is shown"
true by construction rather than by accident.

---

**All three slices are code-complete and await M's eye on the tunnel.** Once
he's happy, this whole section should collapse into a short *Immersive sky*
entry in CLAUDE.md (the section map's sky row is already updated) and move to
*Resolved*.

---

## 🔷 OPEN, M's standing request (raised 2026-08-03): geometric-motion polish

> **➡️ Investigated, planned and half-built 2026-08-07 — see
> [`MOTION.md`](./MOTION.md), which now owns this thread entirely.**
>
> The **rotation** side (slices A–D) is **built and awaits M's eye**: mid-turn
> clicks now re-target the turn in flight instead of being discarded (measured
> 1-of-4 → 4-of-4 registered), an ease-in-out curve replaces the ease-out that
> left rest at 1.84× average velocity, duration scales with distance travelled,
> and the settle frame no longer carries every deferred job at once.
>
> The **heavens-tilt** side (slices E–F) is **not built**. It's still per-frame
> JS on the main thread — measured at ~27fps across a 4200ms tilt — and the
> tilt back runs 2.1× faster than the tilt up for the same 90°. That is the
> most likely home of the "tiltback" clunkiness M named, and it's what comes
> next here. It wants doing as one piece of work with item 4 below (extending
> the compositor star layer to tilt), not twice.

**M's words:** the rotation and heavens-tilt-back mechanisms "aren't bad at
all", but "if I were a pro game developer, I'd be trying to make this stuff
as smooth as possible" — there's "still a touch of clunkiness to iron out in
the various geometrical motions." Not a bug report; a standing quality bar.
Re-raised 2026-08-07 with the book three weeks out.

Note this is **distinct from** the sky-motion work above, which was about the
*star canvas* keeping pace with the walls. This is about how the wall motion
itself *feels*.

The original framing is superseded by `MOTION.md` and not repeated here, with
one item still live and not yet owned by that file:

4. **Sky-layer extension** (carried over from the round-4 list above):
   extending the compositor star layer to tilt. Do it together with slice E.

The old warning on this section — *don't act on a general description without
pinning the symptom first*, the lesson of Known Issue #1 — was honoured by
measuring before building; `MOTION.md`'s findings section is that measurement,
and it stands as the model for the tilt work too.

---

## Parked ideas

- **Comet ZTF cameo** — built for the chamber night sky, then cut for
  realism (real comets hang near-motionless night to night, unlike a
  meteor). Could return someday as a *fixed* (non-moving) apparition on
  rare nights. Code isn't in the tree; would be rebuilt from scratch if
  revisited.
- **Illuminated initials on field-note pages** — the chamber/reader drop
  caps (see CLAUDE.md, Chamber Sky & Ritual Layer) rely on
  `.chamber[data-prism-id]` CSS scoping; the field-note SEO pages are a
  separate layout with no chamber wrapper, so they don't have this at all.
  Would need its own styling + a chamber→colour mapping. Not requested.

**Corrections, 2026-07-23 (both were stale documentation, not real open
items — checked directly against the code, nothing to build):**
- ~~Immersive 3D candles not yet persisted~~ — there ARE no 3D candles in
  `/immersive`; that whole feature (candles, freelook camera, transmission
  search) was documented in CLAUDE.md's immersive.astro section map but
  never actually exists in the file. M confirmed he's happy with the
  candles as they are (the real ones, in the CSS chamber shrine) and
  doesn't want this pursued. CLAUDE.md's stale claims removed.
- ~~Illuminated initials in the portrait/fullscreen reader~~ — tested
  directly (Playwright, portrait viewport, screenshot): it already works.
  `#wall-portrait-reader` turns out to be nested inside
  `.chamber[data-prism-id]`, so the existing CSS selector already reaches
  the cloned text. Nothing was ever broken here.

---

## Resolved this cycle (full detail lives in CLAUDE.md / AUDIO.md — not duplicated here)

- **Audio static crackle** (2026-07-20) — `DynamicsCompressorNode` added to
  the event-engine master bus. Full incident writeup: `AUDIO.md` Part 7.
- **Chamber audio bleeding across pages** (2026-07-20) — `pagehide` safety
  net added to both audio systems. `AUDIO.md` Part 7.
- **Ghost rim wedges at wide aspect ratios** (2026-07-14) — cap-only,
  heavens-gated culling fix. CLAUDE.md → Known Issues → Resolved.
- **Eternal Return multi-spin** (2026-07-20, was Known Issue #3) — missing
  forced reflow in `leaveShrineHeavens()`'s instant-snap let the browser
  animate the raw rotation drift. CLAUDE.md → Known Issues → Resolved.
- **M's original 2026-07-13/14 punch list** — text materialisation
  (open/close), day-mode pillarbox (extended to night), the Eternal Return
  spin, and the sky-motion structural fix (round 4 above) — the whole
  agreed order is now addressed. Everything from that cycle not called out
  above (candle glow, dust motes, illuminated initials, candle persistence,
  celestial time/fixed firmament/real-phase moon/shooting stars, curtain
  shimmer, tab-return curtain rounds 1–2, themed 404 page, purpose-made OG
  card, landing corner-image fixes) already has its permanent writeup in
  CLAUDE.md — see the *Chamber Sky & Ritual Layer* section, *Known Issues →
  Resolved*, and the session changelog at the bottom of that file.
