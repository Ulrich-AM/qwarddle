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
- The map registry uses the exported ENCLOSED, PLATFORM, SUNKEN, and CASTLE maps at roughly 1.25x their original dimensions. PLATFORM and CASTLE geometry were recentered to remove small left-right asymmetries. Map outline thickness remains 10 px.
- Spawn points now come from the selected map.
- The old hand-coded sloped island was removed.
- The held revolver sprite is active again.
- Body sprites render without rotation, use snapped coordinates, and disable smoothing for sharper pixel art.
- Arm and leg outlines are thicker and overlap their joints.
- Procedural feet have a hard reach cap so the legs cannot stretch beyond the two-bone chain.
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

Map rectangles are full solid collision geometry for the player's standing body. Sides block horizontal movement, tops catch falls, and undersides catch jumps. A depenetration pass also ejects characters that somehow begin a frame overlapping a block, preventing them from walking around inside solids. Visual rectangles may touch or overlap freely.

## Current maps

- ENCLOSED
- PLATFORM
- SUNKEN
- CASTLE

The old TRAINING BLOCKS and SPLIT LEVELS maps have been removed.

## Sprite staging areas

Future art can be placed in:

- `assets/sprites/dagger/`
- `assets/sprites/flail/`
- `assets/sprites/hats/`

These are asset staging areas only. Their gameplay/cosmetic systems are not registered yet. Sake is now an active weapon rather than a staging-only folder.

## Customization

Current choices:

- Weapons: REVOLVER, WAND, SAKE, DAGGER
- Color groups: BODY, ARMS, LEGS

The body uses `qward-body.png` plus `qward-body-color.png`. Generated limbs, hands, and feet use the selected group colors.

## Revolver

The revolver still uses a six-slot ordered ammo chain.

- LMB fires the next round.
- Each shot performs the revolver spin/cooldown.
- Q fills empty chambers with normal rounds without replacing charged rounds and grants 15 temporary health plus 25% damage reduction for 1 second.
- E requires full charge, consumes it, dumps the cylinder, and loads six charged rounds.
- Charged rounds deal more damage and produce extreme recoil.

The held revolver sprite remains active. The separate `revolver-cylinder.png` sprite has been removed. Revolver projectiles are outlined circles, with different colors for normal and charged rounds.

## Wand

- LMB: larger spinning star, low damage, phases through map solids.
- Q: three larger lightly-homing stars that fade after about three seconds.
- E: requires full charge, then fires a large pass-through star with one angle-based ricochet and a twelve-star radial burst on the next wall impact.

## Sake

- LMB, Drink: 5 second cooldown. Pulls the gourd toward the mouth and tips it.
- Each Drink fills one of 8 drunk-meter slots and gives one equal 1/3 result: +25% melee damage for 5 seconds, 25% damage reduction for 5 seconds, or 8 health regenerated over 5 seconds.
- Filling all 8 slots automatically enters the 15 second drunk state and resets the meter.
- Q during the 5 second mouthful window, Sake Spit: randomized fading droplets emitted from the fighter's body, damage plus knockback, 4 second cooldown.
- Q without an active mouthful, Sake Spill: tips the gourd and emits falling droplets before leaving a #e2a417 puddle, 5 second cooldown.
- E, Chug: available only after at least 5 drinks or at full charge. Full charge is consumed only when it substitutes for the 5-drink requirement.
- Sake builds charge passively at 4 per second and gains a small bonus from offensive hits.
- Drunk state: +50% damage, defense, movement, and jump strength, drunken swirls, and stronger random horizontal movement.
- Drunk LMB, Gourd Throw: 3 second cooldown. Throws toward the cursor, causes 3 seconds of bleed on fighter hits, and bursts thick-outlined #bf7950 shards outward on terrain impact.
- Drunk Q, Gourd Swing: 1.25 second cooldown. Swings toward the nearest enemy and deals melee damage plus knockback.
- Shards stop dealing damage once they fade to 50% opacity. The held gourd fades back into the hand after a throw.

## Dagger

- LMB, Blink: 3 second cooldown. Dashes a short distance toward the cursor, damages crossed enemies, and leaves a 35% opacity afterimage trail.
- Cloaked Blink travels farther and deals more damage.
- Q, Dagger Throw: 5 second cooldown. Sticks into an enemy and applies 3 seconds of damage over time.
- Cloaked Dagger Throw travels faster and extends the damage-over-time duration to 6 seconds.
- E, Cloak: 17 second cooldown. The fighter is translucent for 8 seconds and gains true invulnerability for the first 4 seconds.
- Attacking does not cancel Cloak.

## Slip

Slip is a temporary ragdoll state, separate from death.

- A slipped fighter cannot move or attack until recovery.
- Entering Slip does not deal damage by itself.
- A move or hazard may explicitly deal damage and then cause Slip.
- The fighter keeps their current health and equipped weapon when recovering.
- Slip uses the same floppy body physics as ragdolls but does not drop the weapon.

## Ragdolls

- Character death creates a floppy constrained-particle ragdoll.
- Equipped weapons are released and simulated separately.
- Water applies drag and buoyancy so corpses and dropped weapons bob near the surface.
- Ragdolls fade during the end of their lifetime before removal.
- R triggers a temporary player death test and automatic revival.

## Combat HUD

The bottom-left HUD uses five bars:

- ATTACK1, ATTACK2, ATTACK3: small white readiness bars.
- HEALTH: red.
- CHARGE: yellow.

Charge rises passively during a match at a weapon-specific rate and gains a small bonus when that weapon hits an enemy.

## Language files

English text lives in `assets/language/language-english.json`.

Additional languages can follow the same structure. The built-in English fallback preserves direct `file://` launching.

## Controls

- A / D or Left / Right: move
- W / Space / Up: jump
- Shift: run
- Mouse: aim
- LMB: attack 1
- Q: attack 2
- E: attack 3
- R: ragdoll death test, then revive
- Esc: back
