# INDEXING.md — leilan.ai Google Indexing Implementation Plan

*Audience: coding agent working in `github.com/mwatkins1970/leilan-ai`.*

## Current situation

- `leilan.ai` is live on Netlify from the GitHub repo.
- Google Search Console domain property for `leilan.ai` has been created and verified.
- Search Console is currently in the early "processing data" state.
- The "field notes" layer now exists or is being built. This layer is the main SEO/indexing surface.
- The site should be made easy for Google to crawl, understand, and index without compromising the magical homepage / sanctuary experience.

## High-level goal

Create a clean, canonical, crawlable production indexing setup:

1. `robots.txt` exists at `https://leilan.ai/robots.txt`.
2. XML sitemap exists and is discoverable, preferably via Astro's sitemap integration.
3. Canonical URLs consistently use the production domain, not the Netlify subdomain.
4. Field-note pages are indexable and included in the sitemap.
5. Purely immersive/script-heavy/duplicate experiential pages are either omitted from the sitemap or explicitly `noindex,follow`, depending on the final routing decision below.
6. Important pages have useful titles and descriptions.
7. The user can submit the sitemap in Google Search Console and request indexing for selected URLs.

## Production canonical domain

Use this as the canonical production site URL:

```txt
https://leilan.ai
```

Do not use the Netlify subdomain in canonical tags, sitemap URLs, structured data URLs, Open Graph URLs, or internal absolute URLs.

The Netlify fallback URL exists, but should not be treated as canonical:

```txt
https://aesthetic-faloodeh-789599.netlify.app
```

## Astro sitemap implementation

Prefer the official Astro sitemap integration.

### Install if missing

```bash
npm install @astrojs/sitemap
```

### Configure `astro.config.mjs`

Add or preserve `site: 'https://leilan.ai'`.

Add the sitemap integration without breaking existing config.

Indicative example only — adapt to the current file:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://leilan.ai',
  integrations: [
    sitemap({
      filter: (page) => {
        const url = new URL(page);

        // Include canonical textual/indexable surfaces.
        // Exclude obvious utility/dev/error pages if present.
        // See "Sitemap inclusion policy" below for the target logic.

        return true;
      },
    }),
  ],
});
```

Astro's sitemap integration normally generates:

```txt
/dist/sitemap-index.xml
/dist/sitemap-0.xml
```

The sitemap index is the preferred file to submit to Google Search Console:

```txt
https://leilan.ai/sitemap-index.xml
```

## Sitemap discovery

Add a sitemap hint to the global HTML head if there is a shared layout/head component:

```html
<link rel="sitemap" href="/sitemap-index.xml">
```

Also expose it through `robots.txt`.

## `robots.txt`

Create either a static file:

```txt
public/robots.txt
```

with:

```txt
User-agent: *
Allow: /

