# Character sprites

Drop the base character sprites in this folder.

Expected files:

- `body.png` - combined head/body sprite
  - `head-body.png` is also accepted as an alternate filename
- `hand.png` - floating hand sprite
- `foot.png` - shared foot sprite used for both feet

The arm and leg segments remain procedural. Their generated lines receive a dark outline so they visually connect to the pixel sprites.

The game keeps geometry fallbacks if any of these files are missing, so incomplete sprite work never prevents the prototype from running.
