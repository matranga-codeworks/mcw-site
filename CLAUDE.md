# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static brochure site for Frank Matranga / Matranga Codeworks LLC. Six hand-written
HTML pages, one stylesheet, two small scripts. **No build step, no dependencies, no
test suite, no package.json.** Deployed by pushing `main` to GitHub Pages
(`CNAME` + `.nojekyll` are the whole deploy config).

## Commands

```sh
python3 -m http.server 8000     # serve the repo root; open http://localhost:8000
```

There is nothing to build, lint, or install. `README.md` § **Verifying** holds three
copy-paste Python checks worth running before any push that touched markup:

1. every internal link and `#anchor` resolves
2. every JSON-LD block parses
3. the FAQ JSON-LD still matches the visible `<summary>` / `.faq__a` text on
   every page in that script's `FAQ_PAGES` list (`services.html`, `startups.html`)

## Architecture

Each page is standalone and duplicates the shared chrome — there is no include
mechanism. **A change to the masthead, nav, or footer must be repeated in all six
HTML files** (`index`, `about`, `services`, `work`, `startups`, `404`). Each nav
marks its own page with `aria-current="page"` — except `startups.html`, which is a
segment landing page and isn't in the nav, so nothing is marked there. Pages other
than `index.html` point their booking CTA at `index.html#consult`; services and
startups carry their own embed and use their own `#book`.

- `styles.css` — the entire design system, ~1150 lines in commented sections
  (`base`, `layout`, `masthead`, `typography`, `buttons`, `bands`, then per-component).
  Everything is driven by tokens in `:root`; six accent tokens at the top reskin the
  whole site.
- `site.js` — progressive enhancement only; every page must still read correctly with
  it blocked. Three behaviors: scroll reveal, image-slot fallback, self-updating
  dateline.
- `analytics.js` — PostHog, live (real project key). No cookies, no autocapture, no
  session recording; honors Do Not Track.

### Markup conventions the CSS and JS depend on

- **Section shape**: `<section>` → `<div class="wrap pad-*">` → content children.
  `site.js` staggers the *direct children of `.wrap`* on scroll into view, so
  wrapping content in an extra div collapses the animation to a single element.
  Hero sections opt out with `data-no-reveal` and animate on load via `.rise`.
- **`data-cta="…"`** on any element fires a `cta_click` event tagged with the page
  and enclosing `<section id>`. Instrumenting a new button needs no JS change — but
  the enclosing section needs an `id` for the breakdown to be useful.
- **`img[data-slot]`** degrades: if the file is missing, `site.js` removes the `<img>`
  and the parent frame shows its `data-placeholder` label instead of a broken icon.
  Several slots in `images/` are intentionally still empty.
- **`data-year` / `data-quarter`** are rewritten at runtime. Both ship a correct
  literal in the markup so JS-off readers see something sane — keep the literals
  current-ish when editing nearby copy.

## Invariants

Breaking any of these is a real regression, not a style nit.

- **Canonical host `https://matrangacode.works` is hard-coded** in `canonical` +
  `og:url` per page, plus `robots.txt` and `sitemap.xml`. Those are the only absolute
  URLs in the project; everything else is relative.
- **FAQ JSON-LD on `services.html` and `startups.html` must stay byte-identical to
  that page's visible `<summary>` / `.faq__a` copy.** Google treats a mismatch as
  cloaking. Check #3 above. A new FAQ page must be added to `FAQ_PAGES` there.
- **`startups.html` declares no `Service` JSON-LD.** The offers it describes are
  the ones `services.html` already defines canonically; duplicating the nodes would
  put two competing definitions of the same service in the graph. Prices quoted on
  startups are prose only, and must match services.
- **NAP data appears twice** — in the home page's `LocalBusiness` JSON-LD and in
  visible copy (phone, address, hours). Change both together, and keep them matching
  the Google Business Profile.
- **`--muted-2` is on-dark only** (2.94:1 on `--paper` — fails AA). On-paper quiet
  text uses `--muted`, already at the AA floor (4.59:1) — don't lighten it. On the
  hatch and feature-quote tints, `--muted` drops below the floor, so those step down
  to `--ink-3`.
- **`404.html` uses root-relative paths** (`/styles.css`) because GitHub Pages serves
  it from arbitrary URL depths. Every other page uses relative paths. This asymmetry
  is deliberate.
- **Testimonials are real client words only.** Don't write, embellish, or invent one.
- **Booking is the single primary CTA sitewide**; email and phone stay visibly
  secondary. Only the `calendar.google.com/calendar/appointments/schedules/…?gv=true`
  URL form is frameable — the `calendar.app.google/…` short link sends
  `X-Frame-Options: SAMEORIGIN` and renders an empty box.

Update `<lastmod>` in `sitemap.xml` when content changes materially.

`README.md` is the fuller reference — SEO/JSON-LD layout per page, analytics setup,
theme alternates, and the outstanding manual to-dos. `images/README.md` lists every
image slot, its crop, and the sign-off/data-scrubbing rules for client screenshots.
