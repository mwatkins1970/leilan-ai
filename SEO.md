# SEO.md — leilan.ai Search Console Audit and Follow-up

*Audience: coding agent working in `github.com/mwatkins1970/leilan-ai`.*

## Current Search Console status

Google Search Console currently reports:

- `Page with redirect`
- `Excluded by 'noindex' tag`
- `Redirect error`
- `Discovered — currently not indexed`
- `Crawled — currently not indexed: 0`

The newly reported `noindex` exclusions appear intentional. The examples are experiential routes or temporary navigation states, including:

```txt
/prism/main
/prism/main/
/prism/research-lab
/prism/research-lab/
/prism/gpt3-library
/prism/gpt3-library/
/prism/mythopoeic-archive
/prism/mythopoeic-archive/
/prism/ovs-chapel
/prism/ovs-chapel/
/immersive?from=...&dest=...
/immersive/?from=...&dest=...
/prism/ovs-chapel?wall=...&open=1
/prism/ovs-chapel/?wall=...&open=1
```

These are not intended as Google search landing pages. The field-note layer is the preferred indexable/search-facing layer.

## Intended indexing policy

### Deliberately `noindex`

These routes may intentionally carry:

```html
<meta name="robots" content="noindex,follow">
```

or equivalent:

```txt
/immersive
/immersive/*
/prism/*
```

This is correct. Do not remove `noindex` from experiential routes unless there is a compelling reason.

### Must remain indexable

These routes should not inherit `noindex`:

```txt
/
/field-notes/
/field-notes/*
/archive/
/data/
/transmission/*
/lesswrong-solidgoldmagikarp/
/lesswrong-petertodd-phenomenon/
/lesswrong-petertodd-last-stand/
```

Include any other substantive public text pages intended as search landing pages.

## Required audit

### 1. Audit robots directives

Search source and generated output for:

```txt
noindex
noindex,follow
X-Robots-Tag
<meta name="robots"
```

Inspect:

- Astro layouts
- page components
- shared head/SEO components
- middleware
- `netlify.toml`
- `_headers`
- `_redirects`
- generated HTML in `dist/`

Confirm:

