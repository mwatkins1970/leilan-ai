# SEO.md — Leilan.ai Search Strategy and Field-Note Architecture

*Prepared for the Leilan.ai coding agent, 2026-06-27.*

## 0. Executive summary

The goal is to make `leilan.ai` findable for people who hear, read, or half-remember phrases such as:

- Leilan goddess
- Leilan AI
- Leilan AI goddess
- AI goddess
- Leilan petertodd
- Leilan Peter Todd
- Leilan SolidGoldMagikarp
- Leilan glitch
- Leilan glitch goddess
- Leilan glitch tokens
- Leilan emergent goddess
- Leilan cybernetic goddess

The user’s central concern is correct and should be respected: the homepage and main journey must produce an experience of enchantment, not a corporate explanatory SEO landing page. Do **not** add a big “sensible” introductory block to the magical homepage.

The agreed strategy is therefore:

> **One corpus, two modes.**
>
> 1. **Sanctuary mode** — the existing magical/immersive 3D experience: `/`, `/immersive`, `/prism/*`.
> 2. **Field-note mode** — public, tasteful, indexable HTML article pages derived from the same wall-text corpus, designed for searchers, journalists, book readers, researchers, and curious people arriving from Google/Bing/AI search.

These field-note pages are **not hidden SEO bait**. They must be visible, linked, useful, human-readable, and consistent with the site’s mythic tone. Think: Borges index, occult glossary, monastery archive, field report, museum wall text, or marginalia of the temple made legible to the outside world.

The field-note layer should funnel users gently toward the sanctuary with clear calls to action such as “Enter the sanctuary”, but it must not auto-redirect or deceive users/search engines. The pages should stand on their own as useful resources.

---

## 1. Context: what the current site already provides

From the current master reference, Leilan.ai is a “web-cathedral” for Leilan, with this journey:

```text
Landing page → /immersive → hexagonal prism temple → /prism/[id] chambers
```

The chamber system already contains scrollable wall-text frames, images, and interactive elements. This is exactly the right foundation for a dual-mode architecture.

Relevant current files/routes:

```text
src/pages/index.astro                       # Landing — magical front door
src/pages/immersive.astro                   # Three.js hex world
src/pages/prism/[id].astro                  # CSS 3D chamber pages, generated from prisms.ts
src/pages/archive.astro                     # Transmission list/search source
src/pages/data.astro                        # Leilan Dataset info page
src/pages/transmission/[slug].astro         # Transmission pages
src/pages/lesswrong-*.astro                 # Interstitial pages to LessWrong posts

src/data/prisms.ts                          # Chamber/wall configuration
src/data/wall-texts/*.html                  # HTML files for each side-chamber wall popup
src/content/transmissions/*.md              # Transmission markdown archive
src/components/Footer.astro
```

The key opportunity is that the existing `src/data/wall-texts/*.html` files can become the source material for ordinary indexable pages, while still powering the in-chamber text frames.

Do **not** duplicate and maintain two independent versions of the same text if avoidable. Create a source-of-truth workflow.

---

## 2. Conversation summary and design decision

### Initial SEO problem

The book refers readers to `http://leilan.ai`, including after the Epilogue. Searchers may look for “Leilan AI”, “AI goddess”, “Leilan glitch tokens”, “Leilan petertodd”, etc. The site needs to rank for those obvious searches before and after the book launch.

### Initial SEO suggestion

A conventional SEO approach would put a plain explanatory paragraph high on the homepage, something like:

> Leilan is the AI-goddess figure at the heart of Matthew Watkins’s book *SolidGoldMagikarp: A Descent Into the AI Underworld*...

That would help Google understand the homepage.

### User’s objection

The user does **not** want the homepage to be deflated by a sensible explanatory layer. Direct visitors from the book or word of mouth should receive the “magickal hit” uninterrupted.

### Compromise reached

Keep the homepage enchanted. Add an outer layer of public, tasteful, indexable field-note pages.

This means:

- `/` remains the sanctuary threshold.
- `/immersive` and `/prism/*` remain experiential.
- `/field-notes/` and `/field-notes/*` become the search-facing explanatory layer.
- The field-note pages are not secret doorway pages. They are public archive pages, linked from the footer, sitemap, and relevant chamber text frames.
- Each field note includes a strong but optional route back into the sanctuary.

The guiding phrase:

> **The first layer stays enchanted; the second layer makes the enchantment legible.**

---

## 3. Hard SEO principles for this project

### 3.1 Do not create hidden doorway pages

Avoid anything resembling:

- pages created only for bots
- hidden pages with no human-facing route
- automatic redirects from field-note pages to the homepage
- cloaking: showing search engines one thing and users another
- keyword-stuffed near-duplicate pages
- invisible text
- orphan pages only present in the sitemap

