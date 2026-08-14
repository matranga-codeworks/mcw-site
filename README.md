# Matranga Codeworks — site

Static site for Frank Matranga / Matranga Codeworks LLC. Seven pages, no build
step, no dependencies.

```sh
npx wrangler pages dev .     # accurate: extensionless URLs + _redirects, like production
python3 -m http.server 8000  # quick, but /organizations 404s — use /organizations.html
```

Prefer the first. Because every internal link is root-relative and extensionless
(`/organizations`, not `organizations.html`), the plain Python server can't
resolve navigation — only Wrangler reproduces what Cloudflare actually serves,
including `_redirects`.

## Files

| File            | What it is |
| --------------- | ---------- |
| `index.html`    | Home — hero, differentiator, the two-audience split, one case study teaser, booking, contact |
| `startups.html` | Engagement model for funded founders: Definition, then four-week build cycles. Own booking embed, own FAQ |
| `organizations.html` | Engagement model for nonprofits, associations, and established organizations: Definition, then a fixed-fee build. Own booking embed, own FAQ |
| `work/index.html` | Work — three case studies, Miirror Health first as the primary proof asset |
| `work/miirror-health.html` | The Miirror Health case study in full. **On hold — not published.** See **Held back** below |
| `about.html`    | About — background, beliefs, locally + event photos. The only page that carries the Capital Region material — it's who Frank is, not who MCW serves |
| `404.html`      | Custom not-found page. Cloudflare Pages serves this automatically |
| `_redirects`    | Cloudflare Pages 301s. Only for paths whose file moved or was deleted |
| `styles.css`    | The whole design system: tokens, layout, components |
| `site.js`       | Scroll reveal, image-slot fallback, self-updating dateline. Progressive enhancement — every page reads fine with JS off |
| `analytics.js`  | PostHog. Live — see **Analytics** below |
| `images/`       | `og.png` (social card) plus drop-in photos. See `images/README.md` |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | Site icons — a geometric "F" drawn as rects, so it never depends on a font |
| `robots.txt`, `sitemap.xml` | Crawler directives. Both hard-code the canonical domain |
| `CNAME`, `.nojekyll` | Inert leftovers from the old GitHub Pages setup. Harmless; don't build on them |

## Deployment and URLs

The site is deployed by **Cloudflare Pages** from `main`. The custom domain is
configured in the Cloudflare dashboard, not in this repo.

Cloudflare serves every page **extensionless** and redirects the `.html` form to
it. So `organizations.html` is served at `/organizations`, and `work/index.html`
at `/work`. Everything in the markup — canonicals, `og:url`, JSON-LD `@id`s,
sitemap entries, internal links, asset paths — uses the extensionless,
**root-relative** form:

```html
<a href="/work">Work</a>              <!-- not work.html, not ../work.html -->
<link rel="stylesheet" href="/styles.css">
```

A `.html` suffix anywhere in the markup means an internal link that eats a
redirect hop. There's a checker for this; see **Verifying**.

`_redirects` holds real 301s and covers only what actually broke:

```
/services       /organizations   301
/services.html  /organizations   301
/work.html      /work            301
```

Files that still exist don't need a rule — Cloudflare's built-in `.html`
stripping already handles them, and a rule would shadow it for no gain.

### Domains

`matrangacodeworks.com` 301-redirects to `matrangacode.works` at the registrar,
so authority isn't split and nothing needs doing in this repo. Worth re-checking
if DNS ever moves:

```
curl -sIL matrangacodeworks.com | grep -i '^location'
```

## Positioning

The site sells custom software development, headline-first, through two
audience-specific engagement models. Two rules are easy to break by accident:

- **"Technical advisory," "technical consulting," "consultant," and "consulting"
  are banned as service categories or headline descriptors** — they read as IT
  support to this market. Fine in body copy describing an activity. "Book a free
  consultation" is exempt; it names a free intro call, and it's the sitewide CTA.
- **No geography in company-level positioning** — no "Capital Region," "Albany,"
  "Upstate New York," or "518" in any hero, meta description, or service copy.
  The Capital Region material lives on `about.html` only, as Frank's personal
  identity, explicitly reconciled there: *"I work with clients anywhere. I'm
  invested in Albany specifically."* The `LocalBusiness` address and phone are NAP
  data, not positioning — they stay.

