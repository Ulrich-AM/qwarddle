# Revolver sprites

Drop the revolver sprite files in this folder.

Expected files:

- `revolver.png` - revolver sprite held by the player
- `revolver-cylinder.png` - revolver cylinder UI sprite
- `revolver-cylinder-bullets.png` - cylinder bullet occupancy mask
- `revolver-round.png` - normal round UI sprite
- `revolver-roundcharged.png` - charged round UI sprite

## Cylinder bullet mask colors

The `revolver-cylinder-bullets.png` sprite uses exact RGB colors to identify the six chamber regions:

- `#ff0000` = bullet 1
- `#ff00e2` = bullet 2
- `#0066ff` = bullet 3
- `#00ff59` = bullet 4
- `#ffef00` = bullet 5
- `#ff9200` = bullet 6

These colors are intended as masks/region identifiers, not final UI colors. The game can recolor occupied chambers at render time based on ammo type.
