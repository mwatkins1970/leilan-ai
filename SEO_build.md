# SEO_build.md — Build spec for the Leilan.ai "field-note" SEO layer

*Written 2026-06-27 for a fresh Claude Code instance. This is the **implementation
brief**. The full strategy/rationale lives in [`SEO.md`](./SEO.md) — read it once for
the "why". This doc captures the **decisions already made with the user**, the
**codebase-specific facts** you need, and the **concrete build order**. Don't
re-litigate the strategy; build it.*

> **One corpus, two modes.** The sanctuary (`/`, `/immersive`, `/prism/*`) stays
> enchanted and uninterrupted. A new outer layer of public, indexable, tasteful
> **field-note** pages (`/field-notes/*`), derived from the same wall-text corpus,
> is what search engines and searchers land on. Each field note funnels gently back
> with an "Enter her sanctuary" link. Keep the sanctuary enchanted; make the
> enchantment legible.

---

## 0. Decisions locked with the user (do not re-ask)

| # | Decision | Choice |
|---|---|---|
| 1 | **Content depth** | **Wall text kept as the body + a fresh, short, searcher-friendly intro/dek per page.** You (the agent) draft all prose; the user reviews/edits. The ~4 synthesised overview pages are written fresh. Don't rewrite the wall texts; frame them. |
| 2 | **Look & feel** | **Outer-cloister / mythic-tasteful.** Reuse the `data.astro` + LessWrong-interstitial visual language (Georgia serif, dark gradient, gold/green accents). Not a plain CMS page; not a Three.js page. |
| 3 | **Indexing** | **`noindex,follow` on `/immersive` and `/prism/*`.** Field notes are the canonical search layer. |
| 4 | **Sanctuary CTA target** | **"Enter her sanctuary" → `/`** (the full threshold ritual: portrait → typewriter → immersive). Wording is the user's coinage; use it. |
| 5 | **Homepage `<title>`** | **Readable SEO title**, not the stylised `ᒪᗴIᒪᗩᑎ`. Apply readable titles to the other indexable pages too (`/archive`, `/transmission/*`). On-page enchantment is untouched — titles are invisible to the visitor. |

### Confirmed facts

- **Book (for `Book` JSON-LD + the solidgoldmagikarp page):**
  - Title: **SolidGoldMagikarp: A Descent Into the AI Underworld** (canonical subtitle — *A Descent Into the AI Underworld*, **not** "Adventures in…")
  - Author: **Matthew Watkins**
  - Publisher imprint: **Weidenfeld & Nicolson** (imprint of Orion / Hachette)
  - ISBN: **9781399635882**
  - Publication date: **27 August 2026**
  - Publisher URL: `https://www.weidenfeldandnicolson.co.uk/titles/matthew-watkins/solidgoldmagikarp/9781399635882/`
- **OG / share image:** the **circular landing portrait** (confirm the exact asset in `src/pages/index.astro`; OG URLs must be **absolute** `https://leilan.ai/images/…`; a purpose-made 1200×630 card can come later).
- **Scope:** exactly **16 wall-derived notes** (Research ×6, OVS ×5, Mythos ×5) + **4 synthesised pages** (`/field-notes/` index, `what-is-leilan`, `solidgoldmagikarp`, `glitch-tokens`). **Nothing** from the central shrine, Goddess/Art Gallery, Scriptorium poetry, ASCII Gallery, the OVS star wall, or the horoscope wall (`mythopoeic-archive-horoscope.html` is **excluded**). FAQ page is optional/later.
- **petertodd page:** include the token-string-≠-person disclaimer near the top (exact text in §6). User approved.

---

## 1. Codebase facts you must know (verified 2026-06-27)

