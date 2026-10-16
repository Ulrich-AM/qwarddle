# QWARDDLE v0.0.18

A tiny local-first 2D fighter prototype built with plain HTML, CSS, JavaScript, and Canvas 2D.

Open `index.html` directly. No npm, bundler, or local server is required.

## Current flow

MAIN MENU → GAMEMODE → SINGLEPLAYER CUSTOMIZATION → ISLAND TEST MAP

Local and online multiplayer are still intentionally disabled.

## Customization

Everything is placeholder geometry so future sprites can replace it without changing gameplay logic.

Current choices:
- Weapon: REVOLVER
- Color groups: CHEST, ARMS, LEGS

The arm color applies to both arm segments + hand. The leg color applies to both complete legs + feet.

## Revolver

The revolver now uses a six-slot ordered ammo chain rather than a single ammo number.

- 6-round capacity
- LMB: fires the next round in the chain
- Every shot spins the held revolver placeholder exactly once; that spin is also the shot cooldown
- Q: fast top-up reload. Existing rounds stay in their current order and NORMAL rounds are appended until the cylinder reaches six
- Q still grants 15 temporary health for 5 seconds
- E: dumps the current cylinder, performs a two-spin charged reload, then loads 6 CHARGED rounds
- CHARGED rounds deal much more damage and knockback
- CHARGED rounds also apply intentionally huge recoil to the player body, allowing the shot to launch the player through the air
- Reloading while charged rounds remain does NOT discard them. Example: `C C C C` + Q becomes `C C C C N N`
- Held revolver remains only a large rectangle placeholder
- Projectile visuals remain only directional block placeholders

## Ammo HUD

- Large white square = placeholder cylinder sprite
- It advances 120 degrees per shot
- Six small squares to its right show the ordered ammo chain
- NORMAL rounds are small upright squares
- CHARGED rounds are slightly larger rotated squares/diamonds
- Q reload performs a short eased spin
- E charged reload performs exactly two eased revolver spins

## Controls

- A / D or Left / Right: move
- W / Space / Up: jump
- Shift: run
- Mouse: aim
- LMB: revolver shot
- Q: top-up reload / temporary health buff
- E: dump cylinder + load six charged rounds
- R: reset arena
- Esc: back to menu

## Structure

- `src/player/` procedural body, leg, arm, and hand systems
- `src/combat/` weapon mount, revolver, projectiles, registry
- `src/game/` app/screens, camera, gameplay loop, customization
- `src/world/` island/terrain queries
- `src/input/` keyboard and pointer input

The old F1 tuner/debug overlay remains removed from the game build.

## v0.0.18

- Regular reload shortened substantially.
- Revolver HUD cylinder placeholder enlarged.
- Held revolver placeholder enlarged into a wider rectangle.
- Every shot performs one eased full weapon spin and cannot fire again until the spin finishes.
- Revolver ammunition converted to an ordered six-slot ammo queue.
- E replaced Quick Draw with charged-cylinder loading.
- E dumps the current cylinder and loads six charged rounds after exactly two eased revolver spins.
- Charged rounds deal increased damage/knockback and impart extreme recoil to the player body.
- Q top-up preserves remaining charged rounds and appends normal rounds behind them.
- Charged rounds have a distinct placeholder HUD shape ready to be replaced by sprites later.