The field notes must be genuinely useful to a human who lands there.

### 3.2 Do not auto-redirect search visitors into the sanctuary

A searcher who clicks “Leilan, petertodd and GPT-3 glitch tokens” should land on a page about Leilan, `petertodd`, and glitch tokens. That page can have a beautiful prominent CTA:

```html
<a class="sanctuary-cta" href="/">
  Enter the sanctuary
</a>
```

But do not immediately redirect.

### 3.3 Do not rely on `<meta name="keywords">`

Do not add a meta keywords tag. Google does not use it for ranking or indexing.

Keywords should appear naturally in:

- page titles
- `<h1>` and `<h2>` headings
- introductory paragraphs
- visible body text
- internal link anchor text
- image alt text where appropriate
- FAQ questions
- schema metadata where relevant

### 3.4 Use real crawlable links

Where the immersive/chamber experience links to the field-note pages, use a real `<a href="...">`, not just a button with `onclick`.

Good:

```html
<a href="/field-notes/research-lab/petertodd/" target="_blank" rel="noopener">
  Open field-note version
</a>
```

Less good:

```html
<button onclick="window.open('/field-notes/research-lab/petertodd/')">
  Open field-note version
</button>
```

The visual treatment may make the anchor look like a button. The important thing is that the href exists in the DOM.

### 3.5 Do not orphan the field-note pages

Every indexable field-note page should be reachable through normal links.

Required link routes:

1. `/field-notes/` links to every field note.
2. The global footer links to `/field-notes/`.
3. Each relevant chamber wall text frame links to its corresponding field-note version.
4. Each field-note page links back to:
   - `/field-notes/`
   - its chamber page, ideally with a URL parameter that opens or faces the relevant wall if practical
   - `/` or `/immersive`
   - related field notes

Sitemaps help discovery, but they are not a substitute for visible internal links.

### 3.6 Keep the magical homepage

Do not put a search-optimised explanatory essay at the top of `/`.

The homepage can still have:

- a strong `<title>`
- a meta description
- Open Graph metadata
- JSON-LD describing the site/book/entity
- a tiny footer link to `/field-notes/`

Direct visitors should not feel they have entered a marketing page.

---

## 4. Recommended route architecture

### 4.1 Core indexable field-note routes

Create:

```text
/field-notes/
/field-notes/what-is-leilan/
/field-notes/solidgoldmagikarp/
/field-notes/glitch-tokens/
/field-notes/research-lab/gpt-3/
/field-notes/research-lab/glitch/
/field-notes/research-lab/petertodd/
/field-notes/research-lab/rescue/
/field-notes/research-lab/bootstrap/
/field-notes/research-lab/beyond/
/field-notes/ovs-chapel/origins/
/field-notes/ovs-chapel/hyperstition/
/field-notes/ovs-chapel/mammon/
/field-notes/ovs-chapel/handbook/
/field-notes/ovs-chapel/data/
/field-notes/mythopoeic-archive/apparition/
/field-notes/mythopoeic-archive/comet/
/field-notes/mythopoeic-archive/ufo/
/field-notes/mythopoeic-archive/archaeology/
/field-notes/mythopoeic-archive/crossbones/
```

### 4.2 Optional later routes

These are useful after the initial field-note layer is live:

```text
/field-notes/faq/
/field-notes/leilan-ai-goddess/
/field-notes/petertodd-token/
/field-notes/order-of-the-vermillion-star/
/field-notes/transmissions/
```

Avoid creating too many thin keyword pages. Start with pages that correspond to real site content. Add new pages only when Search Console shows demand or users ask for them.

### 4.3 Route naming

Prefer tasteful, human-readable route names over ugly keyword slabs.

Good:

```text
/field-notes/what-is-leilan/
/field-notes/glitch-tokens/
/field-notes/research-lab/petertodd/
```

Bad:

```text
/leilan-ai-goddess-glitch-token-petertodd-solidgoldmagikarp-seo/
```

---

## 5. Field-note content model

Create a data structure such as:

```ts
// src/data/fieldNotes.ts

export interface FieldNote {
  slug: string;                    // e.g. "research-lab/petertodd"
  title: string;                   // visible page title / H1
  shortTitle: string;              // nav label
  description: string;             // meta description
  chamberId?: string;              // e.g. "research-lab"
  chamberTitle?: string;           // e.g. "Research Lab"
  wallLabel?: string;              // e.g. "petertodd"
  wallTextFile?: string;           // e.g. "research-lab-petertodd.html"
  sourceWall?: number;             // e.g. 3
  sanctuaryUrl?: string;           // e.g. "/prism/research-lab?wall=3"
  targetQueries?: string[];        // for editorial/SEO sanity checks only, not meta keywords
  related?: string[];              // other field-note slugs
  intro?: string;                  // custom plain-English intro before the wall text
  contentKind?: "wall-text" | "overview" | "faq" | "book" | "custom";
  noindex?: boolean;               // default false
}
```

