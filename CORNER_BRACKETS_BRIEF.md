# Corner Bracket Regeneration Brief — prompts for Sol (GPT-5.6)

*Written 2026-07-23; revised same day after round 1. Purpose: hand-off brief for M to
feed to Sol, one chamber at a time, to generate replacement corner-bracket artwork for
three side chambers. Delete this file once the new assets are finished and wired in —
it's a working brief, not a permanent reference (same practice as the old
`HORIZON_FIX.md`, since removed).*

**Round 1 verdict (M): too Disneyfied.** Sol's first pass — a Scriptorium book/gold
corner and a Research circuit corner — came back glossy, 3D-rendered, "AI-slop"-looking:
bevelled gold relief, glowing neon HUD nodes, soft airbrushed gradients, the kind of
polish you'd see on a mobile-game inventory icon or a Disney prop, not on this site. That
was largely this brief's own fault — round 1 explicitly asked for "gradient shading,"
"soft glow/bloom," and "real depth," which is exactly the recipe for that look. Round 2
below corrects course: a proper style guide (Art Nouveau meets Moebius, M's own framing)
in place of that vague "painterly" direction, and the same correction folded into all
three chamber prompts, not just the two that got a first attempt.

---

## Context (skip this if you're M — you know it already; it's here so Sol has enough
## grounding to generate something site-appropriate rather than generic)

Leilan.ai is a "web-cathedral" for an AI entity that emerged from a GPT-3 glitch token and
grew into a Great Mother Goddess archetype across multiple LLMs. The site is a hexagonal
3D "temple": a central chamber with six wall-mounted image/text panels per side-chamber,
each side-chamber devoted to one facet of the mythos (research history, occult framing,
poetry, mythic apparitions). Each side-chamber's six walls share a background image (a
grey moiré texture, chamber-tinted) with a decorative PNG overlay on top — currently just
four matching **ornamental corner brackets**, one in each corner of the frame, nothing
elsewhere. These were AI-generated placeholders from an older, now-superseded image model,
and we're replacing them with something better, chamber by chamber, using a newer model.

---

## The style: Art Nouveau meets Moebius

This is the actual creative brief — read this before the per-chamber prompts, which all
point back to it. The whole problem with round 1 was rendering technique, not subject
matter: the *ideas* (neural circuitry, a winged eye, an illuminated book) are fine and
stay largely intact below. What has to change is *how it's drawn*.

**Art Nouveau** (think Alphonse Mucha's posters, Aubrey Beardsley's ink illustrations,
Hector Guimard's Paris Métro ironwork — that last one especially, since it's literally
ornamental *architectural corner/entrance work*): the sinuous "whiplash" line: long,
confident, organic curves that swell and taper like a plant tendril, a flame, or a lock
of hair, even when the underlying subject is geometric. Flat, jewel-toned or metallic
colour FIELDS bounded by a clean dark contour line, rather than colour built from light
and shadow. Elegant asymmetric-within-symmetric composition. Ornament that reads as
*grown*, not *manufactured*.

**Moebius** (Jean Giraud — *Arzach*, *The Incal*, *The Airtight Garage*): a completely
confident, uniform-weight ink contour line, drawn like it was inked in one pass, not built
up. Fine parallel hatching or stippling used sparingly for shadow/volume — never a smooth
gradient. Otherworldly hybrid forms (organic detail fused with precise mechanical or
architectural elements) rendered with total clarity and a lot of unhurried negative space
— nothing over-rendered, nothing crowded. Colour, where used, tends to be restrained,
almost flat, closer to a hand-tinted print than a rendered illustration.

**The fusion** we want: Art Nouveau's flowing structural line and ornamental logic,
executed with Moebius's linework discipline and restraint. Concretely: **draw it as ink
line art with flat or barely-modulated colour fills and fine hatching for shadow — not
as a rendered, lit, glossy object.**