Also: never the phrase "small businesses"; never a "Fractional CTO" page or named
offering (the phrase appears once in a `startups.html` FAQ answer, for search).

### The two models

| | `/startups` | `/organizations` |
| --- | --- | --- |
| Stage 1 | **Definition** — $5,000, two weeks | **Definition** — $5,000, two weeks |
| Deliverable | Spec, prioritized backlog, cycle estimate | Spec, implementation plan, **fixed build price** |
| Stage 2 | **Build cycles** — $20,000 each, four weeks, one client at a time, paid in advance | **Build** — fixed fee, 35% / 30% / 35%, from $35,000 (typical $45,000–$60,000) |
| Stage 3 | Retainer $2,500–$4,000/mo · ad-hoc $200/hr | Retainer $2,500–$4,000/mo · ad-hoc $200/hr |

Both pages use the word **Definition**, never "Discovery." The prices differ on
purpose — don't reconcile them.

**The home page never lists the two structures side by side.** It routes readers
to one or the other through the `#who` split. A nonprofit ED comparing cycle
pricing to their own fixed fee is the failure this IA exists to prevent.

## SEO

Canonical host is **`https://matrangacode.works`**, hard-coded in four places
per page (`canonical`, `og:url`, plus `robots.txt` and `sitemap.xml`). If the
domain ever changes, those are the only absolute URLs in the project.

Each page carries a full Open Graph block, a canonical link, and JSON-LD:

- **Home** — `ProfessionalService` + `Person` + `WebSite`, the shared entities
  the other pages reference by `@id`
- **Startups** — `WebPage` with an `audience` node, its own `FAQPage`, and its own
  three `Service` nodes (`#definition`, `#cycles`, `#support`)
- **Organizations** — same shape, with `#definition`, `#build`, `#support`
- **Work** — `CollectionPage` with an `ItemList` of the three case studies
- **Miirror Health** — `WebPage` + the `CreativeWork` the work index points at
- **About** — `AboutPage` + the detailed `Person`

Every page except Home also carries a `BreadcrumbList`. The final `ListItem`
intentionally has no `item` — Google's spec wants the current page unlinked.

The home page's business node carries `hasOfferCatalog` as **two** `OfferCatalog`
nodes, one per audience, each referencing that page's `Service` `@id`s. That's
what keeps one definition of each offer in the graph. The two Definition services
are separate nodes on purpose: same price, different deliverable. If you rename a
stage, the `@id` is what has to stay put.

The business node is typed `["ProfessionalService", "LocalBusiness"]` and carries
the full NAP set — name, address, `telephone`, `geo`, and
`openingHoursSpecification` — because local search and Google Business Profile
both want the site to agree with the profile exactly. If you change the phone
number or hours anywhere, change them in **both** places.

Startups and Organizations each carry a `FAQPage` node. **Its `text` must stay
byte-identical to that page's visible `<summary>` / `.faq__a` copy** — Google
treats a mismatch as cloaking. If you add an FAQ to a third page, add it to
`FAQ_PAGES` in the checker below.

Update `<lastmod>` in `sitemap.xml` when the content changes materially.

## Analytics

`analytics.js` loads PostHog and is live. It's deliberately minimal: no cookies
(`persistence: 'localStorage'`), no session recording, no autocapture. That keeps
it out of cookie-banner territory while still giving referrer and UTM data on
every pageview, which is how you answer "where did that booking come from".
`navigator.doNotTrack` is honoured.

Conversion tracking is declarative. Any element with `data-cta="…"` fires a
`cta_click` event carrying the page and section it lives in, so you can break
down booking-vs-email without defining goals in the UI. To instrument a new
button, just add the attribute — no JS change:

```html
<a class="btn" href="#consult" data-cta="book-somewhere">Book a free consultation →</a>
```

## Conversion & proof

- **Testimonials** (`.quote`) appear on Home, Organizations, and inline on the
  Preston case study. **Real client words only** — the live quote was recovered
  from the previous site. Add one by copying a `<figure class="quote">` block; the
  grid reflows on its own and needs no CSS.