```txt
[ ] `/immersive` and `/prism/*` are intentionally noindexed.
[ ] No important field-note, archive, data, transmission or homepage route is accidentally noindexed.
[ ] No global layout applies noindex indiscriminately.
[ ] No production `X-Robots-Tag: noindex` header is applied to indexable pages.
```

### 2. Audit sitemap contents

Confirm that no noindexed experiential URLs appear in the XML sitemap.

The sitemap should not include:

```txt
/immersive
/immersive?*
/prism/*
```

The sitemap should include final canonical versions of:

```txt
/
/field-notes/
/field-notes/*
/archive/
/data/
/transmission/*
```

Check that sitemap URLs:

- use `https://leilan.ai`
- do not use the Netlify subdomain
- use one consistent trailing-slash policy
- return `200`
- do not redirect
- are not `noindex`

### 3. Audit canonical tags

Confirm that indexable pages have self-referential canonical tags.

Examples:

```html
<link rel="canonical" href="https://leilan.ai/field-notes/glitch/">
<link rel="canonical" href="https://leilan.ai/data/">
```

Confirm:

```txt
[ ] Canonicals use `https://leilan.ai`.
[ ] No canonical points to the Netlify subdomain.
[ ] No field note canonicalizes to a prism page.
[ ] Sitemap URL, canonical URL, internal link and final `200` URL agree.
```

### 4. Audit trailing-slash consistency

Google has discovered both slash and non-slash forms for some pages.

Choose and enforce one final convention across:

```txt
/field-notes/*
/transmission/*
/archive
/data
/prism/*
```

The alternate form may redirect, but only the final form should appear in:

- sitemap
- canonical tags
- internal links
- Open Graph URLs
- structured data

Do not remove query parameters required for the interactive experience. They may remain noindexed.

### 5. Recheck the remaining redirect error

Earlier, Search Console reported this URL as `Redirect error`:

```txt
https://leilan.ai/field-notes/research-lab/glitch/
```

Search the repo and generated output for that exact path.

Confirm that it is:

- absent from the sitemap
- absent from internal links
- absent from canonical tags
- absent from structured data
- either removed entirely or redirected once to the correct current field-note page

Likely final destination:

```txt
/field-notes/glitch/
```

or:

```txt
/field-notes/glitch-tokens/
```

Choose based on content equivalence.

Expected obsolete-route behaviour:

```txt
301 or 308 → one final URL
```

Expected final-route behaviour:

```txt
200
self-referential canonical
indexable
```

No loops or multi-hop chains.

## Validation commands

Run:

```bash
npm run build
```

Then inspect generated output:

```bash
grep -RIn --exclude-dir=node_modules --exclude-dir=.git \
  -E "noindex|X-Robots-Tag|field-notes/research-lab/glitch" .

grep -RIn \
  -E "noindex|field-notes/research-lab/glitch" dist

grep -RIn \
  "/immersive\\|/prism/" dist/sitemap*
```

After deploying to Netlify, run representative live checks:

```bash
curl -sI https://leilan.ai/
curl -sI https://leilan.ai/field-notes/
curl -sI https://leilan.ai/data/
curl -sI https://leilan.ai/prism/main
curl -sI https://leilan.ai/immersive
```

Inspect HTML directives:

```bash
curl -s https://leilan.ai/field-notes/ \
  | grep -iE 'robots|canonical'

curl -s https://leilan.ai/prism/main \
  | grep -iE 'robots|canonical'

curl -s https://leilan.ai/data/ \
  | grep -iE 'robots|canonical'
```

Check the obsolete redirect:

```bash
curl -sSIL \
  https://leilan.ai/field-notes/research-lab/glitch/
```

Check sitemap:

```bash
curl -s https://leilan.ai/sitemap-index.xml
curl -s https://leilan.ai/sitemap-0.xml
```

Adapt filenames if the site uses `sitemap.xml` instead.

## Reporting requirements

Report back to the user with:

1. Which route groups currently receive `noindex`.
2. Confirmation that all 29 reported examples are intentional experiential routes, or a list of exceptions.
3. Whether any important indexable page accidentally inherited `noindex`.
4. Whether `/immersive` or `/prism/*` appears in the sitemap.
5. Whether sitemap, canonicals and internal links use consistent final URLs.
6. Whether trailing-slash inconsistencies were found and fixed.
7. Whether the old nested glitch URL still exists anywhere.
8. The live redirect result for the old glitch URL.
9. Confirmation that `npm run build` passes.
10. Confirmation that Netlify production deployment succeeds.
11. Any action the user must perform manually in Google Search Console.

## Manual Search Console actions for the user

Tell the user only about actions that remain necessary after deployment.

### Intentional `noindex` report

Do **not** tell the user to click `Validate fix` if the report contains only intentional experiential routes.

### Redirect error

If the old nested glitch URL has been fixed:

1. Open Search Console.
2. Open the `Redirect error` report.
3. Click `Validate fix`.

### Important final pages

Where useful, tell the user to inspect and request indexing for the final canonical page only, not obsolete redirecting URLs.

Possible examples:

```txt
https://leilan.ai/
https://leilan.ai/field-notes/
https://leilan.ai/field-notes/glitch/
https://leilan.ai/data/
```

Do not advise repeated mass indexing requests. The sitemap is the main bulk-discovery mechanism.

## Completion criteria

```txt
[ ] Intentional noindex policy confirmed.
[ ] No important indexable route accidentally noindexed.
[ ] No experiential route appears in sitemap.
[ ] Sitemap contains canonical 200 URLs only.
[ ] Canonical tags use https://leilan.ai.
[ ] Trailing-slash policy is consistent.
[ ] Obsolete nested glitch URL is absent from sitemap/internal links/canonicals.
[ ] Obsolete nested glitch URL redirects once to the correct final page.
[ ] Final destination returns 200 and is indexable.
[ ] npm run build succeeds.
[ ] Netlify production deploy succeeds.
[ ] User is told exactly what, if anything, to do manually in Search Console.
```