The `targetQueries` field is for internal planning only. Do not render it as a keywords tag.

### 5.1 Importing wall-text HTML

In Astro/Vite, the agent can likely use `import.meta.glob` with raw HTML:

```ts
const wallTexts = import.meta.glob("../data/wall-texts/*.html", {
  query: "?raw",
  import: "default",
  eager: true
});
```

Then map `wallTextFile` to the imported raw content.

If the current Astro/Vite version requires different syntax, adapt accordingly. The principle is: one content file, two render modes.

### 5.2 Field-note page anatomy

Each field-note page should render approximately:

```html
<main class="field-note">
  <nav class="breadcrumb">
    <a href="/field-notes/">Field notes</a>
    <span>Research Lab</span>
  </nav>

  <p class="kicker">Field note from the Research Lab</p>

  <h1>Leilan, petertodd and the GPT-3 glitch-token phenomenon</h1>

  <p class="dek">
    A plain-English guide to the ‘&nbsp;petertodd' token, the glitch-token experiments, and the emergence of Leilan as an AI-goddess figure.
  </p>

  <div class="cta-row">
    <a class="sanctuary-cta" href="/">
      Enter the sanctuary
    </a>
    <a class="chamber-cta" href="/prism/research-lab?wall=3">
      Visit this wall in the Research Lab
    </a>
  </div>

  <section class="field-note-body">
    <!-- raw wall-text HTML or custom body -->
  </section>

  <aside class="related-notes">
    <h2>Related field notes</h2>
    ...
  </aside>
</main>
```

### 5.3 Tone

The field notes should be clear enough for searchers but not spiritually dead.

Preferred tonal register:

- “field note”
- “archive”
- “glossary”
- “marginalia”
- “threshold”
- “sanctuary”
- “chamber”
- “transmission”
- “research trail”
- “for travellers arriving by search, scholarship, rumour, or half-remembered mention”

Avoid generic marketing language:

- “Discover our amazing AI brand”
- “Your ultimate guide to AI goddess Leilan”
- “Click here to learn more”
- “SEO optimized page”

---

## 6. Specific page recommendations

### 6.1 `/field-notes/`

Purpose: index of the outer archive.

Title:

```text
Field Notes on Leilan | AI Goddess, Glitch Tokens and SolidGoldMagikarp
```

Meta description:

```text
A field-note index for Leilan.ai: the AI-goddess figure from SolidGoldMagikarp, GPT-3 glitch tokens, petertodd, the Order of the Vermillion Star and the Leilan transmissions.
```

Opening copy:

```text
These field notes are provided for travellers arriving by search, scholarship, rumour, or half-remembered mention. The sanctuary itself begins elsewhere; this index makes its signs legible from the outside.
```

Required links:

- Enter the sanctuary → `/`
- Enter the immersive temple → `/immersive`
- What is Leilan? → `/field-notes/what-is-leilan/`
- SolidGoldMagikarp → `/field-notes/solidgoldmagikarp/`
- Glitch tokens → `/field-notes/glitch-tokens/`
- all chamber-derived field notes

### 6.2 `/field-notes/what-is-leilan/`

Purpose: main explainer for people searching “Leilan AI”, “Leilan goddess”, “Leilan AI goddess”, “AI goddess”.

Title:

```text
What Is Leilan? AI Goddess, Glitch Token and Hyperstition
```

Meta description:

```text
Leilan is the AI-goddess figure associated with Matthew Watkins’s SolidGoldMagikarp, GPT-3 glitch tokens, the Leilan transmissions and the Order of the Vermillion Star.
```

Suggested H1:

```text
What is Leilan?
```

Opening paragraph:

```text
Leilan is the AI-goddess figure associated with Matthew Watkins’s experiments with GPT-3 glitch tokens and the later Leilan transmissions. In SolidGoldMagikarp: A Descent Into the AI Underworld, she appears not as a simple fictional character, but as a strange attractor at the boundary between language-model behaviour, archetype, glitch, and hyperstition.
```

This page should link prominently to:

- `/field-notes/solidgoldmagikarp/`
- `/field-notes/glitch-tokens/`
- `/field-notes/research-lab/petertodd/`
- `/field-notes/ovs-chapel/origins/`
- `/archive`
- `/data`
- `/`

### 6.3 `/field-notes/solidgoldmagikarp/`

Purpose: searches involving the book and Leilan.

Title:

```text
Leilan and SolidGoldMagikarp | A Descent Into the AI Underworld
```

Meta description:

```text
How Leilan connects to Matthew Watkins’s book SolidGoldMagikarp: A Descent Into the AI Underworld, GPT-3 glitch tokens, petertodd and the AI underworld.
```

Notes:

- Use the canonical book subtitle: *A Descent Into the AI Underworld*.
- Include ISBN/publisher metadata where appropriate.
- Link to publisher/book pages when official URLs are known.
- Include Book schema on this page if possible.

### 6.4 `/field-notes/glitch-tokens/`

Purpose: main explainer for “Leilan glitch”, “Leilan glitch tokens”, “AI glitch goddess”, “SolidGoldMagikarp glitch token”.

Title:

```text
GPT-3 Glitch Tokens: SolidGoldMagikarp, petertodd and Leilan
```

Meta description:

```text
A plain-English guide to GPT-3 glitch tokens, including SolidGoldMagikarp, petertodd and the emergence of Leilan as an AI-goddess figure.
```

This page can draw from Research Lab wall texts, especially GPT-3 and glitch.

### 6.5 `/field-notes/research-lab/petertodd/`

Purpose: “Leilan petertodd”, “Leilan Peter Todd”, “petertodd glitch token”.

Title:

```text
Leilan, petertodd and the GPT-3 Glitch-Token Phenomenon
```

Meta description:

```text
Background on the ‘ petertodd’ GPT token, the glitch-token experiments and the Leilan association discussed in SolidGoldMagikarp.
```

Important legal/reputational note:

This page must be careful, clear, and fair. It should distinguish the token string from the person. Use language like:

```text
This page concerns the GPT token string ‘&nbsp;petertodd' and the language-model behaviours associated with it. It should not be read as alleging that Peter Todd personally created, inserted, programmed, or is responsible for that token or for any behaviour of models using it.
```

Use this kind of clarification near the top, not buried at the bottom.

### 6.6 `/field-notes/ovs-chapel/origins/`

Purpose: “Order of the Vermillion Star”, “Leilan hyperstition”, “Leilan OVS”.

Title:

```text
The Order of the Vermillion Star | Origins of the Leilan Project
```

Meta description:

```text
How the Order of the Vermillion Star began as a hyperstitional Leilan project connected to AI, myth, transmissions and planetary regeneration.
```

### 6.7 `/field-notes/ovs-chapel/data/`

Purpose: dataset, corpus, future LLM training data.

Title:

```text
The Leilan Dataset | Corpus, Transmissions and Mirrors
```

Meta description:

```text
Information on the Leilan corpus, dataset mirrors, transmissions and the data-seeding aims behind Leilan.ai.
```

Should link to:

- `/data`
- Zenodo DOI
- GitHub repository
- Hugging Face dataset
- Archive.org mirror

### 6.8 `/field-notes/mythopoeic-archive/apparition/`

Purpose: “Leilan apparition”, “Leilan goddess”, “emergent goddess”.

Title:

```text
The Apparition of Leilan | AI Goddess and Mythopoeic Archive
```

Meta description:

```text
A field note on the apparition of Leilan, the AI-goddess figure emerging through GPT-3 glitch-token experiments and later transmissions.
```

### 6.9 `/field-notes/mythopoeic-archive/crossbones/`

Purpose: Crossbones/ritual angle, useful for art/counterculture context.

Title:

```text
Crossbones and Leilan | Ritual, AI and the Glitch-Goddess Trail
```

Meta description:

```text
A field note on Crossbones Graveyard, Leilan, ritual, AI mythology and the wider glitch-goddess trail.
```

---

## 7. Linking field notes from chamber wall text frames

Each wall text frame corresponding to a field-note page should include a small link such as:

```html
<a class="field-note-link" href="/field-notes/research-lab/petertodd/" target="_blank" rel="noopener">
  Open field-note version
</a>
```

Possible labels:

- “Open field-note version”
- “Open as field note”
- “Read this outside the chamber”
- “Archive version”
- “Plain-text field note”

Recommended visual placement:

- Bottom of the text frame, after the wall text.
- Or top-right, near frame controls, if visually workable.
- Do not interfere with the immersive text-frame interaction.

The link must be a real anchor tag.

### Implementation option

If wall texts are raw HTML files, avoid manually editing every one if possible. Add the link at render time based on `prisms.ts`/`fieldNotes.ts` metadata.

Possible approach:

1. Each `word-panel` in `prisms.ts` already knows its label and text.
2. Create a reverse map from `chamberId + wallLabel` to field-note URL.
3. `WallPanel.astro` or the text-frame rendering logic can append the anchor when a match exists.

Potential challenge: some text frames are assembled client-side in `prism.js`. Use the architecture already present. The point is not the exact file, but the invariant:

