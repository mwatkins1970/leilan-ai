# Leilan.ai Mobile / Responsive Handoff

## Purpose

Leilan.ai is now live and the desktop/laptop experience is visually successful. The immediate task is to add a careful mobile-responsive layer **without damaging or changing the existing laptop/desktop experience**.

This document defines the desired behaviour for smartphone, tablet, and desktop views, and gives a staged implementation/testing plan.

The first implementation phase should focus only on the **landing page smartphone experience**. After that has been reviewed and approved, continue to the immersive/chamber and field-notes work.

---

## Core principle: preserve the desktop site

The current laptop/desktop presentation is the canonical experience and should remain visually unchanged.

Do **not** “make the whole site responsive” by scaling down or rewriting the desktop design globally. Instead:

- Keep existing desktop styles and layouts as the default/base experience wherever possible.
- Add mobile/tablet overrides using scoped CSS media queries and/or responsive components.
- Avoid modifying desktop camera positions, desktop layout dimensions, desktop button styling, or desktop animation timing unless absolutely necessary.
- If shared components must be edited, verify that their desktop rendering is unchanged.
- Treat any desktop visual change as a regression unless explicitly approved.

Suggested breakpoint discipline:

- Desktop/laptop: preserve existing experience at normal laptop/desktop widths, for example `min-width: 901px`.
- Smartphone portrait: target narrow portrait screens, for example `max-width: 600px` and `orientation: portrait`.
- Smartphone landscape: target small landscape screens, for example `max-width: 900px` and `orientation: landscape`.
- Tablet: leave mostly alone initially unless obvious breakage appears; tablet optimisation can come later.

Important nuance: the site usually cannot know “this is a laptop” with certainty. It can know the **viewport shape/size**, orientation, pointer type, and similar conditions. So a very narrow desktop browser window may trigger mobile styles. That is acceptable, but normal laptop fullscreen/windowed usage should remain the same.

---

## Global technical requirements

Please check and implement the following where appropriate.

### 1. Viewport metadata

Ensure the site has a correct viewport tag, likely in the main HTML/app shell:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

`viewport-fit=cover` allows proper use of safe-area insets on phones with notches or rounded corners.

### 2. Avoid old mobile viewport traps

For fullscreen/cinematic pages, prefer dynamic viewport units where supported:

```css
height: 100dvh;
width: 100dvw;
```

Avoid relying only on old `100vh` for mobile fullscreen layouts, because mobile browser chrome can distort the visible height.

Where necessary, use fallbacks:

```css
height: 100vh;
height: 100dvh;
```

### 3. Safe areas

For phone controls near the edges, account for safe areas:

```css
padding-left: max(16px, env(safe-area-inset-left));
padding-right: max(16px, env(safe-area-inset-right));
padding-bottom: max(16px, env(safe-area-inset-bottom));
padding-top: max(16px, env(safe-area-inset-top));
```

### 4. Touch target size

Any tappable control on phone should be at least about `44px × 44px`, preferably `48px × 48px` or larger for important controls.

This applies especially to:

- hamburger/menu button
- day/night toggle
- chamber rotation arrows
- door/hotspot buttons
- video-launch buttons
- close buttons in any modal
- text links that behave like controls

### 5. No hover-only interactions on mobile

Anything that currently depends on hover should also work by tap/click on touch devices.

Use media queries such as:

```css
@media (hover: none), (pointer: coarse) {
  /* mobile/touch affordances */
}
```

### 6. Performance guardrail for 3D/canvas scenes

For Three.js/canvas/WebGL scenes on mobile, cap device pixel ratio if needed:

```js
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
```

Make sure resize/orientation changes update:

- renderer size
- camera aspect ratio
- projection matrix
- any canvas/container dimensions

---

## Page classes and desired behaviour

The site should be treated as three different kinds of experience.

---

# A. Landing page

## Desired phone behaviour

The landing page **should work in phone portrait**.

Current observation: on a friend’s smartphone, the circular central image looked good, but the menu, day/night toggle, and other peripheral UI/details were ridiculously small.

The solution is not simply to shrink the desktop page. The phone landing page needs its own composition.

## Smartphone portrait requirements

For narrow portrait screens:

- Keep the central circular Leilan image prominent.
- Size the central circle around `75–90vw`, depending on what looks best.
- Make the menu/hamburger button large and tappable.
- Make the day/night toggle large and tappable.
- Do not rely on tiny labels or far-corner glyphs as primary navigation.
- Decorative circuitry/background material may remain atmospheric, but should not contain essential tiny information.
- Avoid horizontal overflow.
- Ensure the first screen feels intentionally composed, not like a cropped desktop poster.
- Consider a vertical layout: central image, then large ritual-looking navigation choices/buttons.
- Preserve the existing desktop landing page at laptop widths.

## Possible mobile landing layout

A good starting point would be:

1. Background remains dark, textured, atmospheric.
2. Central image large and centred.
3. Menu button fixed or placed clearly near top-left, at mobile touch size.
4. Day/night toggle fixed or placed clearly near top-right, at mobile touch size.
5. Key navigation options appear below the central image as large touch-friendly buttons or panels.
6. Edge glyphs/circuitry are decorative only and may be simplified, dimmed, cropped, or repositioned.

## Landing page acceptance criteria

On a smartphone portrait viewport:

- The central circular image is beautiful and legible.
- The hamburger/menu is easy to tap.
- The day/night toggle is easy to tap.
- No important clickable element is tiny.
- No horizontal scrolling.
- The page feels designed for phone, not accidentally squeezed.
- Desktop/laptop landing page remains visually unchanged.

## First implementation phase

Start here and stop after this phase for review.

Deliver:

- Mobile portrait landing page CSS/layout changes.
- No changes yet to immersive/chamber behaviour unless necessary to avoid obvious breakage.
- A short note describing exactly which files/components were changed.
- Screenshots or test notes for:
  - desktop/laptop landing page
  - phone portrait landing page
  - phone landscape landing page, if affected

---

# B. Immersive page

Relevant route observed:

- `/immersive/`

## Desired behaviour

This is a cinematic/3D landscape experience. It should **not** try to function as a portrait-mode webpage.

Current observation: on a friend’s phone, portrait orientation showed only a crop of the landscape. The arising chamber was visible, but there was no sense of the wider swarming hexagonal landscape.

## Smartphone portrait gate

For anyone viewing this kind of page on a phone in portrait mode, show a gate/overlay instead of the cropped scene.

Exact copy to use:

> This part of the dream is best entered sideways.  
> Rotate your phone to landscape,  
> or visit from a larger screen for the full environment.

Keep the line breaks as above if possible.

The gate should feel visually consistent with the site: dark, luminous, ceremonial, not like a generic browser alert.

## Important limitation

Do not attempt to force orientation. Browsers generally cannot reliably force a user’s phone to rotate. The page should detect portrait/small-screen state and politely ask the user to rotate. If orientation lock is enabled, the user may need to disable it or visit on a larger screen.

## Smartphone landscape behaviour

When a phone is in landscape:

- Show the immersive scene fullscreen.
- Use actual viewport dimensions, not desktop assumptions.
- Ensure the camera/framing shows the landscape, not just a crop.
- Consider a mobile-landscape camera adjustment:
  - possibly wider field of view
  - adjusted camera distance/height
  - adjusted near/far clipping if needed
- Ensure any loading controls, audio controls, or UI overlays are large enough to tap.
- Avoid browser chrome issues by using `100dvh/100dvw`.
- Cap renderer pixel ratio if performance is poor.

## Immersive acceptance criteria

On phone portrait:

- The user sees the orientation gate, not a useless crop.

On phone landscape:

- The user gets a convincing cinematic sense of the hexagonal landscape.
- The arising chamber is visible in context.
- The scene resizes correctly after rotation.
- Controls are touch-friendly.
- Desktop/laptop immersive experience remains visually unchanged.

---

# C. Chamber / Prism pages

Relevant observed route:

- `/prism/main/`

There may be other `/prism/...` chamber routes. Apply the same logic to all internal chamber pages unless a route is intentionally text-only.

## Desired behaviour

These pages are also cinematic landscape experiences, not portrait webpages.

Current observation: on a friend’s phone, portrait orientation gave a crop with no sense of chamber architecture, and the lower-left/lower-right rotation buttons were likely missing or unusable.

## Smartphone portrait gate

Use the same orientation gate/copy as the immersive page:

> This part of the dream is best entered sideways.  
> Rotate your phone to landscape,  
> or visit from a larger screen for the full environment.

## Smartphone landscape behaviour

When in phone landscape:

- Show the chamber fullscreen.
- Ensure left/right rotate-view arrows are visible and large enough to tap.
- Place controls inside safe areas and above mobile browser UI.
- Ensure doors/hotspots/buttons are tappable without hover.
- Avoid putting important controls too close to screen corners.
- Resize canvas/backgrounds according to actual viewport.
- Adjust camera/framing if the desktop chamber view crops badly on phone landscape.
- Preserve the architectural sense of the chamber as much as possible.

## Video behaviour inside chambers

On desktop, videos may work well as wall-embedded experiences.

On phone, a video displayed as a small texture on part of a chamber wall may be too small to watch.

Recommended mobile behaviour:

- When a user taps a video wall/button/hotspot on phone, open the video in a fullscreen or near-fullscreen modal overlay.
- The chamber can remain the “portal,” but the actual viewing should be large enough to watch.
- Include a large obvious close button.
- Ensure native video controls are available unless there is a deliberate custom control system.
- Do not break the existing desktop wall-video behaviour.

## Chamber acceptance criteria

On phone portrait:

- The user sees the orientation gate.

On phone landscape:

- The chamber is visible as an environment, not an accidental crop.
- Rotation arrows are visible and easy to tap.
- Door/hotspot/video controls work by tap.
- Videos are watchable.
- Desktop/laptop chamber experience remains visually unchanged.

---

# D. Field notes pages

Relevant observed route:

- `/field-notes/solidgoldmagikarp/`

Field notes pages are text-first and exist partly for SEO and readers arriving from the book.

## Desired behaviour

These should be ordinary responsive reading pages and should work well in phone portrait.

The desktop pages already look elegant. On phone, they need a typography/layout pass.

## Smartphone requirements

For narrow screens:

- Body text should be comfortably readable, likely around `17–19px`.
- Line-height should be generous, likely around `1.5–1.7`.
- Page margins should be phone-appropriate, likely around `18–24px`.
- Headings should scale down gracefully.
- Buttons should stack if horizontal layout becomes cramped.
- Links should be tappable.
- No horizontal overflow.
- Images, if present, should max out at `100%` width.
- Long words/URLs should not break the layout.

Suggested CSS patterns:

```css
img, video, canvas {
  max-width: 100%;
}

.field-notes {
  overflow-wrap: break-word;
}

@media (max-width: 600px) {
  .field-notes {
    padding-inline: 20px;
    font-size: 18px;
    line-height: 1.6;
  }

  .field-notes h1 {
    font-size: clamp(2rem, 10vw, 3rem);
  }
}
```

## Field notes acceptance criteria

On phone portrait:

- Text is pleasant to read.
- No sideways scrolling.
- Buttons/links are easy to tap.
- Page still feels like the same elegant Leilan field-notes style.
- Desktop/laptop field-notes pages remain visually unchanged.

---

## Orientation gate implementation notes

Create a reusable orientation gate component or CSS overlay rather than duplicating one-off code.

Possible logic:

- Show gate when:
  - viewport is small/narrow enough to count as phone, and
  - orientation is portrait, and
  - route is an immersive/chamber route.
- Do not show gate on:
  - desktop/laptop
  - field notes pages
  - landing page
  - phone landscape

Possible CSS condition:

```css
@media (max-width: 900px) and (orientation: portrait) {
  .cinematic-page .orientation-gate {
    display: flex;
  }

  .cinematic-page .cinematic-content {
    display: none;
  }
}
```

And:

```css
@media (min-width: 901px), (orientation: landscape) {
  .cinematic-page .orientation-gate {
    display: none;
  }

  .cinematic-page .cinematic-content {
    display: block;
  }
}
```

Adjust actual class names and rendering logic to match the codebase.

## Gate visual direction

The gate should feel like it belongs to the site:

- dark background
- luminous green/gold/white text as appropriate
- maybe a simple glyph or rotating phone icon if one already exists or can be made simply
- large readable text
- centred composition
- no tiny decorative text
- no browser alert boxes

Suggested hierarchy:

```text
This part of the dream is best entered sideways.
Rotate your phone to landscape,
or visit from a larger screen for the full environment.
```

---

## Testing plan

Testing should happen in phases, not as one giant refactor.

## Phase 1: landing page smartphone

Implement only the landing-page mobile changes first.

Test:

1. Desktop/laptop normal width:
   - landing page should look unchanged.
