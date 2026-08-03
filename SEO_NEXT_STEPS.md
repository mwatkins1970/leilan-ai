# SEO_NEXT_STEPS.md — the remaining off-page work, for M to do by hand

*Written 2026-08-03. Audience: **Matthew**, not Claude. These are the tasks that
need a human with logins — Claude can't do any of them from the Codespace.*

The on-page work is finished (see `CLAUDE.md` → *Field-Note Layer (SEO)*). What's
left is verification, submission and backlinks. Nothing here is urgent, but the
backlinks matter most and the book drops 2026-08-27.

**Already confirmed done — don't redo these:** domain + canonical, Google Search
Console verification + sitemap submission, and the `http→https` / `www→apex`
301s (checked live 2026-08-03: `http://leilan.ai/` → `https://leilan.ai/`, and
`http://www.leilan.ai/` → `https://www.leilan.ai/` → `https://leilan.ai/`).

---

## 1. Google Search Console — request re-indexing (5 minutes)

Two pages changed on 2026-08-03 and Google is still holding the old titles.

1. <https://search.google.com/search-console> → property `sc-domain:leilan.ai`.
2. Paste `https://leilan.ai/field-notes/what-is-leilan/` into the **URL
   Inspection** bar at the top → wait for the result → **Request Indexing**.
3. Repeat for `https://leilan.ai/field-notes/solidgoldmagikarp/`.

Expect "URL is available to Google". Indexing typically takes a few days; the
request just puts them in the queue. There's a daily quota of ~10 requests, so
don't bulk-submit everything.

**Worth checking while you're in there:** Performance → Queries, filtered to the
last 28 days. The queries this pass targeted are *Leilan AI*, *Leilan AI
goddess*, *Leilan goddess*, *Matthew Watkins Leilan*, *SolidGoldMagikarp
Leilan*. Note where you currently rank so there's a baseline to compare against
after the book lands.

---

## 2. Bing Webmaster Tools (15 minutes)

Bing also feeds DuckDuckGo and ChatGPT search, so it's worth more than its
market share suggests.

1. <https://www.bing.com/webmasters> → sign in.
2. **Import from Google Search Console** — the big time-saver. It carries over
   verification and sitemaps in one step. Take this option if offered.
3. If importing fails, verify manually. Easiest for this setup is the **DNS
   TXT record** method, since the domain is already yours — Netlify DNS →
   add the TXT record Bing gives you. (The HTML-file method would mean
   committing a file to `public/`; the meta-tag method would mean editing
   `index.astro`. Both work, but DNS keeps the repo clean.)
4. Submit the sitemap: `https://leilan.ai/sitemap-index.xml`.
5. Under **URL Inspection**, submit the two field-note URLs from §1.

---

## 3. Backlink seeding (the highest-value item)

The site currently has almost no inbound links, which is the main thing holding
back the target queries. Every link below is legitimate — a real resource
pointing at a real project.

**Vary the anchor text.** Using the same phrase everywhere looks manipulative
and works less well. Rotate among: *Leilan.ai*, *the Leilan project*, *What is
Leilan?*, *the Leilan AI-goddess figure*, *Leilan and the glitch tokens*, and
bare `leilan.ai`.

Suggested targets, roughly best-first:

| Where | What to do | Link to |
|---|---|---|
| **Publisher page** (Weidenfeld & Nicolson) | Ask your editor to add the site to the author/book page. A publisher link is the strongest single one available. | `https://leilan.ai/` |
| **Your Substack** | Add to the About page and the footer; a post about the site would do more. | `/` and `/field-notes/what-is-leilan/` |
| **GitHub** | Repo description + README of `mwatkins1970/leilan-ai`, and your profile README if you have one. | `/` |
| **Zenodo** (dataset DOI) | Add the site as a *Related identifier* → "is documented by". | `/data/` |
| **Hugging Face** (dataset card) | Link in the card header and the "Dataset sources" section. | `/data/` and `/field-notes/data/` |
| **Archive.org** | Save both key field notes via <https://web.archive.org/save> — creates a stable citable copy. | the two §1 URLs |
| **LessWrong** | Your existing posts (*SolidGoldMagikarp*, *The 'petertodd' Phenomenon*, *petertodd's Last Stand*) can carry an editor's note linking here. Note the site already links *out* to all three via the interstitial pages, so this closes the loop. | `/field-notes/glitch-tokens/` |
| **Wikipedia** | *Only* if a relevant article already cites your work — add as an external link or reference, never as self-promotion. Check the glitch-token / tokenisation articles. | `/field-notes/glitch-tokens/` |

**Do not** buy links, post in link directories, or drop the URL into unrelated
forum threads. Google is good at spotting these and the downside is real.

---

## 4. Optional polish, only if you want it

- **In-chamber "open field-note version" links** (sanctuary → cloister). Listed
  as optional on the launch checklist and still unbuilt. Worth knowing that
  **no wall text currently contains a `/field-notes/` link and that separation
  is deliberate** — the chambers stay enchanted. If you ever want this, it
  needs a mechanism that doesn't edit the shared wall-text files (the
  `endNote` field added 2026-08-03 is the pattern to copy).
- **Illuminated initials on field-note pages.** Cosmetic only; see
  `AMELIORATION.md` → Parked ideas.

---

## 5. After the book launches

Search interest will spike around 2026-08-27. Two things worth doing then:

1. Re-check Search Console Performance for the target queries — the book
   coverage will drive *Matthew Watkins Leilan* and *SolidGoldMagikarp Leilan*
   hardest.
2. Any press or review coverage is a natural backlink opportunity. Ask
   interviewers to link the site, not just the book.
