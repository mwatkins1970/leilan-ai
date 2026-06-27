# BANDWIDTH.md — Leilan.ai bandwidth optimisation and launch resilience plan

Last updated: 2026-06-27
Audience: coding agent maintaining `mwatkins1970/leilan-ai`.

## 0. Strategic context

Leilan.ai is an Astro/Three.js/vanilla-JS static site hosted on Netlify. The project README describes the site as a web-cathedral: a magical landing page, `/immersive` Three.js hex-world, and `/prism/[id]` CSS 3D chambers whose walls contain lore panels, images, search, poems, and chamber-specific media.

The user wants to preserve the enchanted experience, especially for book readers arriving at `leilan.ai`, while also building an indexable SEO/field-note layer. Bandwidth work must support both goals:

- Direct/book visitors should receive the magical hit quickly and reliably.
- Search visitors should be able to land on lightweight field-note pages that do not load sanctuary-heavy assets.
- The site must remain viable on Netlify’s low/free-tier bandwidth budget unless launch traffic meaningfully exceeds expectations.

Current known hosting constraint from README: Netlify free-tier assumption of approximately 100 GB/month bandwidth and 300 build minutes. Treat the 100 GB/month budget as a hard planning budget unless the user confirms an upgraded plan.

External reference points to verify during implementation:

- Netlify Free plan announcement: 100 GB bandwidth/month and usage warnings at 50%, 75%, 90%, 100%.
  - https://www.netlify.com/blog/introducing-netlify-free-plan/
- Netlify pricing: Free plan has hard monthly limits; credit-based paid plans use credits for bandwidth.
  - https://www.netlify.com/pricing/
- Netlify Web Analytics docs: bandwidth-used chart plots daily metrics; current-day data updates hourly.
  - https://docs.netlify.com/manage/monitoring/web-analytics/overview/
- Netlify usage/billing docs: account usage insights include bandwidth and web requests.
  - https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/monitor-usage-for-credit-based-plans/

## 1. Core bandwidth model

Bandwidth consumed is roughly:

```text
monthly_bandwidth = sum(bytes actually transferred from Netlify to visitors, bots, crawlers, and preview users)
```

Important distinction:

- `resource size`: uncompressed file size on disk.
- `transferred size`: actual bytes over network after compression, cache, partial content, and CDN behaviour.
- `fresh visit`: browser cache empty.
- `warm visit`: repeat visitor/cache reuses assets.

Use transferred bytes from Chrome DevTools Network tab as the source of truth for route-level budgets. File sizes in `dist/` are only a rough early warning.

Approximate 100 GB/month visit capacity:

```text
fresh payload  2 MB  => ~50,000 visits/month
fresh payload  5 MB  => ~20,000 visits/month
fresh payload 10 MB  => ~10,000 visits/month
fresh payload 20 MB  =>  ~5,000 visits/month
fresh payload 50 MB  =>  ~2,000 visits/month
fresh payload100 MB  =>  ~1,000 visits/month
```

Because bots, search crawlers, launch previews, and repeat exploration also count, use a safety factor of 2–3×. Example: if the enchanted journey transfers 20 MB fresh, do not assume 5,000 real visitors are safe; assume 1,500–2,500 meaningful visitors before risk becomes material unless cache hit rates are excellent.

## 2. Route-level budget targets

Set explicit budgets. Treat them as warning thresholds, not aesthetic constraints.

### 2.1 Lightweight public/SEO layer

Field-note pages should be the cheapest routes on the site.

Target transferred size on a fresh uncached visit:

```text
/field-notes/                         <= 500 KB preferred, <= 1 MB hard warning
/field-notes/** individual article    <= 500 KB preferred, <= 1 MB hard warning
/faq/ or /what-is-leilan/             <= 500 KB preferred, <= 1 MB hard warning
/archive                              <= 1.5 MB warning, especially if images load
/transmission/[slug]                  <= 750 KB preferred unless image-heavy
/data                                 <= 1 MB preferred
```

