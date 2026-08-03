# Matranga Codeworks — site

Static site for Frank Matranga / Matranga Codeworks LLC. Five pages, no build
step, no dependencies. Open `index.html` or serve the directory with anything.

```
python3 -m http.server 8000
```

## Files

| File            | What it is |
| --------------- | ---------- |
| `index.html`    | Home — hero, pull quote, consultation, who it's for, why me, assessment, services ledger, work, locally, contact |
| `about.html`    | About — background, beliefs, locally + event photos |
| `services.html` | Services & pricing — assessment, two advisory tiers, custom software |
| `work.html`     | Work — three case studies |
| `startups.html` | Segment landing page for early-stage founders — own hero, own booking embed, own FAQ. Reframes the same three offers (build / assessment / advisory) build-first instead of assessment-first |
| `404.html`      | Custom not-found page. GitHub Pages serves this automatically |
| `styles.css`    | The whole design system: tokens, layout, components |
| `site.js`       | Scroll reveal, image-slot fallback, self-updating dateline. Progressive enhancement — every page reads fine with JS off |
| `analytics.js`  | PostHog. Inert until you paste a project key — see **Analytics** below |
| `images/`       | `og.png` (social card) plus drop-in photos. See `images/README.md` |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | Site icons — a geometric "F" drawn as rects, so it never depends on a font |
| `robots.txt`, `sitemap.xml` | Crawler directives. Both hard-code the canonical domain |

## SEO

Canonical host is **`https://matrangacode.works`**, hard-coded in four places
per page (`canonical`, `og:url`, plus `robots.txt` and `sitemap.xml`). If the
domain ever changes, those are the only absolute URLs in the project —
everything else is relative and path-agnostic.

Each page carries a full Open Graph block, a canonical link, and JSON-LD:

- **Home** — `ProfessionalService` + `Person` + `WebSite`, the shared entities
  the other pages reference by `@id`
- **About** — `AboutPage` + the detailed `Person`
- **Services** — one `Service` per offering, with the real prices as
  `PriceSpecification` / `UnitPriceSpecification`
- **Work** — `CollectionPage` with an `ItemList` of the three case studies
- **Startups** — `WebPage` with an `audience` node, plus its own `FAQPage`. It
  deliberately declares no `Service` nodes: the offers are the same ones
  Services already describes, and duplicating them would compete with the
  canonical definitions there

The home page's business node is typed `["ProfessionalService", "LocalBusiness"]`
and carries the full NAP set — name, address, `telephone`, `geo`, and
`openingHoursSpecification` — because local search and Google Business Profile
both want the site to agree with the profile exactly. If you change the phone
number or hours anywhere, change them in **both** places.

Services and Startups each carry a `FAQPage` node. **Its `text` must stay
byte-identical to that page's visible `<summary>` / `.faq__a` copy** — Google
treats a mismatch as cloaking. There's a checker for this; see **Verifying**
below. If you add an FAQ to a third page, add it to `FAQ_PAGES` in that script.

Update `<lastmod>` in `sitemap.xml` when the content changes materially.

### Domains

`matrangacodeworks.com` already 301-redirects to `matrangacode.works` at the
registrar, so authority isn't split and nothing needs doing in this repo. Worth
re-checking if DNS ever moves:

```
curl -sIL matrangacodeworks.com | grep -i '^location'
```

`CNAME` holds the canonical host and GitHub Pages only accepts one, so the
redirect has to live upstream — don't try to solve it here.

## Analytics

