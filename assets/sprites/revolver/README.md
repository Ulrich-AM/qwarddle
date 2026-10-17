# Revolver HUD sprites

The held revolver sprite has been removed for now. The in-world gun uses temporary block geometry.

HUD files:

- `revolver-cylinder.png` - cylinder UI
- `revolver-cylinder-bullets.png` - six-color chamber source map
- `revolver-round.png` - normal round UI
- `revolver-roundcharged.png` - charged round UI

## Cylinder source-map colors

- `#ff0000` = chamber 1
- `#ff00e2` = chamber 2
- `#0066ff` = chamber 3
- `#00ff59` = chamber 4
- `#ffef00` = chamber 5
- `#ff9200` = chamber 6

Runtime chamber colors:

- NORMAL = `#aeb7c3`
- CHARGED = `#ff0000`

The `chambers/` directory contains transparent per-chamber masks derived from the source map so direct `file://` play does not depend on canvas pixel readback.
