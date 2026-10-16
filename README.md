# QWARDDLE v0.0.19

A tiny local-first 2D fighter prototype built with plain HTML, CSS, JavaScript, and Canvas 2D.

Open `index.html` directly. No npm, bundler, or local server is required.

## Current flow

MAIN MENU -> GAMEMODE -> SINGLEPLAYER CUSTOMIZATION -> ISLAND TEST MAP

Local and online multiplayer are still intentionally disabled.

## v0.0.19

This patch is the first real UI and sprite pass.

- Added the real revolver held sprite.
- Added the revolver cylinder HUD sprite.
- Added support for the six-color cylinder bullet-region mask.
- Added the normal and charged round HUD sprites.
- The revolver keeps geometry fallbacks if an image is missing or still loading.
- Reworked the main menu into a more compact, intentional grayscale layout.
- Reworked the gamemode screen so the three modes no longer occupy giant empty cards.
- Reworked customization with a clear header, smaller tabs, a dedicated loadout panel, and a larger preview area.
- Weapon cards now show their registry description.
- Grouped the revolver cylinder and ammunition into one compact in-game HUD block.
- Added `index.html` as the actual entry point.

## Customization

Current choices:

- Weapon: REVOLVER
- Color groups: CHEST, ARMS, LEGS

The arm color applies to both arm segments and the hand. The leg color applies to both complete legs and feet.

## Revolver

The revolver uses a six-slot ordered ammo chain rather than a single ammo number.

- 6-round capacity
- LMB fires the next round in the chain.
- Every shot spins the held revolver once. That spin is also the firing cooldown.
- Q performs a fast top-up reload and preserves existing charged rounds.
- E dumps the current cylinder and loads six charged rounds after a two-spin loading animation.
- Charged rounds deal more damage and knockback and apply intentionally huge recoil to the player body.
- Reloading with charged rounds remaining appends normal rounds after them rather than replacing them.

### Revolver sprite files

Located in `assets/sprites/revolver/`:

- `revolver.png`
- `revolver-cylinder.png`
- `revolver-cylinder-bullets.png`
- `revolver-round.png`
- `revolver-roundcharged.png`

The cylinder bullet mask uses these exact chamber colors:

- `#ff0000` = chamber 1
- `#ff00e2` = chamber 2
- `#0066ff` = chamber 3
- `#00ff59` = chamber 4
- `#ffef00` = chamber 5
- `#ff9200` = chamber 6

The game converts those colored regions into grayscale loaded-chamber overlays at runtime. If a browser prevents local canvas pixel reads, the base cylinder and separate ammunition sprites still render normally.

## Controls

- A / D or Left / Right: move
- W / Space / Up: jump
- Shift: run
- Mouse: aim
- LMB: revolver shot
- Q: top-up reload
- E: dump cylinder + load six charged rounds
- R: reset arena
- Esc: back

## Structure

- `assets/sprites/` art assets
- `src/player/` procedural body, leg, arm, and hand systems
- `src/combat/` weapon mount, revolver, projectiles, registry
- `src/game/` app/screens, camera, gameplay loop, customization
- `src/world/` island/terrain queries
- `src/input/` keyboard and pointer input
