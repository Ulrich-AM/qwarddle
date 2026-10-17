# QWARDDLE v0.0.20

A local-first 2D fighter prototype built with plain HTML, CSS, JavaScript, and Canvas 2D.

Open `index.html` directly. No npm, bundler, or local server is required.

## Current flow

MAIN MENU -> SOLO -> MAP -> CUSTOMIZE -> FIGHT

Local and online multiplayer remain disabled for now.

## v0.0.20

This patch moves QWARDDLE from one hard-coded island toward reusable match maps.

- Maps are made from axis-aligned rectangles.
- Touching or overlapping map rectangles render as one merged outlined silhouette.
- Added a map-selection screen before customization.
- Added two starter rectangle maps in `src/world/MapRegistry.js`.
- Spawn points now come from the selected map.
- The old hand-coded sloped island was removed.
- The held revolver PNG was removed for now and replaced with a blocky placeholder.
- Body sprites render without rotation, use snapped coordinates, and disable smoothing for sharper pixel art.
- Arm and leg outlines are thicker and overlap their joints.
- Hands and feet are generated pixel circles whose outlines merge into the limb silhouette.
- The standalone map editor exports the same rectangle/spawn JSON shape used by the runtime map registry.

## Map format

Map definitions use this shape:

```json
{
  "version": 1,
  "id": "my-map",
  "name": "MY MAP",
  "width": 2200,
  "height": 980,
  "waterY": 760,
  "background": "#242a30",
  "groundColor": "#596057",
  "outlineColor": "#202020",
  "outlineSize": 10,
  "spawns": [
    { "x": 560, "y": 500 },
    { "x": 1640, "y": 500 }
  ],
  "rectangles": [
    { "x": 300, "y": 560, "w": 1600, "h": 180 }
  ]
}
```

Rectangle collision currently uses flat top surfaces. Visual rectangles may touch or overlap freely.

## Customization

Current choices:

- Weapon: REVOLVER
- Color groups: BODY, ARMS, LEGS

The body uses `qward-body.png` plus `qward-body-color.png`. Generated limbs, hands, and feet use the selected group colors.

## Revolver

The revolver still uses a six-slot ordered ammo chain.

- LMB fires the next round.
- Each shot performs the revolver spin/cooldown.
- Q fills empty chambers with normal rounds without replacing charged rounds.
- E dumps the cylinder and loads six charged rounds.
- Charged rounds deal more damage and produce extreme recoil.

The held weapon is temporary geometry for now. Cylinder and ammo HUD sprites remain active.

## Language files

English text lives in `assets/language/language-english.json`.

Additional languages can follow the same structure. The built-in English fallback preserves direct `file://` launching.

## Controls

- A / D or Left / Right: move
- W / Space / Up: jump
- Shift: run
- Mouse: aim
- LMB: fire
- Q: reload
- E: charged load
- R: reset arena
- Esc: back