2. Desktop browser narrowed:
   - mobile layout may appear; this is okay if it behaves sensibly.
3. Phone portrait emulation:
   - central image prominent
   - controls tappable
   - no overflow
4. Real phone if available:
   - iPhone Safari ideally
   - Android Chrome ideally
   - at minimum, one real smartphone borrowed from someone

Stop here for review before continuing.

## Phase 2: orientation gate

Implement reusable gate and apply to:

- `/immersive/`
- `/prism/...` cinematic chamber routes

Test:

1. Desktop/laptop:
   - no gate shown
   - experience unchanged
2. Phone portrait:
   - gate shown
   - copy exactly as specified
3. Phone landscape:
   - gate hidden
   - cinematic scene shown
4. Rotate phone while page is open:
   - portrait → landscape should reveal the scene
   - landscape → portrait should show the gate again
5. Orientation lock:
   - gate text still makes sense

## Phase 3: immersive landscape mobile framing

Optimise `/immersive/` for phone landscape.

Test:

1. Scene fills visible viewport.
2. Hexagonal landscape has architectural breadth.
3. Arising chamber is visible in context.
4. No obvious crop that destroys the intended experience.
5. Performance acceptable.
6. Desktop view unchanged.

## Phase 4: chamber/prism landscape mobile controls

Optimise `/prism/...` chamber pages for phone landscape.

Test:

1. Chamber architecture visible.
2. Left/right arrows visible and tappable.
3. Doors/hotspots/buttons tappable.
4. No hover-only controls.
5. Controls not hidden by browser UI or phone notch.
6. Desktop view unchanged.

## Phase 5: mobile video behaviour

If chamber videos are too small on phone, implement mobile-specific modal/fullscreen video behaviour.

Test:

1. Tapping video hotspot opens large video.
2. Close button works and is tappable.
3. Native video controls work.
4. Returning to chamber is clean.
5. Desktop wall-video behaviour unchanged.

## Phase 6: field notes mobile typography

Do a responsive reading pass on field-notes pages.

Test:

1. Phone portrait readability.
2. No horizontal overflow.
3. Buttons stack gracefully.
4. Links tappable.
5. Desktop field-notes pages unchanged.

---

## Regression checklist

Before each phase is considered done, check these desktop/laptop views:

- landing page
- `/immersive/`
- `/prism/main/`
- at least one other chamber route if present
- `/field-notes/solidgoldmagikarp/`

For each, verify:

- layout unchanged
- controls still work
- animations still work
- audio/video still work, if applicable
- no new scrollbars or cropping
- no console errors

---

## Developer notes / likely implementation approach

The safest approach is probably:

1. Identify top-level route/page components:
   - landing
   - immersive
   - prism/chamber
   - field notes

2. Add page-level classes:
   - `.landing-page`
   - `.cinematic-page`
   - `.field-notes-page`
   - or whatever naming fits the codebase

3. Add mobile styles scoped under those classes.

4. For cinematic routes, add a reusable orientation gate component.

5. Keep desktop styles as default. Put mobile-only changes inside media queries.

6. For Three.js/canvas/cinematic scenes, add resize/orientation handling if not already robust:
   - listen for `resize` and/or `orientationchange`
   - recompute container size
   - update camera aspect
   - update projection matrix
   - update renderer size
   - avoid stale cached dimensions from initial desktop assumptions

7. Only after structural mobile behaviour works, tune camera/framing.

---

## Non-goals for the first pass

Do not do these in the first phase:

- Do not redesign the desktop/laptop site.
- Do not refactor all cinematic pages at once before the landing-page mobile review.
- Do not replace the whole visual system.
- Do not make the immersive/chamber pages into portrait-mode experiences.
- Do not optimise tablets deeply yet.
- Do not change content, copy, SEO field-notes wording, or navigation structure unless needed for mobile usability.
- Do not remove the existing laptop cinematic character of the site.

---

## Summary of intended final behaviour

Phone portrait:

- Landing page: beautiful mobile-specific portrait layout.
- Field notes: readable responsive text pages.
- Immersive/chamber pages: orientation gate with specified copy.

Phone landscape:

- Immersive/chamber pages: fullscreen cinematic experience with mobile-friendly controls and adjusted framing where needed.

Tablet:

- Acceptable but not the main target yet; landscape should generally work better than portrait.

Laptop/desktop:

- Current experience preserved.