- **One primary CTA.** Booking is the single primary action sitewide; email and
  phone are always visibly secondary. The Google scheduler is embedded inline at
  `/#consult`, `/organizations#book`, and `/startups#book`. Each audience page
  gets its own embed rather than linking home on purpose — someone ready to book
  shouldn't be bounced to a different page to do it.
  - Gotcha: only the `calendar.google.com/calendar/appointments/schedules/…?gv=true`
    form is frameable. The `calendar.app.google/…` short link sends
    `X-Frame-Options: SAMEORIGIN` and renders an empty box. Each embed has a
    visible "open in a new tab" fallback beneath it.
- **Segment router.** The `#who` cards on the home page are `<a class="route">`
  links, one per audience, pointing at that reader's engagement model. Each
  carries `data-cta="who-…"`, so PostHog reports which segment actually clicks —
  that's the signal for whether any other segment deserves its own page.
- **FAQ** lives on both audience pages, tuned to each: Organizations answers the
  board-and-budget questions, Startups answers the founder-specific ones — equity,
  IP ownership at diligence time, why a cycle is paid in advance, and what happens
  at the first in-house hire.

## Dating

Nothing is hard-coded to a year, so the site can't go stale on its own:

- `<span data-year>` — the footer copyright, set to the current year.
- `<span data-quarter>` — the "taking new clients for Qn YYYY" status. Rolls to
  the next quarter automatically once the current one is within 21 days of
  ending, so it never advertises a quarter that's nearly over.

Both ship a correct literal in the markup, so with JS blocked they read fine —
they just stop advancing.

## Accessibility

All text meets WCAG AA (4.5:1 for body copy, 3:1 for large). Two rules the
tokens depend on — breaking either reintroduces a failure:

- **`--muted-2` is on-dark only.** It's 4.77:1 on `--ink` but only 2.94:1 on
  `--paper`. On-paper quiet text uses `--muted`, which is the lightest warm gray
  that still clears 4.5:1 on paper (4.59:1). Don't lighten `--muted`.
- **Tinted grounds cost about 0.6:1.** On the hatch and on the feature-quote
  tint, `--muted` drops below the floor, so those two spots step down to
  `--ink-3`.

## Verifying

No build step and no test suite, so checks are scripts you run by hand from the
repo root. Worth doing before any push that touched markup:

```sh
python3 -m http.server 8000        # then open http://localhost:8000

# 1. every internal link, asset, and #anchor resolves — and no .html suffixes leak
python3 - <<'PY'
import re, glob, os
pages = {f: open(f, encoding='utf-8').read() for f in glob.glob('*.html') + glob.glob('work/*.html')}
ids   = {f: set(re.findall(r'\bid="([^"]+)"', s)) for f, s in pages.items()}
def resolve(p):
    p = p.strip('/')
    if p == '': return 'index.html'
    if os.path.isfile(p): return p                       # asset served as-is
    for c in (p + '.html', p + '/index.html'):
        if os.path.isfile(c): return c
    return None
bad = 0
for f, s in sorted(pages.items()):
    body = re.sub(r'<!--.*?-->', '', s, flags=re.S)      # skip commented-out slots
    for attr in ('href', 'src'):
        for url in re.findall(rf'{attr}="([^"]+)"', body):
            if url.startswith(('http', 'mailto:', 'tel:', 'data:')): continue
            if re.match(r'^/.*\.html($|#)', url):
                bad += 1; print(f'FAIL {f}: {url} -> .html suffix, use the extensionless URL')
            page, _, frag = url.partition('#')
            tgt = f if page == '' else resolve(page)
            if tgt is None:
                bad += 1; print(f'FAIL {f}: {attr}="{url}" -> no file'); continue
            if frag and frag not in ids.get(tgt, set()):
                bad += 1; print(f'FAIL {f}: {attr}="{url}" -> #{frag} not in {tgt}')
print(f'{bad} broken')
PY

# 2. every JSON-LD block parses
python3 -c "
import re, json, glob
for f in sorted(glob.glob('*.html') + glob.glob('work/*.html')):
    for i, b in enumerate(re.findall(r'<script type=\"application/ld\+json\">(.*?)</script>', open(f, encoding='utf-8').read(), re.S)):
        try: json.loads(b); print('ok  ', f, i)
        except Exception as e: print('FAIL', f, i, e)"

# 3. FAQ JSON-LD still matches the visible questions and answers
python3 - <<'PY'
import re, json, html
FAQ_PAGES = ['organizations.html', 'startups.html']
strip = lambda t: html.unescape(re.sub(r'<[^>]+>', '', t)).strip()
for f in FAQ_PAGES:
    s = open(f, encoding='utf-8').read()
    d = json.loads(re.findall(r'<script type="application/ld\+json">(.*?)</script>', s, re.S)[0])
    faq = [n for n in d['@graph'] if n['@type'] == 'FAQPage'][0]['mainEntity']
    ld_q = [q['name'] for q in faq]
    ld_a = [q['acceptedAnswer']['text'] for q in faq]
    vis_q = [strip(x) for x in re.findall(r'<summary>(.*?)</summary>', s, re.S)]
    # answers: one <details> may hold several .faq__a paragraphs — join them
    vis_a = [' '.join(strip(p) for p in re.findall(r'<p class="faq__a">(.*?)</p>', block, re.S))
             for block in re.findall(r'<details>(.*?)</details>', s, re.S)]
    ok = ld_q == vis_q and ld_a == vis_a
    print('MATCH' if ok else 'MISMATCH', f, len(ld_q), 'questions')
    for i, (a, b) in enumerate(zip(ld_q, vis_q)):
        if a != b: print(f'  Q{i} ld={a!r} vis={b!r}')
    for i, (a, b) in enumerate(zip(ld_a, vis_a)):
        if a != b: print(f'  A{i} ld={a!r}\n     vis={b!r}')
PY
```

