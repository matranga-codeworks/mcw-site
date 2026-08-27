# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static brochure site for Frank Matranga / Matranga Codeworks LLC. Seven hand-written
HTML pages, one stylesheet, two small scripts. **No build step, no dependencies, no
test suite, no package.json.** Deployed by pushing `main` to **Cloudflare Pages**.

`CNAME` and `.nojekyll` are inert leftovers from the old GitHub Pages setup — the
domain is configured in the Cloudflare dashboard, not in this repo. Don't add
anything that depends on them.

## Commands

```sh
npx wrangler pages dev .        # accurate: extensionless URLs + _redirects, like production
python3 -m http.server 8000     # quick, but /organizations 404s — use /organizations.html
```

**Use Wrangler for anything involving navigation.** Every internal link is
root-relative and extensionless (`/organizations`, not `organizations.html`), so
the plain Python server can't resolve them — see **URLs** below.

There is nothing to build, lint, or install. `README.md` § **Verifying** holds
three copy-paste Python checks worth running before any push that touched markup:
link/anchor resolution (including a guard against `.html` suffixes leaking back
into the markup), JSON-LD parsing, and the FAQ byte-identity check.

## URLs

**Cloudflare Pages serves every page extensionless and 301s the `.html` form to
it.** `organizations.html` is served at `/organizations`; `work/index.html` at
`/work`. Every `canonical`, `og:url`, JSON-LD `@id`, `sitemap.xml` entry, and
internal link uses the extensionless, **root-relative** form (`/work`, `/styles.css`)
— never a relative path and never a `.html` suffix. A `.html` suffix anywhere in
the markup means an internal link that eats a redirect hop.

`_redirects` at the repo root holds real 301s, and only for paths whose file
moved or was deleted (`/services` → `/organizations`, `/work.html` → `/work`).
Cloudflare already handles `.html` → extensionless for files that still exist, so
adding rules for those would shadow the built-in handling for no gain.

## Architecture

Each page is standalone and duplicates the shared chrome — there is no include
mechanism. **A change to the masthead, nav, or footer must be repeated in all
seven HTML files** (`index`, `about`, `organizations`, `startups`, `work/index`,
`work/miirror-health`, `404`). Each nav marks its own page with
`aria-current="page"`; both `work` pages mark the `Work` item.

- `styles.css` — the entire design system, ~1150 lines in commented sections
  (`base`, `layout`, `masthead`, `typography`, `buttons`, `bands`, then per-component).
  Everything is driven by tokens in `:root`; six accent tokens at the top reskin the
  whole site.
- `site.js` — progressive enhancement only; every page must still read correctly with
  it blocked. Four behaviors: scroll reveal, image-slot fallback, self-updating
  dateline, and `[data-tip]` tooltips.
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
- **`data-tip="…"`** (optional `data-tip-value="…"` for a bold first line) gets a
  hover/tap/focus readout from `site.js`. Used by the home page's `#path` timeline;
  the values must also be readable without it — that figure's `<details>` table is
  the JS-off twin.
- **`data-year` / `data-quarter`** are rewritten at runtime. Both ship a correct
  literal in the markup so JS-off readers see something sane — keep the literals
  current-ish when editing nearby copy.

## Positioning

The site sells **custom software development**, headline-first. Two things follow
from that and are easy to undo by accident:

- **Never use "technical advisory," "technical consulting," "consultant," or
  "consulting" as a service category or headline descriptor** — they read as IT
  support to this market. The words are fine in body copy describing an activity
  (`startups.html` uses "an advisory retainer" in one FAQ answer). "Book a free
  consultation" is the sitewide CTA and is exempt — it names a free intro call.
- **No geographic qualifiers in company-level positioning.** No "Capital Region,"
  "Albany," "Upstate New York," or "518" in any hero, meta description, or service
  copy. MCW serves clients anywhere. The Capital Region material lives on
  `about.html` only, as Frank's personal identity, and is explicitly reconciled
  there ("I work with clients anywhere. I'm invested in Albany specifically").
  The `LocalBusiness` address and phone are NAP data, not positioning — they stay.
