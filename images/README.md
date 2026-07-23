# Images

The design used placeholder image slots rather than real files, so nothing here
is committed yet. Each slot degrades to a hatched placeholder with a label until
you drop the matching file in — no broken-image icons.

| File                              | Where it appears                          | Notes |
| --------------------------------- | ----------------------------------------- | ----- |
| `signature.png`                    | About → end of "How I got here"            | Transparent PNG, rendered `object-fit: contain` at up to 300×100. |
| `event-good-neighbor-fund.jpg`     | About → Locally                            | 4:3 crop. |
| `event-shaker-high-school.jpg`     | About → Locally                            | 4:3 crop. |
| `event-1-million-cups.jpg`         | About → Locally                            | 4:3 crop. |
| `frank-portrait.jpg`               | Home → hero (currently hidden)             | Tall portrait crop, ~3:4 or taller. |
| `frank-portrait-large.jpg`         | About → hero (currently hidden)            | Tall portrait crop, ~3:4 or taller. |

## Turning the hero portraits back on

Both hero portraits were switched off in the design's saved state, so the markup
carries a `hidden` attribute. To show one, drop in the image and delete `hidden`
from the `<figure class="portrait …">` element in `index.html` / `about.html`.