Rules:

- Field-note pages must not import or preload Three.js, chamber CSS/JS, gallery pools, audio engines, videos, 3D backgrounds, or large decorative images.
- Use mostly text, minimal decorative SVG/CSS, and reused fonts.
- Keep CTA into sanctuary as a normal crawlable `<a href="/">Enter the sanctuary</a>` or `<a href="/immersive">Enter the sanctuary</a>`.
- Do not embed `/immersive` or `/prism/*` in iframes.

### 2.2 Magical/sanctuary layer

Target transferred size on fresh visit:

```text
/ landing page only                         <= 2 MB preferred, <= 5 MB warning
/ -> /immersive initial entry               <= 8 MB preferred, <= 15 MB warning
/immersive -> /prism/main first chamber     <= 12 MB preferred, <= 20 MB warning
one side chamber route                      <= 8 MB additional preferred
full exploratory session without video      <= 25 MB preferred, <= 50 MB warning
any video interaction                       counted separately; user-initiated only
```

Absolute anti-pattern:

```text
Visitor loads homepage or field note and automatically downloads tens/hundreds of MB of chamber/video/gallery assets.
```

## 3. First implementation task: measure the baseline

Before optimising, produce a measurement report from a production build.

### 3.1 Build and inspect static output

From repo root:

```bash
npm run build
find dist -type f -printf '%s %p\n' | sort -nr | head -100 > bandwidth-top-files.txt
find dist -type f -printf '%p\n' | sed 's/.*//g' | sort | uniq -c | sort -nr > bandwidth-extension-counts.txt
find dist -type f -printf '%s\n' | awk '{s+=$1} END {print s/1024/1024 " MB total dist"}' > bandwidth-dist-total.txt
```

Also produce category totals:

```bash
find dist -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.avif' \) -printf '%s %p\n' | awk '{s+=$1} END {print s/1024/1024 " MB images"}'
find dist -type f \( -iname '*.mp4' -o -iname '*.webm' -o -iname '*.mov' \) -printf '%s %p\n' | awk '{s+=$1} END {print s/1024/1024 " MB video"}'
find dist -type f \( -iname '*.js' -o -iname '*.mjs' \) -printf '%s %p\n' | awk '{s+=$1} END {print s/1024/1024 " MB JS"}'
find dist -type f \( -iname '*.css' \) -printf '%s %p\n' | awk '{s+=$1} END {print s/1024/1024 " MB CSS"}'
find dist -type f \( -iname '*.woff2' -o -iname '*.woff' -o -iname '*.ttf' -o -iname '*.otf' \) -printf '%s %p\n' | awk '{s+=$1} END {print s/1024/1024 " MB fonts"}'
```

Add these outputs to a local/non-user-facing report, or commit a summarized `BANDWIDTH_REPORT.md` if useful.

### 3.2 Browser network measurements

Use a deployed preview or local production preview. In Chrome DevTools:

- Network tab.
- Disable cache.
- Preserve log for multi-route journeys.
- Hard reload.
- Record “Transferred” and “Resources”.
- Export HAR files if practical.

Measure these exact scenarios:

```text
A. / only, no click.
B. / then click into /immersive, stop when freelook begins.
C. /immersive direct load to freelook.
D. /prism/main direct load.
E. /prism/research-lab direct load.
F. /prism/ovs-chapel direct load.
G. /prism/mythopoeic-archive direct load.
H. /prism/gpt3-library direct load.
I. /prism/art-gallery direct load.
J. /prism/ascii-gallery direct load.
K. One field-note page once built.
L. /field-notes/ index once built.
M. /archive.
N. A single /transmission/[slug].
O. Click Crossbones video from Mythopoeic Archive.
P. Full likely user journey: / -> /immersive -> main -> research -> back -> mythos -> Crossbones video.
```