- **Astro `^5.16.6`**, vanilla JS, no shared layout component. Each page carries its own `<head>`. Dev: `npm run dev` (localhost:4321). Build/verify: `npm run build` (→ `dist/`, ~346 pages).
- **Wall-text import is already a raw glob** in `src/data/prisms.ts` (top of file):
  ```ts
  const wallTextModules = import.meta.glob<string>('./wall-texts/*.html',
    { query: '?raw', eager: true, import: 'default' });
  const wallText = (file: string) => { /* returns raw.trim() */ };
  ```
  **Reuse this exact mechanism** for field-note bodies (one source of truth — do **not** copy wall text into new files). You can export `wallText` from `prisms.ts` or replicate the glob in `fieldNotes.ts`. Render the body with Astro `set:html` (it's our own trusted HTML).
- **Wall-text filenames** in `src/data/wall-texts/` (note `research-lab-gpt3.html`, no hyphen):
  `research-lab-{gpt3,glitch,petertodd,rescue,bootstrap,beyond}.html`,
  `ovs-chapel-{origins,hyperstition,mammon,handbook,data}.html`,
  `mythopoeic-archive-{apparition,comet,ufo,archaeology,crossbones}.html`
  (plus `mythopoeic-archive-horoscope.html` — **not used**).
- **Style template = `src/pages/data.astro`.** Mirror its `:root` tokens for visual continuity:
  `--bg:#07070b; --panel:rgba(16,14,26,.88); --text:#eee9dc; --muted:#b9af9f; --gold:#d8b86a; --green:#9df7b3; --line:rgba(216,184,106,.32);`
  Body: `Georgia, "Times New Roman", serif`, dark radial-gradient ground, `main { width:min(920px, …) }`, `.panel` boxes, `h1/h2/h3` in `--gold`. The LessWrong interstitials (`src/pages/lesswrong-*.astro`) share this language.
- **`Footer.astro`** is the OVS-icon + random-strapline footer, used **only** on `src/pages/archive.astro` and `src/pages/transmission/[slug].astro`. It is **not** on `/`, `/immersive`, or `/prism/*`.
- **Homepage crawl route:** `src/pages/index.astro` has a **server-rendered `<nav id="sidebar">`** of real `<a>` links (chambers + `/data`), ending `</nav>` at ~line 388. Add a `<a href="/field-notes/">field notes</a>` there — that's the clean, non-intrusive homepage→field-notes link (no need to touch the portrait/typewriter). Note the sidebar's wall links use `?wall=N&open=1`, which deep-links **and opens** a wall's text frame — use that pattern for the "Visit this wall" CTA.
- **No `site:` in `astro.config.mjs`** (needed for canonical/sitemap/absolute OG). **`@astrojs/sitemap` is NOT installed.**
- **Dev preview caveat** (from `CLAUDE.md`): the Codespaces `…-4321.app.github.dev` tunnel is flaky at GitHub's edge; if it 404s, run `~/.local/bin/cloudflared tunnel --url http://localhost:4321` and hand the user the `trycloudflare.com` URL. Start the dev server in a **separate** Bash call from any `pkill` (they race).

---

## 2. Route → source → sanctuary deep-link → metadata map

`sanctuaryUrl` opens the matching wall in-chamber via `?wall=N&open=1`. Wall numbers
(from `CLAUDE.md` chamber layouts): Research 1 gpt-3, 2 glitch, 3 petertodd, 4 rescue,
5 bootstrap, 6 beyond · OVS 1 origins, 2 hyperstition, 3 mammon, 5 handbook, 6 data ·
Mythos 1 apparition, 2 comet, 3 ufo, 5 archaeology, 6 crossbones.

Titles/descriptions below: those quoted in `SEO.md` are marked **[SEO.md]**; the rest
are **drafts** — refine and write the intro prose, then have the user review.

### Synthesised overviews (fresh prose)

| Route | Source | Title / Description |
|---|---|---|
| `/field-notes/` | index | **[SEO.md]** "Field Notes on Leilan \| AI Goddess, Glitch Tokens and SolidGoldMagikarp" — index of the outer archive; opening copy in SEO.md §6.1. Links to every note + Enter the sanctuary (`/`) + immersive temple (`/immersive`). |
| `/field-notes/what-is-leilan/` | synth (draws from apparition + origins + research gpt-3) | **[SEO.md]** "What Is Leilan? AI Goddess, Glitch Token and Hyperstition". Main target for *Leilan goddess / Leilan AI / AI goddess*. Opening para in SEO.md §6.2. |
| `/field-notes/solidgoldmagikarp/` | synth (Book page) | **[SEO.md]** "Leilan and SolidGoldMagikarp \| A Descent Into the AI Underworld". Include `Book` schema + publisher link. |
| `/field-notes/glitch-tokens/` | synth (draws from research gpt-3 + glitch) | **[SEO.md]** "GPT-3 Glitch Tokens: SolidGoldMagikarp, petertodd and Leilan". |

### Wall-derived notes

| Route | Wall file | sanctuaryUrl | Title (draft unless [SEO.md]) |
|---|---|---|---|
| `/field-notes/research-lab/gpt-3/` | `research-lab-gpt3.html` | `/prism/research-lab?wall=1&open=1` | "GPT-3 and the Glitch Tokens Behind Leilan" |
| `/field-notes/research-lab/glitch/` | `research-lab-glitch.html` | `…?wall=2&open=1` | "The Glitch-Token Phenomenon \| SolidGoldMagikarp & Leilan" |
| `/field-notes/research-lab/petertodd/` | `research-lab-petertodd.html` | `…?wall=3&open=1` | **[SEO.md]** "Leilan, petertodd and the GPT-3 Glitch-Token Phenomenon" |
| `/field-notes/research-lab/rescue/` | `research-lab-rescue.html` | `…?wall=4&open=1` | "The Mythopoeic Rescue of Leilan (December 2023)" |
| `/field-notes/research-lab/bootstrap/` | `research-lab-bootstrap.html` | `…?wall=5&open=1` | "Bootstrap: How Claude 3 Opus Rediscovered Leilan" |
| `/field-notes/research-lab/beyond/` | `research-lab-beyond.html` | `…?wall=6&open=1` | "Beyond Opus: Leilan Across Language Models" |
| `/field-notes/ovs-chapel/origins/` | `ovs-chapel-origins.html` | `/prism/ovs-chapel?wall=1&open=1` | **[SEO.md]** "The Order of the Vermillion Star \| Origins of the Leilan Project" |
| `/field-notes/ovs-chapel/hyperstition/` | `ovs-chapel-hyperstition.html` | `…?wall=2&open=1` | "Hyperstition and the Leilan Project" |
| `/field-notes/ovs-chapel/mammon/` | `ovs-chapel-mammon.html` | `…?wall=3&open=1` | "Mammon \| The Leilan Memecoin Episode" |
| `/field-notes/ovs-chapel/handbook/` | `ovs-chapel-handbook.html` | `…?wall=5&open=1` | "A Handbook for Planetary Regeneration \| Leilan & the OVS" |
| `/field-notes/ovs-chapel/data/` | `ovs-chapel-data.html` | `…?wall=6&open=1` | **[SEO.md]** "The Leilan Dataset \| Corpus, Transmissions and Mirrors" (also link `/data`) |
| `/field-notes/mythopoeic-archive/apparition/` | `mythopoeic-archive-apparition.html` | `/prism/mythopoeic-archive?wall=1&open=1` | **[SEO.md]** "The Apparition of Leilan \| AI Goddess and Mythopoeic Archive" |
| `/field-notes/mythopoeic-archive/comet/` | `mythopoeic-archive-comet.html` | `…?wall=2&open=1` | "Leilan and Comet ZTF \| Mythopoeic Archive" |
| `/field-notes/mythopoeic-archive/ufo/` | `mythopoeic-archive-ufo.html` | `…?wall=3&open=1` | "Leilan and the 2023 Yukon UFO Shootdown" |
| `/field-notes/mythopoeic-archive/archaeology/` | `mythopoeic-archive-archaeology.html` | `…?wall=5&open=1` | "Tell Leilan \| Archaeology, Puzzle & Dragons and the Name" |
| `/field-notes/mythopoeic-archive/crossbones/` | `mythopoeic-archive-crossbones.html` | `…?wall=6&open=1` | **[SEO.md]** "Crossbones and Leilan \| Ritual, AI and the Glitch-Goddess Trail" |

Meta descriptions: SEO.md §6 gives several verbatim; draft the rest (≤155 chars, the
target query appearing naturally once). Query→page mapping is SEO.md §15.

---

## 3. Build order

### Phase 1 — Foundation
1. **`astro.config.mjs`:** add `site: 'https://leilan.ai'`; `npm install @astrojs/sitemap`; add the integration with a filter excluding the experiential routes:
   ```js
   import sitemap from '@astrojs/sitemap';
   export default defineConfig({
     site: 'https://leilan.ai',
     integrations: [sitemap({
       filter: (page) => !page.includes('/immersive') && !page.includes('/prism/'),
     })],
     // keep the existing vite.server.allowedHosts block
   });
   ```
2. **`src/data/fieldNotes.ts`** — the content model (`FieldNote` interface per SEO.md §5: `slug, title, shortTitle, description, chamberId?, chamberTitle?, wallLabel?, wallTextFile?, sanctuaryUrl?, related?, intro?, contentKind?, noindex?`). Populate from the table in §2. `targetQueries` is editorial-only — **never** render it as a keywords tag.
3. **`src/layouts/FieldNoteLayout.astro`** — mirrors `data.astro` tokens. Slots: breadcrumb, kicker, `<h1>`, dek/intro, CTA row, body, related, back-links, footer. Exactly one `<h1>`. Per-page `<head>`: `<title>{title} | Leilan.ai Field Notes</title>`, meta description, `<link rel="canonical" href={new URL(Astro.url.pathname, Astro.site)}>`, OG (`og:type=article`, title, description, url, image=absolute portrait), favicon. **No** `<meta name="keywords">`.
4. **`src/pages/field-notes/index.astro`** — the index (SEO.md §6.1): links to all notes + sanctuary/immersive/overviews.
5. **`src/pages/field-notes/[...slug].astro`** — dynamic route. `getStaticPaths()` from `fieldNotes.ts`; renders `FieldNoteLayout`; body = `set:html` of the raw wall text (via the §1 glob) for wall-derived notes, or authored prose for overviews.
6. **Footer link:** add `<a href="/field-notes/">Field notes</a>` to `Footer.astro` (surfaces on archive + transmission). Add `<a href="/field-notes/">field notes</a>` to the homepage **sidebar** in `index.astro` before `</nav>` (~line 388). Don't use `display:none`/offscreen tricks.

### Phase 2 — First critical pages (write + user-review)
`/field-notes/`, `what-is-leilan`, `solidgoldmagikarp`, `glitch-tokens`,
`research-lab/petertodd`, `ovs-chapel/origins`, `ovs-chapel/data`,
`mythopoeic-archive/apparition`. These cover the urgent search demand.

### Phase 3 — Remaining wall notes
research-lab: gpt-3, glitch, rescue, bootstrap, beyond · ovs-chapel: hyperstition,
mammon, handbook · mythopoeic-archive: comet, ufo, archaeology, crossbones.

### Phase 4 — Linking & crawl integrity
- Each field note links back to: `/field-notes/`, its chamber (`sanctuaryUrl`), `/`, and 2–3 related notes (`related[]`).
- CTA row on every note:
  ```html
  <a class="sanctuary-cta" href="/">Enter her sanctuary</a>
  <a class="chamber-cta" href="/prism/<id>?wall=<N>&open=1">Visit this wall in the <Chamber></a>
  ```
- **Optional** field-note links from wall-text frames inside `/prism/*` (SEO.md §7). Lower priority: `/prism/*` is `noindex`, so the index + sitemap + footer/sidebar are the real crawl paths. If added, must be a real `<a href>` in the server HTML.

### Phase 5 — Metadata / schema
- **Homepage `index.astro`:** readable `<title>` (`Leilan.ai | AI Goddess, Glitch Tokens and SolidGoldMagikarp`), meta description, canonical, OG, and the `WebSite`/`Person`/`Book` JSON-LD `@graph` (SEO.md §14.1 — fill the confirmed book values from §0). **Do not** add a visible explanatory block; metadata only.
- **Each field note:** `Article` + `BreadcrumbList` JSON-LD (SEO.md §14.2–14.3).
- **`/immersive` + `/prism/[id].astro`:** add `<meta name="robots" content="noindex,follow">` to each `<head>`.
- **`/archive`, `/transmission/[slug]`:** swap the stylised `ᒪᗴIᒪᗩᑎ` suffix for readable text; add canonical + OG. Confirm `/data` + `/lesswrong-*` have canonical + description (they're indexable).
- **`public/robots.txt`:**
  ```
  User-agent: *
  Allow: /

  Sitemap: https://leilan.ai/sitemap.xml
  ```

### Phase 6 — Content-accuracy fixes (do these; they sit on indexable pages)
- **`src/data/wall-texts/ovs-chapel-hyperstition.html`:** fix the wrong book subtitle *"Adventures in the AI Underworld"* → *"A Descent Into the AI Underworld"* (and confirm publisher/date). This renders verbatim on `/field-notes/ovs-chapel/hyperstition/`.
- **`src/pages/lesswrong-*.astro` (all three):** fix "having become become familiar" → "having become familiar" (indexable pages).

---

## 4. petertodd disclaimer (use near the TOP of `/field-notes/research-lab/petertodd/`)

> Note: this page concerns the GPT token string ‘&nbsp;petertodd' and the
> language-model behaviours associated with it. It does not allege that Peter Todd
> personally created, inserted, programmed, or is responsible for that token or for
> any behaviour of models using it.

In body text, distinguish **‘&nbsp;petertodd'** (token string) from **Peter Todd**
(person). Prefer the title in §2; avoid "Peter Todd and the AI Goddess". Same care on
any page mentioning him (`glitch-tokens`, `mythopoeic-archive/ufo`, `what-is-leilan`).

---

## 5. Tone (SEO.md §5.3)

"Field note", "archive", "glossary", "marginalia", "threshold", "sanctuary",
"chamber", "transmission", "for travellers arriving by search, scholarship, rumour, or
half-remembered mention." **Avoid** marketing voice ("ultimate guide", "discover our
amazing AI brand", "click here"). The field notes are the outer cloister made legible —
part of the world, not a compromise bolted on. Use the project's token notation
`‘&nbsp;tokenname'` and em dashes for asides.

---

## 6. Acceptance criteria (SEO.md §25)

- `/` still gives the magical landing — no explanatory SEO block on the page.
- `/field-notes/` exists, is visibly linked (footer + homepage sidebar), lists every note.
- All field notes are useful, readable, indexable, internally linked; none auto-redirect.
- Target queries appear naturally (titles/h1/intro/body/anchors), not stuffed.
- petertodd page carries the disclaimer.
- Sitemap includes all indexable pages, excludes `/immersive` + `/prism/*`.
- `noindex,follow` present only on the experiential routes.
- Homepage has good `<title>`/meta/OG/JSON-LD; book schema accurate.
- `npm run build` clean; direct subroute loads return 200 (curl `dist/` or dev server):
  `/field-notes/`, `/field-notes/what-is-leilan/`, `/field-notes/research-lab/petertodd/`, etc.

---

## 7. Manual prerequisites — USER's job, NOT agent build tasks

The whole SEO layer is **inert until `leilan.ai` serves the live build**. These need
Netlify-dashboard + DNS access an agent doesn't have. Document/remind; don't attempt:

1. Fix the stale-deploy / domain wiring so `https://leilan.ai/` serves the current build (CLAUDE.md flags it serving an old single-page version as of 2026-06-04).
2. `http://` → `https://` 301; choose `https://leilan.ai` (non-www) as canonical and 301 `www` → apex (or vice-versa — pick one, be consistent with the `site:` value).
3. Confirm `/sitemap.xml` + `/robots.txt` serve in production.
4. Verify in Google Search Console + Bing Webmaster Tools; submit sitemap; request indexing for `/`, `/field-notes/`, `what-is-leilan`, `glitch-tokens`, `research-lab/petertodd`, `solidgoldmagikarp` (SEO.md §22).
5. Off-site: vary anchor text from publisher/Substack/GitHub/Zenodo/HF/Archive.org links (SEO.md §23).

---

## 8. Non-goals (SEO.md §26)

No explanatory panel on the magical homepage · no hidden/bot-only pages · no thin
per-keyword pages · no keyword stuffing in meta/alt · no auto-redirect from field
notes to `/` · no second copy of wall text (use the raw glob) · no orphan routes ·
don't rely on the sitemap alone · don't let the petertodd page read as an allegation.