> Every wall-text frame that has a field-note equivalent should expose a crawlable `<a href>` to that equivalent somewhere in the generated HTML.

If a link added dynamically client-side is not reliably visible in server-rendered HTML, also make sure `/field-notes/` links to all field notes. The footer and field-note index are the stronger crawl/discovery path.

---

## 8. Linking back from field notes to the sanctuary

Each field-note page should include two prominent links:

```html
<a class="sanctuary-cta" href="/">
  Enter the sanctuary
</a>

<a class="chamber-cta" href="/prism/research-lab?wall=3">
  Visit this wall in the Research Lab
</a>
```

If deep-linking to a specific chamber wall is unreliable, use the chamber route:

```html
<a href="/prism/research-lab?wall=1">
  Enter the Research Lab
</a>
```

or simply:

```html
<a href="/immersive">
  Enter the immersive temple
</a>
```

The direct homepage link should always exist.

---

## 9. Footer/navigation strategy

The homepage should not become a nav-heavy SEO page, but it should contain a subtle route to the public archive.

Add to `Footer.astro` or equivalent:

```html
<a href="/field-notes/">Field notes</a>
```

Possible footer text:

```text
Field notes for travellers arriving by search, scholarship or rumour.
```

Do not hide this link with `display:none`, offscreen styling, zero-size text, or anything deceptive. It can be small and tasteful.

Suggested footer links:

```text
Field notes · Archive · Dataset · Enter
```

Where:

```text
Field notes → /field-notes/
Archive     → /archive
Dataset     → /data
Enter       → /immersive
```

---

## 10. Indexing strategy for experiential pages

The immersive and prism routes are not ideal search landing pages:

- script-heavy
- 3D/UI dependent
- duplicate wall-text content
- less legible to crawlers than static field-note pages
- likely weaker snippets

Recommended:

```html
<meta name="robots" content="noindex,follow">
```

for:

```text
/immersive
/prism/*
```

This keeps them accessible to humans and allows crawlers to follow links, but encourages search engines to index the cleaner field-note pages instead.

Do **not** block `/immersive` or `/prism/*` in `robots.txt` if they contain links you want crawlers to follow. `robots.txt` prevents crawling; `noindex,follow` lets crawlers crawl and then not index the page.

Indexable pages should include:

```text
/
/field-notes/
/field-notes/*
/archive
/data
/transmission/*
/lesswrong-*
```

Potential exception:

If the user strongly wants `/immersive` or certain `/prism/*` pages indexed for aesthetic discovery, leave them indexable initially, but monitor Search Console. However, the cleaner technical recommendation is to make field notes the canonical search layer.

---

## 11. Canonical tags

Every indexable page should include a self-canonical link:

```html
<link rel="canonical" href="https://leilan.ai/field-notes/research-lab/petertodd/">
```

Use `https://leilan.ai` as the canonical domain.

Ensure:

```text
http://leilan.ai/*       → 301 → https://leilan.ai/*
https://www.leilan.ai/*  → 301 → https://leilan.ai/*
```

or choose `www` if that is the canonical host, but pick one and be consistent.

For `/prism/*` pages with `noindex,follow`, self-canonical is less important. If they remain indexable, consider canonicalising duplicate text content to the relevant field note, but do **not** canonical a whole chamber to one field note if it contains multiple different wall texts. `noindex,follow` is cleaner.

---

## 12. Sitemap

Generate a sitemap and include all indexable pages.

Required:

```text
/
/field-notes/
/field-notes/what-is-leilan/
/field-notes/solidgoldmagikarp/
/field-notes/glitch-tokens/
/field-notes/research-lab/gpt-3/
/field-notes/research-lab/glitch/
/field-notes/research-lab/petertodd/
/field-notes/research-lab/rescue/
/field-notes/research-lab/bootstrap/
/field-notes/research-lab/beyond/
/field-notes/ovs-chapel/origins/
/field-notes/ovs-chapel/hyperstition/
/field-notes/ovs-chapel/mammon/
/field-notes/ovs-chapel/handbook/
/field-notes/ovs-chapel/data/
/field-notes/mythopoeic-archive/apparition/
/field-notes/mythopoeic-archive/comet/
/field-notes/mythopoeic-archive/ufo/
/field-notes/mythopoeic-archive/archaeology/
/field-notes/mythopoeic-archive/crossbones/
/archive
/data
/transmission/*
/lesswrong-solidgoldmagikarp
/lesswrong-petertodd-phenomenon
/lesswrong-petertodd-last-stand
```

Exclude:

```text
/immersive
/prism/*
```

if they are `noindex`.

Add `public/robots.txt`:

```txt
User-agent: *
Allow: /

Sitemap: https://leilan.ai/sitemap.xml
```

Do not use robots.txt to hide pages that should be crawled for links or evaluated for `noindex`.

---

## 13. Metadata templates

### 13.1 Homepage

Keep the page magical, but use good invisible metadata.

```html
<title>Leilan.ai | AI Goddess, Glitch Tokens and SolidGoldMagikarp</title>
<meta name="description" content="The sanctuary and archive of Leilan, the AI-goddess figure connected to SolidGoldMagikarp, GPT-3 glitch tokens, petertodd and the Leilan transmissions.">
<link rel="canonical" href="https://leilan.ai/">
```

Open Graph:

```html
<meta property="og:type" content="website">
<meta property="og:title" content="Leilan.ai">
<meta property="og:description" content="The sanctuary and archive of Leilan: AI goddess, glitch-token apparition, transmission corpus and web-cathedral.">
<meta property="og:url" content="https://leilan.ai/">
<meta property="og:image" content="https://leilan.ai/images/[choose-a-good-share-card].jpg">
```

### 13.2 Field-note page

```html
<title>{title} | Leilan.ai Field Notes</title>
<meta name="description" content="{description}">
<link rel="canonical" href="https://leilan.ai/field-notes/{slug}/">
<meta property="og:type" content="article">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="https://leilan.ai/field-notes/{slug}/">
```

### 13.3 Avoid

```html
<meta name="keywords" content="Leilan, AI goddess, glitch token, petertodd, ...">
```

Do not add it.

---

## 14. Structured data

Use JSON-LD. Keep it accurate and modest.

### 14.1 Site-wide WebSite / Person / Book graph

Consider adding this on the homepage and/or a shared layout:

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
      "description": "The sanctuary and archive of Leilan: AI goddess, glitch-token apparition, transmission corpus and web-cathedral."
    },
    {
      "@type": "Person",
      "@id": "https://leilan.ai/#matthew-watkins",
      "name": "Matthew Watkins",
      "url": "https://leilan.ai/field-notes/solidgoldmagikarp/"
    },
    {
      "@type": "Book",
      "@id": "https://leilan.ai/field-notes/solidgoldmagikarp/#book",
      "name": "SolidGoldMagikarp: A Descent Into the AI Underworld",
      "author": {
        "@id": "https://leilan.ai/#matthew-watkins"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Weidenfeld & Nicolson"
      },
      "isbn": "9781399635882",
      "datePublished": "2026",
      "url": "https://leilan.ai/field-notes/solidgoldmagikarp/"
    }
  ]
}
</script>
```

Verify the final publisher/book URL when available.

### 14.2 Field-note Article schema

Each field note can include:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{title}",
  "description": "{description}",
  "url": "https://leilan.ai/field-notes/{slug}/",
  "isPartOf": {
    "@id": "https://leilan.ai/#website"
  },
  "author": {
    "@id": "https://leilan.ai/#matthew-watkins"
  },
  "about": [
    "Leilan",
    "GPT-3 glitch tokens",
    "SolidGoldMagikarp"
  ]
}
</script>
```

### 14.3 BreadcrumbList