## Held back

**`work/miirror-health.html` is written but not published.** The file is in the
repo and renders fine locally; it is kept off the live site by four things, and
bringing it live means undoing all four:

1. `<meta name="robots" content="noindex, nofollow">` in its `<head>`
2. the `/work/miirror-health /work 302` rule in `_redirects` (a 302, not a 301,
   so nothing caches the hold as permanent)
3. its `<url>` block in `sitemap.xml`, commented out
4. the links that pointed at it:
   - `index.html` — the Miirror proof card is commented out; Candle House is
     carrying `card--feature` in its place. Restoring means uncommenting the
     Miirror card and dropping `card--feature` from the Candle House card.
   - `work/index.html` — the "Read the full case study →" link in Case Study 01's
     `.case__related`, and the `url` / `@id` keys on its `ItemList` entry
   - `startups.html` — "The full case study →" in the `#case` `.case__related`,
     currently pointing at `/work` instead

The Miirror **summaries** on `/work` and `/startups`, and the client-list entries,
are deliberately still live — only the long-form page is held.

Before it goes live it also needs Haley's approved pull quote, pasted into the
commented `<figure class="quote">` slot at the bottom of the page. **Real client
words only** — don't paraphrase.

## Still on you

Things that can't be done from this repo:

- [ ] Regenerate `images/og.png` — the social card still carries the old
      advisory tagline, and every page's `og:image:alt` now describes the new
      positioning instead.
- [ ] Confirm the Google Business Profile still matches the NAP data in the home
      page's `LocalBusiness` block.
- [ ] Collect 1–3 more testimonials (Candle House, Miirror, Inside Outside
      Health) — there's a commented slot ready on the home page.
- [ ] Decide whether the retainer and hourly numbers stay published. They
      currently are, on both audience pages.

## Theme

The design carried an accent switcher with four palettes; **Pine** was the
default and is what's baked in. Everything reads from six tokens at the top of
`styles.css`, so reskinning is a six-line change — the alternates (Petrol,
Indigo, Oxblood) are listed in a comment right there.

```css
--acc: #2E5D46;  --acc2: #234838;  --acc3: #6FB894;
--acc-b: #C7794E;  --acc-b-ink: #1A1917;
```

## Notes on the conversion

The source pages were Claude Design components (`x-dc`, `{{prop}}` templates,
`style-hover` / `style-before` attributes, `x-import` image slots) — none of
which is real HTML. Converting meant resolving the props to Pine's values and
turning the per-element inline styles into a shared stylesheet. A few decisions
worth knowing about:

- **Hero portraits are hidden**, matching the same saved state. The markup is
  intact inside a comment; see `images/README.md` to restore them.
- **Image slots degrade.** Each is an `<img>` over a hatched frame. If the file
  is missing, `site.js` drops the image and the frame shows its placeholder
  label instead of a broken-image icon.

Fonts (Bricolage Grotesque, Spline Sans Mono) were downloaded from Google Fonts
and are hosted locally in `fonts/`.