Sitemap: https://leilan.ai/sitemap-index.xml
```

or generate it dynamically with an Astro route if preferred.

Do not use `robots.txt` to hide pages that should be `noindex`. Google warns that `robots.txt` controls crawling, not indexing. If a page must not appear in results, it should use a `noindex` robots meta tag or be password-protected. Do not disallow pages that need Google to see their `noindex` tag.

Do not block CSS, JS, images, fonts, or other resources required for Google to render pages.

## Sitemap inclusion policy

Use the sitemap to signal the preferred public/indexable URLs.

### Include

Include at least:

```txt
/
/field-notes/
/field-notes/**/*
/archive/
/data/
/transmission/**/*
/lesswrong-solidgoldmagikarp/
/lesswrong-petertodd-phenomenon/
/lesswrong-petertodd-last-stand/
```

Include any other public text-heavy routes that are intended as search landing pages.

### Probably omit from sitemap

Omit experiential / highly dynamic / duplicate-content routes unless there is a deliberate reason to index them:

```txt
/immersive
/prism/*
/prism/main
/prism/research-lab
/prism/ovs-chapel
/prism/mythopoeic-archive
/prism/gpt3-library
/prism/art-gallery
/prism/ascii-gallery
```

Rationale: the field-note pages should be the clean search landing pages. The prism pages are experiential, script-heavy, and may contain content duplicated from the field notes.

Omitting a page from the sitemap does not block crawling or indexing. It merely declines to prioritize it as a canonical search landing page.

## Optional `noindex,follow` policy for experiential pages

Decision to implement now or later:

### Recommended if duplicate-content/index-quality concerns are high

Add:

```html
<meta name="robots" content="noindex,follow">
```

to:

```txt
/immersive
/prism/*
```

This lets Google follow links out of these pages while not treating the immersive/prism pages as search results.

Important: if using `noindex,follow`, do **not** block these pages in `robots.txt`. Google must be allowed to crawl a page to see its `noindex` meta tag.

### Conservative alternative

Do not add `noindex` initially. Simply omit `/immersive` and `/prism/*` from the sitemap, let Google discover what it discovers, and reassess once Search Console has data.

If uncertain, implement the conservative alternative first.

## Canonical tags

Every indexable page should have a self-referential canonical tag using the production domain:

```html
<link rel="canonical" href="https://leilan.ai/path/">
```

Rules:

- Use `https://leilan.ai`, not the Netlify subdomain.
- Use the same trailing-slash convention as the actual site.
- Ensure internal links are consistent with the canonical form.
- Field-note pages should canonicalize to themselves.
- Do not canonicalize field-note pages to the immersive/prism pages.
- Do not canonicalize the homepage to `/immersive`; the homepage should be canonical as `/`.

Google treats redirects, `rel="canonical"`, and sitemap inclusion as canonicalization signals. Use these consistently.

## Page titles and meta descriptions

Ensure the following pages have useful, non-keyword-stuffed titles/descriptions:

### Homepage

Target role: magical front door, but still intelligible to search engines.

Example:

```html
<title>Leilan.ai — AI Goddess, Glitch Tokens & SolidGoldMagikarp</title>
<meta name="description" content="The official Leilan sanctuary and archive: AI goddess, GPT-3 glitch tokens, SolidGoldMagikarp, field notes, transmissions and the Order of the Vermillion Star.">
```

Adjust tone as desired, but include key phrases naturally.

### `/field-notes/`

Example:

```html
<title>Field Notes | Leilan.ai</title>
<meta name="description" content="Search-readable field notes for travellers arriving by rumour, scholarship or Google: Leilan, GPT-3 glitch tokens, SolidGoldMagikarp, petertodd, OVS and the Leilan transmissions.">
```

### Important field-note pages

Each field note should have a unique `<title>` and description. Suggested title patterns:

```txt
Leilan and GPT-3 Glitch Tokens | Field Notes
Leilan, petertodd and the GPT-3 Glitch-Token Phenomenon
What is Leilan? AI Goddess, Apparition and Hyperstition
SolidGoldMagikarp and Leilan | Field Notes
The Order of the Vermillion Star | Leilan.ai
```

Avoid making every title start with exactly the same words. Natural variation is better.

## Internal links

Make sure important indexable pages are reachable through normal crawlable links:

```html
<a href="/field-notes/">Field notes</a>
<a href="/archive/">Archive</a>
<a href="/data/">Dataset</a>
```

For wall-text frames, when linking to a field-note version, use a real anchor:

```html
<a href="/field-notes/research-lab/petertodd/" target="_blank" rel="noopener">
  Open field-note version
</a>
```

Do not use only JS buttons for crawl-critical links.

Do not orphan the field notes. The field-note index should link to every field note. The homepage/footer may link discreetly to the field-note index.

## Structured data

Optional but useful. Add JSON-LD to the homepage and/or a shared SEO component.

Minimum useful graph:

- `WebSite`
- `Person` for Matthew Watkins
- `Book` for `SolidGoldMagikarp: A Descent Into the AI Underworld`
- optionally `CreativeWork` or `Article` for field-note pages

Use production URLs only.

Example skeleton:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://leilan.ai/#website",
      "url": "https://leilan.ai/",
      "name": "Leilan.ai",
      "description": "The official Leilan sanctuary and archive."
    },
    {
      "@type": "Person",
      "@id": "https://leilan.ai/#matthew-watkins",
      "name": "Matthew Watkins"
    },
    {
      "@type": "Book",
      "@id": "https://leilan.ai/solidgoldmagikarp/#book",
      "name": "SolidGoldMagikarp: A Descent Into the AI Underworld",
      "author": { "@id": "https://leilan.ai/#matthew-watkins" }
    }
  ]
}
</script>
```

Adjust if a `/solidgoldmagikarp/` page exists or is created.

## Open Graph / social preview metadata

Add or verify for key pages:

```html
<meta property="og:site_name" content="Leilan.ai">
<meta property="og:type" content="website">
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:url" content="https://leilan.ai/...">
<meta property="og:image" content="https://leilan.ai/images/...">
```

Also add basic Twitter Card metadata if desired.

Do not use enormous images for OG previews. Use a dedicated optimized preview image.

## Route sanity

After implementation, run:

```bash
npm run build
```

Confirm the build output includes:

```txt
dist/robots.txt
dist/sitemap-index.xml
dist/sitemap-0.xml
```

Then run a local preview if available:

```bash
npm run preview
```

or inspect the built files directly.

## Post-deploy verification checklist

After pushing to `main` and Netlify deployment succeeds, verify live URLs:

```txt
https://leilan.ai/robots.txt
https://leilan.ai/sitemap-index.xml
https://leilan.ai/sitemap-0.xml
https://leilan.ai/
https://leilan.ai/field-notes/
```

Use `curl` where useful:

```bash
curl -I https://leilan.ai/
curl https://leilan.ai/robots.txt
curl https://leilan.ai/sitemap-index.xml | head
curl https://leilan.ai/sitemap-0.xml | head
```

Check that sitemap URLs are production URLs:

```txt
https://leilan.ai/...
```

not:

```txt
https://aesthetic-faloodeh-789599.netlify.app/...
http://...
localhost...
```

Check representative pages for canonical tags:

```bash
curl -s https://leilan.ai/field-notes/ | grep -i canonical
```

## Google Search Console handoff instructions for user

Once this implementation is deployed, tell the user to:

1. Open Google Search Console.
2. Select the `leilan.ai` domain property.
3. Go to `Sitemaps`.
4. Submit:

```txt
sitemap-index.xml
```

or the full URL:

```txt
https://leilan.ai/sitemap-index.xml
```

5. Use URL Inspection for:

```txt
https://leilan.ai/
```

6. Click `Test live URL` if available.
7. Click `Request indexing`.

Optionally also inspect/request indexing for:

```txt
https://leilan.ai/field-notes/
https://leilan.ai/field-notes/research-lab/petertodd/
https://leilan.ai/field-notes/research-lab/glitch/
https://leilan.ai/data/
```

Do not request indexing for dozens of pages manually. Submitting the sitemap is the scalable path.

## Things not to do

- Do not add `Disallow: /` to robots.txt.
- Do not block `/field-notes/`.
- Do not block CSS/JS/images needed for rendering.
- Do not put Netlify preview URLs in sitemap/canonicals.
- Do not create hidden/orphaned SEO pages.
- Do not keyword-stuff titles/descriptions.
- Do not redirect Google/search users through misleading doorway pages.
- Do not make field-note links JS-only.
- Do not add `noindex` globally by accident.
- Do not rely on `<meta name="keywords">`; Google does not use it for ranking.

## Useful references

- Astro sitemap integration: https://docs.astro.build/en/guides/integrations-guide/sitemap/
- Google sitemap guide: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google robots.txt guide: https://developers.google.com/search/docs/crawling-indexing/robots/intro
- Google canonical guide: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Google URL Inspection tool: https://support.google.com/webmasters/answer/9012289

## Completion criteria

The task is complete when:

```txt
[ ] npm run build succeeds.
[ ] robots.txt is present in dist and live at /robots.txt.
[ ] sitemap-index.xml and sitemap-0.xml are present in dist and live.
[ ] sitemap URLs use https://leilan.ai.
[ ] /field-notes/ and individual field notes appear in sitemap.
[ ] /immersive and /prism/* are either omitted from sitemap or deliberately noindex,follow.
[ ] important pages have canonical tags using https://leilan.ai.
[ ] important pages have sensible titles/descriptions.
[ ] field notes are linked with normal <a href> links.
[ ] Netlify production deploy succeeds.
[ ] user is told exactly which sitemap URL to submit in Search Console.
```