For each scenario record:

```text
route_or_journey:
  transferred_fresh_mb:
  transferred_warm_mb:
  request_count:
  largest_resources:
  unexpected_resources:
  notes:
```

### 3.3 Automated budget check

Create a script, e.g. `scripts/audit-assets.mjs`, which fails CI/build or prints warnings when large assets exceed thresholds.

Suggested thresholds:

```text
warning:
  any image > 1.5 MB
  any JS chunk > 500 KB uncompressed
  any CSS file > 250 KB uncompressed
  any font > 200 KB
  any video > 15 MB
  total dist images > 100 MB
  total dist videos > 100 MB
hard fail before launch:
  any non-video image > 5 MB unless explicitly allowlisted
  any auto-loaded route resource > 10 MB
  any video has preload behaviour other than metadata/none/user-click
```

Include allowlist comments where large assets are intentional, but do not allowlist without compression attempts.

## 4. Image optimisation plan

Known from README:

- `public/images/wall-border.png` ~5.6 MB.
- `public/images/wall-bg.jpg` ~2.5 MB.
- Multiple 2048² moiré backgrounds and chamber overlays.
- `gallery-pool.json` references ~235 gallery images.
- Chamber-specific backgrounds and overlays exist for Research, OVS, Mythos, Scriptorium, Art Gallery, etc.

### 4.1 Inventory and classify images

Classify each image asset:

```text
critical-first-paint: required before initial above-the-fold view.
route-critical: required for one specific route only.
lazy-visible: required only when a wall/panel becomes visible.
interaction-only: required only after click/tap.
dead-unused: not referenced by current build/runtime.
```

Use grep/reference analysis:

```bash
grep -R "filename.ext" -n src public --exclude-dir=node_modules
```

Remove or quarantine dead assets from `public/` so they are not deploy baggage. Note: dead assets in `public/` do not necessarily transfer to users unless requested, but they clutter deploys and make audit harder.

### 4.2 Convert and resize decorative assets

For each large PNG/JPEG:

- Test AVIF and WebP versions.
- Preserve PNG only where alpha quality is essential and WebP/AVIF alpha is visually inferior.
- Do not convert blindly; visually compare.
- Generate multiple dimensions for backgrounds:
  - 1024 or 1280 wide for mobile.
  - 1600 or 1920 wide for desktop.
  - 2048 only where genuinely needed.

Suggested directory pattern:

```text
public/images/optimized/
  MAIN_background-1280.webp
  MAIN_background-1920.webp
  MAIN_background-2048.webp
  MAIN_background-1280.avif
  ...
```

For alpha overlays:

```text
public/images/optimized/OVS_background_new-1024.webp
public/images/optimized/OVS_background_new-2048.webp
```

Use `picture` for `<img>` elements. For CSS backgrounds, use media queries or CSS variables set per route.

Example for CSS background selection:

```css
.wall-bg {
  background-image: image-set(
    url('/images/optimized/MOIRE_background_c1-1280.avif') type('image/avif') 1x,
    url('/images/optimized/MOIRE_background_c1-1280.webp') type('image/webp') 1x
  );
}

@media (min-width: 1200px) {
  .wall-bg {
    background-image: image-set(
      url('/images/optimized/MOIRE_background_c1-1920.avif') type('image/avif') 1x,
      url('/images/optimized/MOIRE_background_c1-1920.webp') type('image/webp') 1x
    );
  }
}
```

Caveat: browser support for `image-set()` is acceptable for modern browsers but test Safari/Chrome. If the aesthetic breaks, use conservative WebP/JPEG fallback.

### 4.3 Lazy-load gallery images

Current Art Gallery uses random gallery images from a pool. Ensure implementation does not preload the full `gallery-pool.json` image set as actual image requests. Loading JSON metadata is fine; loading 235 images is not.

Rules:

- Choose only the image(s) needed for currently visible walls.
- Preload at most the next/previous image when a rotation is imminent.
- Use `loading="lazy"` and `decoding="async"` on `<img>` where applicable.
- Add width/height attributes to avoid layout shifts.
- Do not use CSS backgrounds for gallery images if that prevents native lazy loading, unless JS explicitly loads only visible images.
- For random image selection, store `src`, `w`, `h`, `alt/caption`, and precomputed small placeholder if desired.

Potential implementation:

```html
<img
  src={visibleImage.src}
  width={visibleImage.w}
  height={visibleImage.h}
  loading="lazy"
  decoding="async"
  alt={caption}
/>
```

For JS-controlled wall refresh, set `img.src` only when the wall enters visibility, not at page load for all possible choices.

### 4.4 Avoid global CSS references to all chamber backgrounds

If `prism.css` references every chamber background directly, browsers may discover more than needed depending on CSS and DOM. Keep route-specific background URLs inline or scoped so only the active chamber’s backgrounds are requested.

Preferred:

- `prism/[id].astro` computes active chamber background URLs and emits them as CSS variables on the page root.
- `prism.css` consumes variables without hardcoding every asset.

Example:

```astro
<div
  class="prism-root"
  data-prism-id={config.id}
  style={`--chamber-bg: url('${bg}'); --chamber-bg-alt: url('${bgAlt}'); --chamber-overlay: url('${overlay}');`}
>
```

Then CSS:

```css
.wall-bg { background-image: var(--chamber-bg); }
.wall-panel:nth-child(even) .wall-bg { background-image: var(--chamber-bg-alt); }
.wall-overlay { background-image: var(--chamber-overlay); }
```

## 5. Video optimisation plan

Known from README:

- Only Crossbones video is currently wired: `/video/crossbones.mp4`.
- Video button renders only on walls that have `videoSrc`.
- Future videos may be added.

Videos are the largest bandwidth risk. Treat all video as interaction-only.

### 5.1 Required video loading behaviour

Hard rule:

```text
No video file may be requested until the user explicitly clicks/taps a visible video control.
```

Implementation options:

1. Render no `<video src>` until click.
2. Render `<video preload="none">` with `data-src`, then set `src` on click.
3. Render poster image only and hydrate player on click.

Preferred pattern:

```html
<button class="video-trigger" data-video-src="/video/crossbones-720p.mp4">
  ▶ video
</button>
```

On click:

```js
const video = document.createElement('video');
video.controls = true;
video.preload = 'metadata';
video.src = trigger.dataset.videoSrc;
video.playsInline = true;
container.replaceChildren(video);
video.play().catch(() => {});
```

### 5.2 Video encoding targets

For each chamber video:

```text
master archive: keep offline / not deployed if huge.
web mp4 h264/aac: 720p unless visual content truly requires 1080p.
webm vp9/opus: optional secondary source.
poster jpg/webp: <= 150 KB.
```

Suggested bitrate targets:

```text
720p ambient/archival montage: 1.2–2.5 Mbps
1080p only if necessary: 3–5 Mbps
short clips preferred; avoid 100MB+ single files on Netlify
```

Rule of thumb:

```text
2 Mbps video ~= 15 MB/minute
5 Mbps video ~= 37.5 MB/minute
```

If multiple videos are planned, consider moving video hosting off Netlify before launch. Candidate approaches for user discussion:

- Cloudflare Stream or R2 + CDN.
- Bunny Stream / Bunny CDN.
- Vimeo/YouTube embed if acceptable aesthetically/privacy-wise.
- Separate object storage/CDN bucket for media, keeping Astro site on Netlify.

Do not migrate without user approval; just keep the code structured so `videoSrc` can point to an external CDN later.

## 6. Audio optimisation plan

The README describes audio chains and global volume control. If audio is generated via Web Audio oscillators/synthesis, bandwidth is low. If any audio sample files exist or are added later:

