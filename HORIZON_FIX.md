# HORIZON_FIX — daytime horizon "polygonal halo" handoff

*Written 2026-06 for the next Claude instance. The user is happy with the new
daytime sky **colours** — do NOT change those. There is one remaining horizon
artefact to fix, described below. This conversation got long and the Three.js
file is token-heavy, so this is a cold-start brief.*

---

## The symptom (user's words, + my read of the screenshot)

In the immersive scene (`/immersive`), **daylight toggle only**, once the hex
plane has finished expanding to its fullest radial extent:

- The lovely **curved (planetary) horizon** is *extended* by a faint **fuzzy
  halo** at roughly **11 o'clock and 1 o'clock** — two shallow, rounded-off
  triangular lobes growing up out of the horizon line.
- Net effect: the horizon reads as a **vaguely polygonal envelope** instead of a
  clean curve. The user has seen this exact issue "once before" (so it's a
  recurrence — worth `git log`-ing for the prior fix).
- **Night toggle is clean** — a proper curved horizon. We want day to match.

The user does NOT want a colour-match band-aid; they want a *proper curved
horizon* like nighttime.

---

## Where the relevant code is

All in **`src/pages/immersive.astro`** (line numbers drift — search the quoted
strings). The floor is a serpentine-plasma shader on a flat plane that fades out
near the horizon.

- **Floor plane geometry/position** (~L560-563):
  `new THREE.PlaneGeometry(50, 40, 1, 1)`, rotated flat, `position.set(0, -0.005, -14)`.
  So in world space the plane spans **X∈[-25,25], Z∈[-34, 6]** (its far edge is
  at Z≈-34, well past the visible horizon).
- **The fade block** in `serpentFragment` (~L493-534). This is the whole story:

```glsl
float dist = length(worldPos - vec2(0.0, -14.0));        // worldPos = (x, z)
float fade = 1.0 - smoothstep(12.0, 25.0, dist);          // (A) RADIAL fade — a CIRCLE
float farZFade = smoothstep(-27.5, -18.0, worldPos.y);    // (B) Z fade — a HORIZONTAL band
fade *= farZFade;                                          // (A)∩(B)

float revealDist = length(worldPos - vec2(0.0, -2.0));
float reveal = 1.0 - smoothstep(uRevealRadius - 1.5, uRevealRadius, revealDist); // grid draw-in wipe

col *= reveal;
float baseAlpha = fade * reveal;
vec3  dayCol    = mix(uHorizonColor * reveal, col, fade);
vec3  finalCol  = mix(col * fade, dayCol, uSkyIsDay);      // night colour→black ; day = dayCol
float a         = mix(reveal,     baseAlpha, uSkyIsDay);   // night opaque ; day alpha-dissolves
a = max(a, 1.0 - uGlobalAlpha);
gl_FragColor = vec4(finalCol * uGlobalAlpha, a);
```

- **`uHorizonColor`** uniform (~L555): currently `0x6EA0D0` (light sky-blue, the
  daytime gradient's horizon stop). Day-mode dissolve target. (Night no longer
  uses it.)
- **Sky gradients (LEAVE THE COLOURS ALONE)**: 2D canvas day gradient (~L983-1000,
  `#2F64A8 → #6EA0D0 → #8FBBE2`) and the matching wall sky (~L1156). `uSkyIsDay`
  comes from `sessionStorage.skyMode` (`'day'` vs night), set by the landing-page
  toggle (~L831).

> ⚠️ The comment at ~L512-522 ("Both night and day modes now fade alpha to 0…")
> is **stale** — night was later changed to stay opaque (`a = reveal`) and fade
> *colour* to black. Don't trust that comment; trust the code above.

---

## Root cause (my best analysis)

The floor's edge silhouette is `fade = radial(A) * farZFade(B)`:

- **(A) radial** `1 - smoothstep(12,25, dist-from-(0,-14))` is a **circle** →
  gives the clean curved horizon.
- **(B) farZFade** `smoothstep(-27.5,-18, worldZ)` is a **horizontal line of
  constant Z** → it flattens/cuts the floor straight across the front.