`analytics.js` loads PostHog and is **inert until configured** — with the
placeholder key in place it makes no network request at all, so it's safe to
ship as-is. To turn it on, open the file and set `PROJECT_KEY` (and `HOST`, if
you're on EU cloud).

It's deliberately minimal: no cookies (`persistence: 'localStorage'`), no
session recording, no autocapture. That keeps it out of cookie-banner territory
while still giving you referrer and UTM data on every pageview, which is how you
answer "where did that booking come from". `navigator.doNotTrack` is honoured.

Conversion tracking is declarative. Any element with `data-cta="…"` fires a
`cta_click` event carrying the page and section it lives in, so you can break
down booking-vs-email without defining goals in the UI. To instrument a new
button, just add the attribute — no JS change:

```html
<a class="btn" href="#consult" data-cta="book-somewhere">Book a free consultation →</a>
```

## Conversion & proof

- **Testimonials** (`.quote`) appear on Home, Services, and inline on the
  Preston case study. **Real client words only** — both live quotes were
  recovered from the previous site. Add one by copying a `<figure class="quote">`
  block; the grid reflows on its own and needs no CSS.
- **One primary CTA.** Booking is the single primary action sitewide; email and
  phone are always visibly secondary. The Google scheduler is embedded inline at
  `index.html#consult`, `services.html#book`, and `startups.html#book`. Startups
  gets its own embed rather than linking home on purpose — a founder sent to
  `index.html` to book lands on "the software person for organizations that
  don't have one," which is the wrong first sentence for them.
  - Gotcha: only the `calendar.google.com/calendar/appointments/schedules/…?gv=true`
    form is frameable. The `calendar.app.google/…` short link sends
    `X-Frame-Options: SAMEORIGIN` and renders an empty box. Each embed has a
    visible "open in a new tab" fallback beneath it.
- **Segment router.** The `#who` cards on the home page are `<a class="route">`
  links, one per segment, each pointing at whatever that reader should see next
  (nonprofits → Work, associations → Advisory, mid-market → the assessment,
  startups → `startups.html`). Each carries `data-cta="who-…"`, so PostHog
  reports which segment actually clicks — that's the signal for whether any
  other segment deserves its own page. Add a segment by copying one `<a>`; the
  grid reflows and needs no CSS.
- **FAQ** lives on Services, where it de-risks the $6,000 decision, and on
  Startups, where it answers the founder-specific questions instead — equity,
  IP ownership at diligence time, and what happens at the first in-house hire.
- **Screenshot slots** in Services → Custom software are empty placeholders
  until you add files. See `images/README.md` — get client sign-off and scrub
  real donor/patient data first.

## Dating

Nothing is hard-coded to a year any more, so the site can't go stale on its own:

- `<span data-year>` — the footer copyright, set to the current year.
- `<span data-quarter>` — the "taking new clients for Qn YYYY" status. Rolls to
  the next quarter automatically once the current one is within 21 days of
  ending, so it never advertises a quarter that's nearly over.

Both ship a correct literal in the markup, so with JS blocked they read fine —
they just stop advancing. This replaces the calendar reminder you'd otherwise
need.

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

# every internal link and #anchor resolves
python3 - <<'PY'
import re, glob, os
pages = {f: open(f, encoding='utf-8').read() for f in glob.glob('*.html')}
ids = {f: set(re.findall(r'\bid="([^"]+)"', s)) for f, s in pages.items()}
bad = 0
for f, s in sorted(pages.items()):
    for href in re.findall(r'href="([^"]+)"', s):
        if href.startswith(('http', 'mailto:', 'tel:')): continue
        page, _, frag = href.partition('#')
        tgt = f if page in ('', '/') else page.lstrip('/')
        if tgt and not os.path.exists(tgt):
            bad += 1; print(f'FAIL {f}: {href} -> missing file')
        elif frag and frag not in ids.get(tgt, set()):
            bad += 1; print(f'FAIL {f}: {href} -> #{frag} not in {tgt}')
print(f'{bad} broken')
PY

# every JSON-LD block parses
python3 -c "
import re, json, glob
for f in sorted(glob.glob('*.html')):
    for i, b in enumerate(re.findall(r'<script type=\"application/ld\+json\">(.*?)</script>', open(f, encoding='utf-8').read(), re.S)):
        try: json.loads(b); print('ok  ', f, i)
        except Exception as e: print('FAIL', f, i, e)"

# FAQ JSON-LD still matches the visible questions and answers
python3 - <<'PY'
import re, json, html
FAQ_PAGES = ['services.html', 'startups.html']
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

## Still on you

Things that can't be done from this repo:

- [ ] Collect 1–3 more testimonials (Candle House, Miirror, Inside Outside
      Health) — there's a commented slot ready on the home page.

One deliberate inconsistency: `404.html` uses **root-relative** paths
(`/styles.css`) because it can be served from any URL depth. Every other page
uses relative paths.

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
  intact with a `hidden` attribute; see `images/README.md` to restore them.
- **Image slots degrade.** Each is an `<img>` over a hatched frame. If the file
  is missing, `site.js` drops the image and the frame shows its placeholder
  label instead of a broken-image icon.

Fonts (Bricolage Grotesque, Spline Sans Mono) load from Google Fonts, as in the
design.