- Load audio only after user gesture.
- Use compressed formats (`.opus`/`.ogg` or `.mp3`/`.m4a`) rather than WAV/AIFF.
- Do not preload multiple chamber soundworlds on homepage.
- Load chamber-specific audio only when entering that chamber.
- Avoid long uncompressed loops.

Add audit rule:

```text
No .wav, .aiff, .flac deployed unless deliberately exempted.
```

## 7. JavaScript and CSS route-splitting

### 7.1 Keep heavy immersive code off field-note pages

Field-note pages must not import:

- Three.js.
- `immersive.astro` runtime.
- `public/scripts/prism.js`.
- `src/styles/prism.css` unless intentionally needed.
- gallery pool JSON.
- audio engines.

Ensure the SEO layer has a separate lightweight layout component, e.g.:

```text
src/layouts/FieldNoteLayout.astro
src/pages/field-notes/[...slug].astro
```

This layout should use minimal CSS and no client JS unless needed.

### 7.2 Immersive/prism code splitting

Check current bundling:

- `immersive.astro` imports Three.js from CDN importmap r160. That should affect `/immersive` only.
- `public/scripts/prism.js` should be loaded only on `/prism/[id]` routes.
- Any global layout used by all pages must not include prism or immersive scripts.

Audit final HTML output:

```bash
grep -R "three" dist/*.html dist/**/*.html | head
 grep -R "prism.js" dist/*.html dist/**/*.html | head
```

Expected:

```text
three only in /immersive/index.html
prism.js only in /prism/* pages
```

### 7.3 CSS minimisation

`src/styles/prism.css` is large and should only load on prism pages.

- Do not include `prism.css` in field-note pages.
- Consider splitting field-note CSS into a very small file.
- If future chamber-specific CSS grows, consider chamber-specific CSS chunks, but do not prioritise unless CSS transfer is measurable.

## 8. Search/archive data optimisation

Known from README: in `immersive.astro`, `loadArchiveData()` fetches `/archive` HTML and parses `[data-search]` cards into a keyword index.

This is elegant but bandwidth-inefficient if `/archive` becomes large or image-rich.

### 8.1 Replace HTML scraping with compact JSON index

Create a build-time generated search index:

```text
public/data/transmission-search-index.json
```

Shape:

```json
[
  {
    "slug": "2026-...",
    "title": "...",
    "date": "YYYY-MM-DD",
    "tags": ["..."],
    "keywords": "lowercase searchable string",
    "snippet": "short text only, 160-240 chars"
  }
]
```

Rules:

- No full bodies unless needed.
- No image data.
- Minify JSON.
- Gzip/Brotli over network should make this cheap.
- Keep the `/archive` page human-facing; do not use it as a hidden data API.

Update `loadArchiveData()` to fetch the JSON first. Keep `/archive` fallback only if JSON fetch fails.

### 8.2 Avoid full transmission preloads

Do not preload all `src/content/transmissions/*.md` content into the sanctuary runtime. Load single transmission content only when selected/opened, or navigate to the transmission page.

## 9. Font optimisation

Current README lists IBM Plex Mono plus several display fonts via Google Fonts:

- IBM Plex Mono 300/400.
- Spectral.
- Marcellus.
- IM Fell English.
- Crimson Pro.
- Cormorant Garamond.

Fonts can become a surprisingly large first-load cost.

### 9.1 Rules

- Use `font-display: swap` or equivalent Google Fonts query parameter.
- Only request used weights/styles/subsets.
- Do not load all chamber display fonts on field-note pages unless visually required.
- Prefer system serif/mono for field-note pages if acceptable.
- Consider self-hosted `.woff2` for launch stability and caching, but do not share or redistribute font files to the user. Check font licences before self-hosting.

### 9.2 Route-specific font strategy

Suggested:

```text
/ and /immersive: load only landing/immersive-required fonts.
/prism/research-lab: load IBM Plex Mono + Spectral if needed.
/prism/ovs-chapel: load IBM Plex Mono + Marcellus if needed.
/prism/mythopoeic-archive: load IBM Plex Mono + IM Fell English if needed.
/prism/gpt3-library: load IBM Plex Mono + Crimson Pro if needed.
field-notes: system serif + IBM Plex Mono only if already cached/needed.
```

Audit generated HTML to ensure field-note pages do not request five display families.

## 10. Caching headers on Netlify

Add or verify `public/_headers` so deployed static assets are cacheable.

### 10.1 Conservative starter `_headers`

```text
# HTML should be revalidated so content updates appear promptly.
/*.html
  Cache-Control: public, max-age=0, must-revalidate

# Astro hashed build assets can be immutable.
/_astro/*
  Cache-Control: public, max-age=31536000, immutable

# Versioned optimised images can be immutable if filenames change on content change.
/images/optimized/*
  Cache-Control: public, max-age=31536000, immutable

# Data indexes can be moderately cached; adjust if updated often.
/data/*.json
  Cache-Control: public, max-age=3600, stale-while-revalidate=86400

# Videos: cache long if filenames are versioned. Use shorter if filenames are stable.
/video/*
  Cache-Control: public, max-age=604800
```

Important:

- Astro fingerprinted assets under `/_astro/` are safe with immutable caching.
- Files in `public/images` are not automatically content-hashed. Do not apply one-year immutable caching to stable public filenames unless the filename changes whenever content changes.
- Prefer versioned filenames for optimised assets, e.g. `crossbones-720p-v1.mp4`, `MOIRE_background_c1-1920-v2.webp`.

### 10.2 Verify headers

After deploy:

```bash
curl -I https://leilan.ai/_astro/some-file.js
curl -I https://leilan.ai/images/optimized/some-image.webp
curl -I https://leilan.ai/video/crossbones-720p-v1.mp4
```

Check `cache-control` values and `content-type`.

## 11. Service worker policy

Do not add a service worker as a first-pass optimisation unless the codebase already has one or the agent is confident.

If added later:

- Runtime-cache repeated sanctuary assets.
- Do not precache all gallery images.
- Do not precache videos.
- Do not precache all transmissions.
- Use a versioned cache and a clear update strategy.
- Test cache invalidation carefully; stale magical assets are confusing during launch.

A bad service worker can cause more launch pain than bandwidth savings.

## 12. SEO field-note layer and bandwidth

The SEO plan proposes “one corpus, two modes”:

- Sanctuary mode: wall-text frames inside `/prism/*`.
- Field-note mode: indexable ordinary pages derived from the same `src/data/wall-texts/` corpus.

Bandwidth requirements for field notes:

- Minimal layout.
- No 3D runtime.
- No large chamber backgrounds.
- No gallery pool.
- No video preloads.
- Crawlable links back to sanctuary.

Implementation idea:

```text
src/pages/field-notes/index.astro
src/pages/field-notes/[chamber]/[slug].astro
src/layouts/FieldNoteLayout.astro
src/data/fieldNotes.ts
```

Each field note should include:

```text
- H1 plain-title version.
- Short intro/summary.
- Body copied/adapted from corresponding wall text.
- Link: Open this text inside the sanctuary/chamber.
- Link: Enter the sanctuary.
- Links to previous/next field notes in chamber sequence.
- Link to /field-notes/ index.
```

For the wall text frame itself, add a real `<a href="/field-notes/..." target="_blank" rel="noopener">Open field-note version</a>` where aesthetically acceptable. Do not use JS-only buttons for this; search engines need crawlable links.

Consider adding `noindex,follow` to `/immersive` and `/prism/*` if SEO implementation establishes field notes as canonical search landing pages. This is primarily an SEO decision, but it also prevents search users from landing directly on heavy routes when a lightweight field-note equivalent exists. Do not do this until SEO.md decision is confirmed.