Multiplying a disc by a half-plane gives a shape that is **flat across the centre
(12 o'clock, governed by B) but bulges out to the wider circle at the sides
(11 & 1 o'clock, governed by A)**. Those side bulges past the flattened centre
are exactly the **two rounded-triangle lobes**.

**Why day-only / why it appeared now:**
- In **night** mode `a = reveal` (opaque) and only the *colour* carries this
  shape, fading to **black against a black sky → invisible**. The perceived
  horizon is just the circular plasma boundary → clean curve.
- In **day** mode `a = baseAlpha = fade*reveal`, so this flat-centre+bulging-sides
  shape becomes the **actual alpha silhouette** against the sky.
- It was **always present in day**, but previously *hidden*: the old horizon sky
  was near-black/dark-indigo and `uHorizonColor` matched it, so the low-contrast
  edge didn't read. Recolouring the horizon to **light blue** (which the user
  likes) raised the contrast and the pre-existing lobes became visible. So the
  recolour didn't *create* the geometry; it *revealed* it.

`farZFade` (B) exists for a real reason: without it, the hex grid's natural
**hexagonal far edge** silhouettes as a jagged "peaky" line against the sky
(see its comment ~L496-503). So you can't just delete it; you must replace what
it does with something that's *radially* shaped.

---

## Suggested fixes (ranked; aim for a clean curved DAY horizon)

**Option 1 — make the day edge purely radial (recommended).**
Drop `farZFade` from the **day alpha** so the visible day silhouette is the
circle (A) only, and re-tune (A) so the floor is already fully transparent
*before* the hex grid's jagged far edge would show — making (B) unnecessary for
the visible edge. Concretely:
- Pull the radial outer radius in (e.g. `smoothstep(12.0, 25.0,…)` →
  tighten so `fade` hits 0 at a radius whose far arc sits inside Z>-27.5 in every
  azimuth), OR nudge the radial **centre** so the circle closes before the grid's
  hex boundary in all directions.
- Keep `farZFade` only where it still helps (e.g. fold it into the *night colour*
  fade, which is invisible anyway), or gate it: `float aFade = mix(fade /*night incl. farZ*/, radialOnly, uSkyIsDay)`.
- **Verify** the "peaky hexagonal silhouette" does NOT return at the far grid
  edge in day mode once farZFade is removed from the day alpha. If it does, the
  radial fade isn't closing early enough — tighten further.

**Option 2 — replace the Z-band (B) with a radial far-fade.**
Swap `farZFade = smoothstep(-27.5,-18, worldPos.y)` for a *distance*-based fade
(reuse `dist`, or a second radial term) so BOTH the grid-edge dissolve and the
horizon are circular. One well-chosen radial fade can do the job of (A)+(B).
Re-tune radii so the hex grid's jagged perimeter is inside the fully-transparent
zone. This is the cleanest conceptually (everything circular = everything curved).

**Option 3 — opaque-day mirror of the night trick (more work, maybe nicer).**
Make day also opaque (`a = reveal`) and fade `dayCol` *to the sky colour behind
that pixel*. Problem: the day sky is a **vertical gradient**, so a single
`uHorizonColor` can't match it at all screen heights. You'd need to sample the
sky gradient by screen-Y (pass it as a uniform/!texture, or reconstruct the few
gradient stops in-shader) so the opaque floor edge dissolves invisibly into the
exact sky tone at that height. Heavier, but removes any star/halo bleed in both
modes for good.

**Option 4 — colour-match band-aid (the user explicitly does NOT want this).**
Tune `uHorizonColor` + the `farZFade` band so the day alpha edge dissolves
imperceptibly into the light-blue sky again. Quick but fragile (the lobes still
exist; they'll resurface on any future sky/exposure tweak). Documented only for
completeness — prefer 1 or 2.

**My recommendation:** try **Option 2** first (one radial fade, everything
circular), falling back to **Option 1** if the hex-edge peakiness is stubborn.

---

## How to test

- Toggle daylight: the landing page (`/`) has the sky toggle, or set
  `sessionStorage.setItem('skyMode','day')` then load `/immersive`.
- Let the hex grid fully expand (the radial draw-in finishes), then look at the
  horizon at ~11 and ~1 o'clock. Success = a single clean curve, no triangular
  lobes / fuzzy halo, no jagged hex "peaky" line at the far edge.
- Cross-check **night** mode is still a clean curve and stars are still occluded
  at the horizon (an earlier fix — night uses `a = reveal` + `col*fade`).
- Dev preview caveat (from `CLAUDE.md`): the Codespaces `…-4321.app.github.dev`
  tunnel is broken at GitHub's edge; use a Cloudflare quick tunnel
  (`cloudflared tunnel --url http://localhost:4321`) and hand the user the
  `trycloudflare.com` URL. `npm run build` is a fine syntax check but won't
  validate GLSL (shader errors only show at runtime in the browser console).

---

## Guardrails

- **Don't touch the sky gradient colours** (2D canvas ~L983-1000, wall sky ~L1156)
  — the user approved them.
- **Don't regress the night fixes**: (a) stars must stay occluded by the floor at
  the horizon (night `a = reveal`, colour `col*fade`→black); (b) night horizon
  stays a clean curve.
- Keep `uGlobalAlpha` working (global floor fade during transitions:
  `a = max(a, 1.0 - uGlobalAlpha)`).
- After fixing, update the stale comment at ~L512-522.
