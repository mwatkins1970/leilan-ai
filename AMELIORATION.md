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

Lead #3 (verify the handler fires at all for his pattern — bfcache restores,
whether `visibilitychange` fires) is still unverified; only M's hardware can
settle it. **Test recipe unchanged**: open a chamber → background the tab for
several minutes of active use elsewhere → return; M's eye is ground truth.
If round 3 doesn't fix it, the settle heuristic itself (not just its
constants) is the next thing to question — rAF timing during a GPU-bound
re-raster may not degrade as cleanly as assumed.

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

## Parked ideas

- **Comet ZTF cameo** — built for the chamber night sky, then cut for
  realism (real comets hang near-motionless night to night, unlike a
  meteor). Could return someday as a *fixed* (non-moving) apparition on
  rare nights. Code isn't in the tree; would be rebuilt from scratch if
  revisited.
- **Immersive hex-world sky parity** — the moon/meteors/fixed-firmament
  work only ever landed in the chamber sky (`prism.js`); `immersive.astro`
  has its own separate, simpler sky. Porting the chamber's sky richness
  there is an available follow-up, not requested yet.
- **Illuminated initials in the portrait/fullscreen reader** — currently
  only on in-chamber wall texts; the reader clones text outside the wall
  panel so the CSS rule doesn't reach it. Same for field-note drop caps.
- **Immersive 3D candles not yet persisted** — chamber shrine candles
  persist lit state across visits (see CLAUDE.md); the separate Three.js
  candles in `/immersive` don't yet.

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