## 13. Bot and crawler considerations

Because the site will be linked in a book and may attract AI/LLM/culture-war interest, crawlers and scrapers could produce bandwidth spikes.

Do not block Google/Bing from field notes. But consider bot hygiene:

- Ensure `robots.txt` allows important pages and sitemap.
- Do not expose huge JSON/media indexes unnecessarily.
- Avoid links that enumerate every large media file.
- Do not include direct video links in sitemaps unless deliberate.
- If abusive bots appear, use Netlify/Cloudflare protections or external CDN rules rather than over-restricting good crawlers.

Potential `robots.txt` should be coordinated with SEO.md. Do not block `/field-notes/`, `/archive`, `/data`, `/transmission/`, or sitemap.

## 14. Plan B hosting / launch resilience

The user’s proposed operational model is sound:

```text
optimise now -> monitor bandwidth -> if traffic spikes, execute plan B.
```

### 14.1 Monitoring checklist

Before launch/book drop:

- Confirm Netlify account owner email is current.
- Confirm usage-warning emails are enabled/received.
- Confirm where bandwidth is visible in current Netlify UI:
  - Team dashboard / Usage & billing / Account usage insights.
  - Project-level monitoring/analytics if available.
  - Web Analytics bandwidth chart if enabled.
- Check usage daily during launch week.
- Check usage after any large press/podcast/article goes live.
- Keep a note of baseline daily bandwidth before public launch.

Tracking sheet columns:

```text
date | total bandwidth used this month | daily delta | likely cause | action taken
```

### 14.2 Traffic thresholds and responses

```text
<25% monthly budget used: normal.
25–50%: inspect top resources; confirm no accidental video/gallery preload.
50–75%: compress remaining large assets; consider moving videos off Netlify.
75–90%: prepare paid/alternate hosting; reduce or disable heaviest media if necessary.
90%+: execute emergency bandwidth mitigation.
```

Emergency mitigations:

1. Disable video controls or route video to external host.
2. Temporarily reduce gallery image quality/size.
3. Remove/prevent preloading of nonessential chamber assets.
4. Switch heavy media to separate CDN/object storage.
5. Upgrade Netlify plan or migrate to backup host if more appropriate.

### 14.3 Backup hosting options to investigate, not implement blindly

- Upgrade current Netlify plan / credit-based plan.
- Keep site on Netlify, move videos/media to external CDN/object storage.
- Cloudflare Pages for static site, if project constraints and terms are acceptable.
- S3 + CloudFront equivalent.
- Bunny CDN/Storage for media.

Do not assume “unlimited bandwidth” without checking current terms. Terms and abuse policies change.

### 14.4 DNS resilience

Before book launch:

- Check domain DNS TTL.
- If feasible, set relevant TTL to 300 seconds a few days before launch to allow faster migration.
- Confirm Netlify domain wiring is correct; README notes stale deployment/domain wiring issue as of 2026-06-04. This must be resolved before launch.
- Keep a backup deploy target ready if realistic.

## 15. Netlify deploy/domain issue from README

README warning: as of 2026-06-04, `https://leilan.ai/` was serving a stale deploy; subroutes 404; current build title mismatch. Resolve this independently of bandwidth work.

Bandwidth optimisation is irrelevant if domain points to stale deployment. Pre-launch checklist:

```text
- leilan.ai serves current build.
- /immersive works.
- /prism/main works.
- /field-notes/ works once built.
- /sitemap.xml works.
- /robots.txt works.
- Netlify dashboard shows the correct project receiving traffic for leilan.ai.
```

## 16. Practical implementation sequence

### Phase 1 — baseline and obvious hazards

1. Run static file inventory.
2. Measure route-level transferred bytes with DevTools.
3. Verify Crossbones video does not request until clicked.
4. Verify gallery does not load all images.
5. Verify field-note pages, once built, do not import sanctuary scripts/styles.
6. Add `_headers` cache policy.
7. Commit `BANDWIDTH_REPORT.md` summary or provide to user.

