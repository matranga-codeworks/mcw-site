# Matranga Codeworks — site

Static site for Frank Matranga / Matranga Codeworks LLC. Four pages, no build
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
| `404.html`      | Custom not-found page. GitHub Pages serves this automatically |
| `styles.css`    | The whole design system: tokens, layout, components |
| `site.js`       | Scroll reveal + image-slot fallback. Progressive enhancement — every page reads fine with JS off |
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

Update `<lastmod>` in `sitemap.xml` when the content changes materially.

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

- **Film grain is off.** Home and About had it explicitly disabled in the
  design's saved state; Services and Work still had it on. Rather than ship a
  site with texture on half its pages, it's off everywhere and kept behind a
  switch — add `data-grain` to `<body>` to turn it back on.
- **Hero portraits are hidden**, matching the same saved state. The markup is
  intact with a `hidden` attribute; see `images/README.md` to restore them.
- **Image slots degrade.** Each is an `<img>` over a hatched frame. If the file
  is missing, `site.js` drops the image and the frame shows its placeholder
  label instead of a broken-image icon.
- **Two fixes carried over from the design:** the About beliefs section pointed
  `aria-labelledby` at an id that didn't exist (its eyebrow is now a real
  heading), and the Home consultation button's hover offset was 1px off from
  every other button — they're consistent now.
- Added a skip link, `aria-current="page"` on the active nav item, and `<main>`
  landmarks. Otherwise the markup, copy, and measurements follow the design.

Fonts (Bricolage Grotesque, Spline Sans Mono) load from Google Fonts, as in the
design.
