# Images

The design used placeholder image slots rather than real files, so nothing here
is committed yet. Each slot degrades to a hatched placeholder with a label until
you drop the matching file in — no broken-image icons.

| File                              | Where it appears                          | Notes |
| --------------------------------- | ----------------------------------------- | ----- |
| `signature.png`                    | About → end of "How I got here"            | Transparent PNG, rendered `object-fit: contain` at up to 300×100. |
| `event-good-neighbor-fund.png`     | About → Locally                            | 4:3 crop. Present. |
| `event-shaker-high-school.jpg`     | About → Locally                            | 4:3 crop. |
| `event-1-million-cups.jpg`         | About → Locally                            | 4:3 crop. |
| `frank-portrait.jpg`               | Home → hero (currently hidden)             | Tall portrait crop, ~3:4 or taller. |
| `frank-portrait-large.jpg`         | About → hero (currently hidden)            | Tall portrait crop, ~3:4 or taller. |
| `shot-candle-house.png`            | Services → Custom software development     | 16:10 crop, cropped from the top. Product screenshot. |
| `shot-preston-raffle.png`          | Services → Custom software development     | 16:10 crop, cropped from the top. Product screenshot. |

## Screenshots of delivered software

The two `shot-*.png` slots exist to make "I build it myself" concrete for a
buyer weighing $6,000. They follow the same degrade rule as everything else —
until the files exist, each shows a hatched frame with its label, never a broken
image. Two things worth doing before you add them:

- **Get the client's OK**, the same way the case studies are named with their
  blessing. If a screenshot can't be shown, delete the `<figure>` rather than
  substituting something generic.
- **Scrub the data.** Real donor names, real dollar amounts, and real patient
  data should not ship. Use seeded demo data or blur.

## Turning the hero portraits back on

Both hero portraits were switched off in the design's saved state, so the markup
carries a `hidden` attribute. To show one, drop in the image and delete `hidden`
from the `<figure class="portrait …">` element in `index.html` / `about.html`.