### Phase 2 — compress top assets

1. Optimise `wall-border.png`.
2. Optimise `wall-bg.jpg`.
3. Optimise chamber backgrounds and overlays.
4. Optimise gallery pool images.
5. Generate responsive variants.
6. Update code to use optimised assets.
7. Compare screenshots to ensure aesthetics survive.

### Phase 3 — improve runtime loading

1. Replace `/archive` HTML scraping with compact JSON search index.
2. Ensure prism pages load only current chamber assets.
3. Ensure chamber images load on visibility/interaction, not globally.
4. Ensure videos use click-to-load.
5. Audit fonts per route.

### Phase 4 — monitoring and launch readiness

1. Confirm Netlify usage dashboard access.
2. Confirm warning emails.
3. Confirm correct deploy/domain wiring.
4. Keep plan B notes with host/CDN candidates.
5. During launch week, check usage daily.

## 17. Acceptance criteria before book-drop launch

```text
[ ] leilan.ai serves current Netlify deploy, not stale placeholder.
[ ] / works and is visually correct.
[ ] /immersive works on target mobile and desktop devices.
[ ] /prism/main and all side chambers load correctly.
[ ] /field-notes/ and field-note pages load without sanctuary JS/CSS/media.
[ ] Crossbones video is not requested until click.
[ ] Gallery does not preload all images.
[ ] Largest non-video image <= 1.5 MB preferred or explicitly justified.
[ ] No accidentally deployed huge uncompressed audio files.
[ ] _headers cache policy deployed and verified.
[ ] Route-level bandwidth report completed.
[ ] Fresh /field-notes page <= 1 MB transferred.
[ ] Fresh / -> /immersive -> /prism/main <= 20 MB transferred preferred; <= 50 MB hard warning.
[ ] Netlify bandwidth monitoring location confirmed.
[ ] User knows what threshold triggers plan B.
```

## 18. Do not do these things

- Do not sacrifice core visual/magical aesthetics without user approval.
- Do not preload videos.
- Do not preload all gallery images.
- Do not import Three.js on field-note pages.
- Do not add a service worker that precaches the whole site.
- Do not apply immutable caching to stable public filenames that may be overwritten.
- Do not trust file size alone; measure transferred bytes.
- Do not assume Netlify plan terms; verify current plan UI before launch.
- Do not solve bandwidth by hiding useful pages from search; SEO field notes should remain public and lightweight.

## 19. Quick command crib sheet

```bash
# Production build
npm run build

# Largest files
find dist -type f -printf '%s %p\n' | sort -nr | head -100

# Total dist size
find dist -type f -printf '%s\n' | awk '{s+=$1} END {print s/1024/1024 " MB"}'

# Image totals
find dist -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.avif' \) -printf '%s\n' | awk '{s+=$1} END {print s/1024/1024 " MB images"}'

# Video totals
find dist -type f \( -iname '*.mp4' -o -iname '*.webm' -o -iname '*.mov' \) -printf '%s\n' | awk '{s+=$1} END {print s/1024/1024 " MB video"}'

# Find huge source assets
find public src -type f -size +1M -printf '%s %p\n' | sort -nr | head -100

# Verify whether sanctuary scripts leak into field-note pages after build
# Adjust paths after field-note implementation.
grep -R "three" dist/field-notes || true
grep -R "prism.js" dist/field-notes || true
grep -R "immersive" dist/field-notes || true

# Verify deployed cache headers
curl -I https://leilan.ai/
curl -I https://leilan.ai/_astro/REPLACE_WITH_REAL_ASSET.js
curl -I https://leilan.ai/images/optimized/REPLACE_WITH_REAL_IMAGE.webp
curl -I https://leilan.ai/video/crossbones-720p-v1.mp4
```
