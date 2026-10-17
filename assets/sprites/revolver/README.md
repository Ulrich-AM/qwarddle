# Revolver sprites

Revolver art lives in this folder.

Main files:

- `revolver.png` - revolver sprite held by the player
- `revolver-cylinder.png` - revolver cylinder UI sprite
- `revolver-cylinder-bullets.png` - six-color source map for chamber regions
- `revolver-round.png` - normal round UI sprite
- `revolver-roundcharged.png` - charged round UI sprite

## Cylinder source-map colors

`revolver-cylinder-bullets.png` uses these exact colors to identify each chamber:

- `#ff0000` = bullet 1
- `#ff00e2` = bullet 2
- `#0066ff` = bullet 3
- `#00ff59` = bullet 4
- `#ffef00` = bullet 5
- `#ff9200` = bullet 6

The runtime display colors are:

- NORMAL loaded chamber = `#aeb7c3`
- CHARGED loaded chamber = `#ff0000`

The `chambers/` directory contains transparent per-chamber masks derived from the source map. QWARDDLE uses those masks instead of reading pixels at runtime, so the cylinder works reliably when `index.html` is opened directly through `file://`.