- Do not use the phrase **"small businesses"** anywhere.
- Do not create a **"Fractional CTO"** page or named offering. The phrase may
  appear once in body copy for search; the advisory retainer
  ($8,000–$12,000/month, capped days, defined response window) is described in a
  sentence on `startups.html`, never productized.

## Invariants

Breaking any of these is a real regression, not a style nit.

- **Two audience pages, two different engagement models.** `startups.html` sells
  four-week build cycles at $20,000 each; `organizations.html` sells a fixed-fee
  build starting at $35,000. Both open with the same $5,000, two-week **Definition**
  phase, and both use that word — never "Discovery." The prices on the two pages
  are *supposed* to differ; don't "fix" one to match the other.
- **A visitor must land on the page for their situation and see only that model.**
  The home page routes to them through the `#who` split and never lists the two
  price structures side by side. A nonprofit ED comparing cycle pricing to their
  own fixed fee is the failure this IA exists to prevent.
- **Both audience pages declare their own `Service` JSON-LD nodes**
  (`/startups#definition`, `#cycles`, `#support` and `/organizations#definition`,
  `#build`, `#support`), and the home page's `hasOfferCatalog` carries one
  `OfferCatalog` per audience referencing those `@id`s. These are genuinely
  different offers, so two definitions is correct here — but each offer must be
  defined in exactly one place. If you rename a stage, the `@id` is what has to
  stay put.
- **Canonical host `https://matrangacode.works` is hard-coded** in `canonical` +
  `og:url` per page, plus `robots.txt` and `sitemap.xml`. Those are the only
  absolute URLs in the project; everything else is root-relative.
- **FAQ JSON-LD on `organizations.html` and `startups.html` must stay
  byte-identical to that page's visible `<summary>` / `.faq__a` copy.** Google
  treats a mismatch as cloaking. A new FAQ page must be added to `FAQ_PAGES` in
  the checker in `README.md` § Verifying.
- **NAP data appears twice** — in the home page's `LocalBusiness` JSON-LD and in
  visible copy (phone, address, hours). Change both together, and keep them matching
  the Google Business Profile.
- **`--muted-2` is on-dark only** (2.94:1 on `--paper` — fails AA). On-paper quiet
  text uses `--muted`, already at the AA floor (4.59:1) — don't lighten it. On the
  hatch and feature-quote tints, `--muted` drops below the floor, so those step down
  to `--ink-3`.
- **Testimonials are real client words only.** Don't write, embellish, or invent one.
  `work/miirror-health.html` has a commented-out pull-quote slot waiting on Haley's
  approved wording — paste it verbatim or leave it commented.
- **`work/miirror-health.html` is written but deliberately unpublished.** It's
  held off the live site by a `noindex`, a 302 in `_redirects`, a commented-out
  `sitemap.xml` entry, and the removal of every link to it. Don't "fix" any of
  those as though they were mistakes, and don't link to the page — see
  `README.md` § **Held back** for the full restore checklist. The Miirror
  summaries on `/work` and `/startups` and the client-list entries stay live;
  only the long-form page is held.
- **Booking is the single primary CTA sitewide**; email and phone stay visibly
  secondary. Only the `calendar.google.com/calendar/appointments/schedules/…?gv=true`
  URL form is frameable — the `calendar.app.google/…` short link sends
  `X-Frame-Options: SAMEORIGIN` and renders an empty box. The embed lives at
  `/#consult`, `/organizations#book`, and `/startups#book`; other pages link to
  `/#consult`.

Update `<lastmod>` in `sitemap.xml` when content changes materially.

`README.md` is the fuller reference — SEO/JSON-LD layout per page, analytics setup,
theme alternates, and the outstanding manual to-dos. `images/README.md` lists every
image slot, its crop, and the sign-off/data-scrubbing rules for client screenshots.