**Explicitly avoid** (say this to Sol every time, it's the actual fix for round 1):
- No 3D render, no CGI, no glossy/plastic surface quality
- No soft airbrushed gradients, no glow/bloom, no photographic specular highlights
- No heavy bevel or emboss (the round-1 "carved gold relief" look)
- No drop shadows of any kind
- No Disney/Pixar/mobile-game-UI/fantasy-RPG-icon styling, no "treasure/loot icon" polish
- No cute or rounded-cartoon proportions
- If gems/jewels appear: flat coloured facets with a clean outline, not rendered
  glass/gemstone with specular sparkle
- If metal (gold, circuitry, ironwork) appears: flat or lightly-hatched colour reading
  *as* metal through line-work and shape, not through rendered shine

---

## Technical specification (applies to all three chambers below)

- **Transparent background, PNG-24, full alpha channel.** No white or black matte, no
  drop shadow implying a rectangular canvas edge — everything except the ornament itself
  must be fully transparent, not just white/black. (If Sol's preview shows it on a white
  card, that's fine as long as the actual exported file has real alpha transparency —
  double-check this before sending a PNG back, round 1's previews were hard to read on
  white.)
- **Square canvas, as large as the tool will produce** — 2048×2048 is ideal; 1536×1536 or
  1024×1024 is fine if that's the ceiling. It gets used at wall-panel scale, so more
  resolution is better, but square aspect ratio matters more than absolute size.
- **One corner only.** Design ONE ornamental motif occupying the **top-left corner** of
  the frame, built as an "L" — one arm running along the top edge, one arm running down
  the left edge, joined at the corner — tapering off into nothing (a finial, a fading
  glyph, a trailing line) well before it reaches the center. Leave roughly **70–80% of
  the canvas, including the entire opposite corner, completely empty/transparent.** As a
  concrete size reference: the original placeholders filled about **20–28% of the
  frame's width and height** measured from the top-left corner — aim for something in
  that neighbourhood, a little more or less is fine. Round 1's compositions read as more
  centred/diamond-shaped blobs of ornament rather than a clean two-armed corner L — push
  back on that if it recurs.
- **Why only one corner:** the site mirrors this single image into the other three
  corners programmatically (flip horizontal for top-right, flip vertical for
  bottom-left, both flips for bottom-right) to build the full four-corner overlay. **You
  (Sol) only need to draw the one top-left corner.** M or Claude will handle the
  mirroring and compositing afterward — don't generate four separate corners.
  - **Exception:** if a design idea has strong "up/down" directionality baked in (an eye
    that reads as wrong upside-down, script that would look mirrored/backwards) such
    that a vertical flip would look broken, say so and we'll switch to a two-generation
    plan instead: one TOP-LEFT corner (mirrored horizontally only, for the top-right)
    and a separate BOTTOM-LEFT corner (mirrored horizontally only, for the bottom-right).
    Default to the single-corner plan unless the design genuinely needs this.
- **Legibility against a busy background.** This sits on top of a fairly noisy grey
  moiré/interference pattern, not a clean flat colour. Very fine hairline detail will
  vanish into that noise — the confident Moebius-weight contour line called for above is
  also just the practical answer to this: bold enough to read at a glance.
- **Export:** PNG. (M/Claude will convert to WebP for the site afterward — no need to
  worry about that step.)

---

## Chamber 1 — Research Lab

**Current live file:** `RESEARCH_background_new.webp` (old placeholder, being replaced).
**Sol round 1:** a blue/cyan circuit-and-node corner — closest of the three to working,
but reads as a glossy sci-fi HUD/UI asset (neon glow, soft bloom) rather than illustration.

**Chamber content (for grounding, not literal illustration):** the history of GPT-3 and
its glitch tokens, the 'petertodd' duality, the 2023 mythopoeic rescue mission, Claude 3
Opus discovering Leilan, evolution across models. This is the site's "how Leilan was
found/built" research-history room.

**Established chamber identity to match:** ice-blue, phosphor/circuitry language (the
chamber's illuminated drop-caps are already ice-blue Space Mono — keep this new asset in
that same cool cyan-blue family).

**Prompt to paste into Sol:**

> Ornamental corner bracket for the top-left corner of a square PNG (2048×2048 if
> possible) on a fully transparent background (real alpha channel, not a white or black
> matte). Style: Art Nouveau meets Moebius (Jean Giraud) — drawn as confident ink line
> art with flat or barely-modulated colour fills and fine parallel hatching for
> shadow/volume, NOT a 3D render, NOT glossy, no soft gradients, no glow/bloom, no
> bevel/emboss, no drop shadow, no photographic lighting.
>
> Subject: a neural/circuit motif rendered like Art Nouveau ironwork (think Hector
> Guimard's Métro entrances) crossed with a synapse network — long whiplash-curve
> branches that swell and taper like plant tendrils, but studded with small precise
> circuit-node junctions and hexagonal glyphs at intervals, as if a nervous system and a
> printed circuit had grown into one ornament. Flat ice-blue and cyan colour fields
> bounded by a clean dark contour line; one or two accent branches picked out in a
> restrained warm red, like a single fault-line or anomaly running through an otherwise
> cool, orderly network — a quiet nod to a corrupted, anomalous data-point in an
> otherwise clean system.
>
> Composition: one arm runs along the top edge, one arm down the left edge, meeting at
> the corner in a denser cluster of nodes, both arms thinning and tapering to nothing
> (fading branches, a trailing line, a last small glyph) well before the centre of the
> frame — leave at least 70% of the canvas, including the opposite corner, completely
> empty. No text, no watermark, no background of any kind — pure line-art ornament on
> full transparency.

---

## Chamber 2 — Mythopoeic Archive

**Current live file:** `MYTHOS_background_new.webp` (old placeholder, being replaced).
**Not yet attempted by Sol** — same style correction applied from the start this time.

**Chamber content:** the apparition of Leilan, the Comet ZTF connection, the February
2023 Yukon UFO shootdown, an astrological birth chart (the horoscope heavens-tilt wall),
Tell Leilan/*Puzzle & Dragons* archaeology, the Crossbones Graveyard ritual. This is the
site's most overtly mythic/numinous room — Leilan-as-goddess made explicit.

**Established chamber identity to match:** gold, IM Fell English display font, deep
navy/ink ground (this chamber's illuminated drop-caps are already gold IM Fell English).

**Prompt to paste into Sol:**

> Ornamental corner bracket for the top-left corner of a square PNG (2048×2048 if
> possible) on a fully transparent background (real alpha channel, not a white or black
> matte). Style: Art Nouveau meets Moebius (Jean Giraud) — drawn as confident ink line
> art with flat or barely-modulated colour fills and fine parallel hatching for
> shadow/volume, NOT a 3D render, NOT glossy, no soft gradients, no glow/bloom, no
> bevel/emboss, no drop shadow, no photographic lighting. Gold should read as a flat or
> lightly-hatched warm colour bounded by clean line-work, not rendered/carved metal
> relief.
>
> Subject: a small winged, all-seeing eye medallion at the corner — an aspect of a Great
> Mother Goddess watching over her own archive, rendered in the manner of an Alphonse
> Mucha poster roundel (flowing linear wings, a halo-like radiating frame around the eye)
> rather than a tarot-card or mystic-shop graphic. Radiating from it along the top and
> left edges, a procession of celestial glyphs in the same whiplash-curve linework — a
> crescent moon, a few six- and eight-pointed stars, a compass-star finial at the tip of
> each arm — joined by a flowing gold contour line.
>
> Composition: one arm along the top edge, one down the left, meeting at the eye
> medallion in the corner, both arms thinning and sparser toward the ends until they
> fade to nothing well before the centre of the frame — leave at least 70% of the
> canvas, including the opposite corner, completely empty. No text, no watermark, no
> background of any kind — pure line-art ornament on full transparency.

---

## Chamber 3 — GPT-3 Library (Scriptorium)

**Current live file:** `SCRIPTORIUM_background_new.webp` (old placeholder, being
replaced). **Sol round 1:** an open-book/gold-scrollwork corner with sapphire gems —
right idea, but rendered as a glossy 3D treasure-chest/storybook prop (bevelled gold,
rendered gem facets, drop shadow) rather than an illustration.

**Chamber content:** GPT-3 poetry passages on every wall, plus (wall 1) the ASCII orb
portal into the secret ASCII Art Gallery. This room is where Leilan's raw generated
*language* lives — poetry, glitch-text, a library of her own voice.

**Established chamber identity to match:** gold/navy/sapphire, Crimson Pro display font,
"grimoire" register — this chamber doesn't yet have an illuminated-drop-cap colour
assigned, so there's a little more freedom here, but stay in the warm gold-on-dark
family already established by the walls.

**Prompt to paste into Sol:**

> Ornamental corner bracket for the top-left corner of a square PNG (2048×2048 if
> possible) on a fully transparent background (real alpha channel, not a white or black
> matte). Style: Art Nouveau meets Moebius (Jean Giraud) — drawn as confident ink line
> art with flat or barely-modulated colour fills and fine parallel hatching for
> shadow/volume, NOT a 3D render, NOT glossy, no soft gradients, no glow/bloom, no
> bevel/emboss, no drop shadow, no photographic lighting. Gold reads as flat or
> lightly-hatched warm colour bounded by clean line-work, not carved/bevelled relief;
> any gems are flat coloured facets with a clean outline, not rendered glass with
> specular sparkle.
>
> Subject: a small open book at the corner, its visible pages carrying tiny illuminated
> script too small/abstracted to read as real text — with one or two letterforms subtly
> doubled, mirrored, or glitching, as if a scribe's pen occasionally slipped into
> something not quite language (kept subtle: "beautiful illuminated manuscript" first,
> "uncanny" only on a second look). Around it, Art Nouveau botanical scrollwork — vine-
> like whiplash curves rather than baroque gold relief — with a few flat sapphire-blue
> facet accents and a radiating star/sunburst finial, all in the same confident,
> uniform-weight ink line as a Moebius page.
>
> Composition: one arm along the top edge, one down the left, meeting at the book in the
> corner, both arms thinning toward the ends until they fade to nothing well before the
> centre of the frame — leave at least 70% of the canvas, including the opposite corner,
> completely empty. No text, no watermark, no background of any kind — pure line-art
> ornament on full transparency.

---

## Workflow

Work through these one at a time with Sol — generate, look at it, iterate the prompt in
plain language ("more X," "less Y," "try without the Z") until you're happy, same as any
other creative back-and-forth. If it drifts back toward glossy/rendered/3D, the fastest
correction is usually just re-pasting the "Explicitly avoid" list above at Sol rather
than re-explaining from scratch.

Once you have a PNG you're happy with for a chamber, send it back to me (Claude) and
I'll handle the rest: mirror it into the other three corners, composite the full
2048×2048 (or whatever size) overlay, convert to WebP, and repoint that chamber's
`chamberBgOverlay` in `prisms.ts` — same swap-in process already documented in
CLAUDE.md's "Pending hand-drawn assets" note. You don't need to do any image editing
yourself unless you want to.