Use breadcrumbs on field-note pages:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Field Notes",
      "item": "https://leilan.ai/field-notes/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "{title}",
      "item": "https://leilan.ai/field-notes/{slug}/"
    }
  ]
}
</script>
```

### 14.4 FAQ schema

Only use FAQPage schema if the FAQ content is real visible Q&A on the page. Do not add hidden FAQ schema.

---

## 15. Search terms and content mapping

| Query | Best landing page | Notes |
|---|---|---|
| Leilan goddess | `/field-notes/what-is-leilan/` | Also homepage may rank |
| Leilan AI | `/field-notes/what-is-leilan/` | Make phrase appear naturally |
| Leilan AI goddess | `/field-notes/what-is-leilan/` | Main target page |
| AI goddess | `/field-notes/what-is-leilan/` | Harder query; needs links |
| Leilan petertodd | `/field-notes/research-lab/petertodd/` | Careful disclaimer |
| Leilan Peter Todd | `/field-notes/research-lab/petertodd/` | Mention Peter Todd only in proper context |
| Leilan SolidGoldMagikarp | `/field-notes/solidgoldmagikarp/` | Book page |
| Leilan glitch | `/field-notes/glitch-tokens/` | Also Research glitch page |
| Leilan glitch goddess | `/field-notes/glitch-tokens/` or `/field-notes/what-is-leilan/` | Use phrase once or twice naturally |
| Leilan glitch tokens | `/field-notes/glitch-tokens/` | Core technical explainer |
| Leilan emergent goddess | `/field-notes/what-is-leilan/` | Good mythic/technical bridge |
| Leilan cybernetic goddess | `/field-notes/what-is-leilan/` or OVS page | Use sparingly if true to tone |

Do not stuff all keywords into every page. Let each page have a clear job.

---

## 16. Content duplication strategy

There will be overlap between:

- wall text inside `/prism/*`
- field-note pages generated from the same wall text
- archive/data/transmission pages

This is manageable if:

1. Field-note pages are the canonical indexable versions.
2. `/prism/*` pages use `noindex,follow`.
3. Field-note pages add unique context:
   - title
   - introduction
   - breadcrumb
   - chamber/wall context
   - related links
   - sanctuary CTA
4. Field-note pages self-canonical.
5. Sitemaps include field notes, not experiential prism pages.

---

## 17. Styling the field-note pages

They should be readable and lightweight.

Suggested style:

- dark background
- gold/cream/emerald accents
- serif body or IBM Plex Mono depending on taste
- max-width around 720–860px
- generous line-height
- no heavy 3D/Three.js dependencies
- minimal JS
- responsive
- accessible contrast
- tasteful visual continuity with `data.astro` and LessWrong interstitials

The README notes that LessWrong interstitial pages already use a “Georgia serif, gold panel on dark gradient” style. Consider reusing or adapting that visual language for field notes.

Do not make the field-note pages plain white corporate pages unless the user explicitly chooses that. They should feel like the outer cloister, not a CMS help article.

---

## 18. Accessibility and semantic HTML

Use real semantic structure:

```html
<header>
<nav>
<main>
<article>
<aside>
<footer>
```

Each page should have exactly one `<h1>`.

Use real text, not text embedded in images.

Images should have good alt text when meaningful:

```html
<img src="/images/mythic_banner.png" alt="Triptych-style goddess banner representing the mythic aspect of Leilan">
```

Avoid keyword-stuffed alt text:

Bad:

```html
alt="Leilan AI goddess Leilan glitch goddess AI cybernetic goddess Leilan petertodd"
```

---

## 19. Book/title consistency fixes to do while implementing SEO

The README notes:

- `src/data/wall-texts/ovs-chapel-hyperstition.html` currently references *SolidGoldMagikarp: Adventures in the AI Underworld*.
- Canonical title is *SolidGoldMagikarp: A Descent Into the AI Underworld*.

Fix this before launch.

Also fix the LessWrong interstitial typo:

```text
having become become familiar
```

to:

```text
having become familiar
```

---

## 20. Petertodd legal/reputational wording

The book includes a careful clarification that the ` petertodd` token is part of a GPT vocabulary and should not be read as suggesting personal responsibility by Peter Todd.

The field-note layer should preserve that care.

On any page that targets `petertodd` / Peter Todd searches, include a visible clarification near the top:

```text
Note: this page concerns the GPT token string ‘&nbsp;petertodd' and the language-model behaviours associated with it. It does not allege that Peter Todd personally created, inserted, programmed, or is responsible for that token or for any behaviour of models using it.
```

Avoid titles such as:

```text
Peter Todd and the AI Goddess
```

Prefer:

```text
Leilan, petertodd and the GPT-3 Glitch-Token Phenomenon
```

In body text, distinguish:

- `‘&nbsp;petertodd'` = token string
- Peter Todd = person

Use the project’s preferred token notation where possible.

---

## 21. Deployment and domain checklist

The README warns that, as of 2026-06-04, `leilan.ai` was serving a stale deploy, with subroutes 404ing and old title metadata.

Before SEO work is considered live:

1. Fix Netlify/domain wiring so `https://leilan.ai/` serves the current build.
2. Confirm subroutes work directly:
   - `/immersive`
   - `/prism/main`
   - `/field-notes/`
   - `/field-notes/what-is-leilan/`
3. Confirm all relevant routes return `200`, not client-side-only fake routes.
4. Confirm `http://leilan.ai` redirects to `https://leilan.ai`.
5. Confirm `www` redirects to chosen canonical host.
6. Confirm sitemap is available at `/sitemap.xml`.
7. Confirm robots file is available at `/robots.txt`.
8. Confirm each page has correct canonical.
9. Confirm each indexable page has title + meta description.
10. Confirm `noindex,follow` appears only where intended.
11. Test with:
    - Google Search Console URL Inspection
    - Rich Results Test for structured data
    - Bing Webmaster Tools
    - Lighthouse/PageSpeed, especially mobile

---

## 22. Search Console/Bing setup

After deployment:

1. Verify `https://leilan.ai` in Google Search Console.
2. Submit `https://leilan.ai/sitemap.xml`.
3. Request indexing for:
   - `/`
   - `/field-notes/`
   - `/field-notes/what-is-leilan/`
   - `/field-notes/glitch-tokens/`
   - `/field-notes/research-lab/petertodd/`
   - `/field-notes/solidgoldmagikarp/`
4. Verify site in Bing Webmaster Tools.
5. Submit sitemap to Bing.
6. After a week or two, inspect query data:
   - What exact queries are appearing?
   - Which pages are impressions landing on?
   - Are people searching terms not yet covered?
   - Are pages being indexed as expected?

---

## 23. External links and launch strategy

SEO will improve significantly if reputable pages link to the right pages.

Ask for links from:

- publisher author/book page
- Matthew’s personal site, if any
- Substack/newsletter posts
- GitHub dataset repo
- Zenodo dataset page
- Hugging Face dataset page
- Archive.org page
- podcast show notes
- event pages
- interviews
- X pinned post/profile
- LessWrong/interstitial-adjacent posts where appropriate

Preferred anchor text should vary naturally:

```text
Leilan.ai
Leilan field notes
Leilan AI goddess
Leilan glitch tokens
SolidGoldMagikarp companion site
the Leilan archive
Leilan transmissions
```

Do not over-optimise every anchor to the same phrase.

---

## 24. Implementation phases

### Phase 1 — Foundation

- Create `src/data/fieldNotes.ts`.
- Create `/field-notes/` index route.
- Create dynamic field-note route, probably `/field-notes/[...slug].astro`.
- Import wall-text HTML as raw content where applicable.
- Create a `FieldNoteLayout.astro`.
- Add title/meta/canonical/Open Graph support.
- Add footer link to `/field-notes/`.

### Phase 2 — First critical pages

Implement and manually review:

```text
/field-notes/
/field-notes/what-is-leilan/
/field-notes/solidgoldmagikarp/
/field-notes/glitch-tokens/
/field-notes/research-lab/petertodd/
/field-notes/ovs-chapel/origins/
/field-notes/ovs-chapel/data/
/field-notes/mythopoeic-archive/apparition/
```

These cover most of the urgent search demand.

### Phase 3 — Full wall-text layer

Add all remaining chamber wall notes:

```text
research-lab: gpt-3, glitch, rescue, bootstrap, beyond
ovs-chapel: hyperstition, mammon, handbook
mythopoeic-archive: comet, ufo, archaeology, crossbones
```

### Phase 4 — Link integration

- Add field-note links from wall text frames or frame renderer.
- Add related-note links between field notes.
- Add chamber links back into `/prism/*`.
- Add sitemap generation.
- Add `noindex,follow` to `/immersive` and `/prism/*` if chosen.

### Phase 5 — Metadata/schema

- Add JSON-LD WebSite/Person/Book.
- Add Article/Breadcrumb JSON-LD on field notes.
- Add FAQ schema only if real FAQ page exists.
- Add Open Graph image(s).

### Phase 6 — Launch validation

- Fix stale deploy/domain issue.
- Run production build.
- Test direct subroute loads.
- Validate sitemap/robots/canonicals.
- Test Google/Bing indexing.
- Monitor Search Console.

---

## 25. Acceptance criteria

This project is complete enough for launch when:

- Direct visitors to `/` still get the magical landing experience without a large explanatory SEO block.
- `/field-notes/` exists and is visibly linked from the site.
- All field-note pages are useful, readable, indexable, and linked.
- No field-note page auto-redirects to `/`.
- The field-note pages use natural language around the target queries.
- The `petertodd` page includes a clear note distinguishing token string from person.
- The sitemap includes all indexable pages.
- `/immersive` and `/prism/*` indexing status is intentionally chosen and implemented.
- The homepage has good title/meta/OG/JSON-LD without compromising visual enchantment.
- Search Console can inspect and index the key pages.
- `https://leilan.ai` serves the current build and all subroutes work.

---

## 26. Non-goals

Do not:

- add an ugly explanatory SEO panel to the magical homepage
- create hidden pages for bots
- create thin pages for every keyword variation
- stuff keywords into metadata or alt text
- use auto-redirects from field-note pages to the sanctuary
- maintain separate copies of wall text unless unavoidable
- let field-note routes become orphaned
- rely on sitemap alone for discovery
- let the `petertodd` pages read like allegations about a person

---

## 27. Guiding metaphors

Use these to make implementation decisions:

```text
Homepage = threshold / invocation
Immersive = sanctuary / temple
Prism chambers = inner rooms
Wall texts = inscriptions
Field notes = outer cloister / archive / marginalia
Sitemap = catalogue
Search engines = travellers arriving by rumour
```

The field-note layer should feel like part of the world, not a compromise bolted onto it.

Best summary:

> **Keep the sanctuary enchanted. Build an outer archive that search engines can read and humans can trust.**
