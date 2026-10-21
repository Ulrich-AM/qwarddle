# QWARDDLE v0.0.23

A local-first 2D fighter prototype built with plain HTML, CSS, JavaScript, and Canvas 2D.

Open `index.html` directly. No npm, bundler, or local server is required.

## Current flow

MAIN MENU -> SOLO / LOCAL -> SETUP -> CUSTOMIZE -> FIGHT

LOCAL now contains COUCH and LAN. COUCH uses one computer plus a controller. LAN uses two computers on the same network, with separate keyboard/mouse input on each machine. ONLINE remains disabled. SOLO still uses an idle P2 placeholder until the CPU session. While only one map is registered, the map-selection screen is skipped automatically and that arena is used directly.

## v0.0.23

This pass rebuilds COMPLEX around the real current player scale, adds a body-only defensive tuck, and makes gameplay cursors local to each machine.

- COMPLEX is now 2400 x 1400 with a blue-gray sky (`#b8d6e8`), open top, two small floor pits, and a symmetric five-tier climb.
- Vertical rises are approximately 175, 170, 165, 160, and 155 px. Current jump apex is roughly 210 px, so climbing no longer depends on near-perfect jumps.
- RMB enters a held defensive tuck. LT performs the same action for couch gamepad P2.
- While tucked, all limbs and the held weapon disappear and only the square body remains.
- The square becomes a body-only ragdoll and preserves incoming movement velocity.
- Movement and all attacks are disabled while tucked.
- Direct incoming damage is multiplied by 0.60 while tucked. Existing bleed/status effects continue normally.
- Projectile, Dagger-ragdoll, and Sake-melee knockback are applied directly to the tucked physics body.
- Releasing RMB restores the physical body pose/velocity and lets the normal procedural limbs reacquire the ground.
- Attack inputs pressed during tuck are consumed instead of firing on release.
- Slip cannot create a second ragdoll while the defensive tuck is active.
- Gameplay aim markers are no longer rendered into the shared game canvas.
- The host game canvas and LAN client video use the same local white circular cursor with a black outline. Native/CSS cursors are not part of the canvas WebRTC stream, so each LAN player only sees their own cursor.
- The map creator now defaults to the same blue sky color.

## v0.0.22

This pass re-audits every stage of the hybrid movement system after v0.0.21, focusing on visible sprint dragging and jump/landing continuity.

- Sprinting no longer waits for one procedural swing to finish before the other rear foot is allowed to lift. Above sprint-transfer speed, the next foot can begin after weight transfer while the previous swing is still finishing.
- Each foot tracks real plant age. Overlapping sprint steps require a minimum planted interval, and newly landed feet get a short stance before another normal step can begin.
- Full-sprint transfer now starts much earlier in the stride, with faster landing prediction and reach-based lookahead, reducing the long stretched rear-leg pose that looked like dragging.
- The short floor-backed support grace is reduced to 0.11 s and now respects surface grip. It remains long enough to cover the brief double-swing phase but cannot replace actual floor contact.
- Jump takeoff gives released feet part of the torso's current velocity instead of leaving them motionless for the first airborne frame.
- Descending airborne legs progressively extend and lead into their landing positions, so the landing state does not begin from a fully tucked pose.
- Landing foot recovery uses a much smaller arc and shorter distance-aware timing.
- The torso now preserves more downward velocity at contact, dips under inertia through a short compression curve, then rebounds toward standing height.
- Running landings cannot plant and immediately re-lift the same foot during the same update.
- Floor crash severity now treats upright horizontal running as relatively safe, while excess speed above normal run speed is counted separately. Normal sprint-jumps stay below crash thresholds, while high-speed recoil launches and large falls can still ragdoll.
- Overlapping swings drive body sway symmetrically instead of implicitly favoring the first leg.
- Ragdoll recovery enables its crash cooldown before trying to reacquire the floor, closing the immediate re-knockdown window.

## v0.0.21

This patch stabilizes the hybrid locomotion model and gives the torso more physical character without turning the normal legs into active ragdolls.

- Fast running no longer depends on perfect planted-foot contact every fixed step. A 0.14 s floor-backed continuity window keeps the torso supported while a procedural step catches up, but it immediately stops working when there is no real floor under the body.
- Running steps begin from projected future leg reach instead of waiting until the support leg is already close to overstretching.
- The original deterministic plant / swing / air leg states remain authoritative. Planted anchors are never dragged along with the torso.
- Torso rotation is more underdamped and reacts to acceleration, reversals, gait timing, edge support, recoil, and hard landings.
- Hard but survivable impacts enter a short balance-recovery state with extra wobble instead of instantly returning upright.
- High-speed floor, wall, and ceiling impacts can now hand control to the existing non-lethal ragdoll system.
- Impact ragdolls preserve incoming linear and angular momentum, keep the equipped weapon, and recover through the normal procedural-leg reacquisition path.
- Ordinary run speed and normal jumps remain below the crash thresholds; unusually high recoil/launch speeds are where the ragdoll handoff becomes likely.
- Intentional knockback and jumping clear stride-support grace so the continuity fix cannot act like invisible air support.

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

## Two-fighter core

Normal gameplay now runs on two real `Player` instances instead of a player plus a special test dummy.

- `Game.fighters` contains two `FighterSlot` objects.
- Each fighter owns independent health, charge, weapon state, buffs, Slip state, death ragdoll, respawn state, and loadout.
- `Player` itself owns hitboxes and hit reactions. Combat no longer depends on a target-only subclass.
- Projectiles carry an owner and cannot hit their owner.
- Weapons receive a fighter-scoped game view, so calls such as charge gain, full-charge checks, opponent targeting, hazards, and Dagger attack ragdolls automatically resolve to the correct fighter.
- P1 currently uses `KeyboardMouseController`.
- P2 controller is mode-dependent: `IdleController` in current SOLO, `GamepadController` in COUCH, and `NetworkController` for LAN-hosted matches.
- Both fighters use the same movement, procedural body, collision, combat, Slip, death, water, and respawn systems.
- The old `TargetFighter` runtime actor has been removed. Git history preserves it for a possible future training mode.

This controller boundary is shared by COUCH, LAN, and the future CPU mode, so new control sources do not require a separate fighter/combat path.

## Local multiplayer

LOCAL now has two paths.

### Couch

- P1: keyboard + mouse.
- P2: first connected browser gamepad.
- P1 and P2 can both be customized from the same customization screen using the bottom fighter-switch button.
- The two-fighter camera and mirrored HUD remain shared.

### LAN

LAN is same-network remote couch play built into QWARDDLE.

The host remains authoritative. Only the host browser runs the actual simulation. P2 receives a live WebRTC stream of the host game canvas and sends keyboard/mouse input back through a WebRTC data channel. This avoids trying to synchronize ragdolls, random Sake movement, shards, projectiles, and other physics independently on two machines.

Run on the host computer:

```text
START-LAN.bat
```

or:

```text
py lan_server.py
```

The terminal prints both a localhost address and a LAN address such as:

```text
http://192.168.1.14:8765
```

Open the LAN address on the second computer. Both computers must be on the same local network.

LAN flow:

1. Host opens LOCAL -> LAN and creates a room. Room name and password are optional.
2. Host selects the map and customizes P1.
3. Client opens the host LAN address, goes to LOCAL -> LAN, and chooses the room from the list.
4. Client customizes P2 and presses READY.
5. WebRTC connects the host canvas stream and remote input channel.

Client controls:

- A / D or Left / Right: move.
- W / Space / Up: jump.
- Shift: run.
- Mouse: aim.
- LMB: attack 1.
- Q: attack 2.
- E: attack 3.

The LAN companion uses only Python's standard library. It serves the game, stores temporary room metadata/passwords in memory, and relays WebRTC signaling. It does not simulate combat and does not provide internet-wide matchmaking.

Room discovery currently lists rooms available from the LAN server address the client opened. Automatic discovery across multiple different host computers on the same network is a later enhancement.

### Identity

The main menu includes a lightweight nickname field. It is stored locally in the browser and is only used to identify players in the UI/LAN room. It is not an account system.

## Hybrid locomotion

Normal movement now deliberately splits responsibilities between a physical torso and the original procedural legs.

### Torso/body

- The visible torso uses its real body-sized collision box. The old invisible leg-height body collider is not used during normal movement.
- Vertical motion uses a spring/damper support force while procedural feet have credible planted contacts.
- One planted foot can support the body near an edge, but a planted anchor is never dragged along with the torso.
- If the hip outruns a planted leg's reachable chain, that contact is released and the leg returns through the normal air/landing path.
- The torso carries vertical velocity, body angle, and angular velocity through normal movement.
- Acceleration/deceleration, recoil overspeed, capped bhopping, and surface-response multipliers remain active.
- Torso visual rotation uses smaller quantized steps so it stays pixel-readable without obvious angle popping.

### Procedural legs

The original stable leg model is retained:

- explicit `plant`, `swing`, and `air` states
- original Hermite swing arcs
- original two-bone IK knee solving/easing
- original airborne tuck behavior
- no spring-driven foot or knee physics
- no gait clock or active-ragdoll leg solver

The old gait timing was shortened slightly to match the faster 270/445 walk/run speeds:

```text
step trigger       14 px
walk swing         0.150 s
run swing          0.105 s
landing prediction 0.095 s
```

This keeps the old visual cadence while preventing the torso from outrunning the planted support leg at the new run speed.

### Landing and ragdoll transitions

Runtime landing no longer teleports the torso or calls a hard two-foot snap.

- When the body reaches the floor plane, a short landing-assist support force catches the torso.
- Airborne procedural legs use their normal Hermite swing path to reach the floor.
- The assist expires after 0.20 seconds, so it cannot become permanent invisible support.
- The emergency torso-floor collision may only depenetrate the actual torso. It cannot restart an in-progress landing swing.
- Ragdolls inherit torso angle/angular velocity and some planted-leg body momentum.
- Normal visual foot centers are converted to ragdoll foot-circle centers at handoff.
- Slip and Dagger-ragdoll recovery restore the ragdoll torso state and then let the procedural legs reacquire the floor instead of calling `placeAt()`.

### Movement tuning

```text
walk speed        270
run speed         445
acceleration      720
reverse braking  1450
deceleration     1500
air acceleration 460
jump speed        780
bhop cap          ~1.18x run speed
```

### Surface response

Existing maps require no material data. Future map rectangles may optionally define material multipliers for acceleration, deceleration, reversal braking, and foot grip.

```json
{
  "surfaceMaterials": {
    "ice": {
      "acceleration": 0.45,
      "deceleration": 0.18,
      "reverse": 0.35,
      "footGrip": 0.55
    },
    "mud": {
      "acceleration": 0.55,
      "deceleration": 1.65,
      "reverse": 1.20,
      "footGrip": 1.0
    }
  }
}
```

The support code lives in `src/player/ActiveBodySupport.js`, but it only controls the torso. `ProceduralLeg.js` remains the authoritative normal-leg state model.

## Architecture checkpoint

The multiplayer refactor is holding up well overall.

Healthy boundaries:

- `FighterSlot` owns fighter-specific combat state.
- Controllers are swappable between keyboard/mouse, gamepad, LAN network input, and future CPU input.
- `FighterGameView` keeps weapon charge/targeting scoped to the correct fighter.
- Projectiles carry ownership and share one projectile simulation.
- LAN remains host-authoritative, so only one simulation owns ragdolls, random movement, hazards, and projectiles.
- Major tuning values now live in `src/combat/Balance.js`.

Technical-debt watchlist before CPU/match rules:

- `Game.js` is still responsible for too many concerns: fighter lifecycle, Slip/death state, hazards, status VFX, HUD, charge, camera-facing orchestration, and match updates.
- Hazards are still ad-hoc classes rather than one shared combat-impact interface.
- Sake still caches a fighter-scoped game reference internally for some delayed effects.
- `RoundManager` is not yet the authoritative match/stock/winner state.

Recommended next structural split before CPU grows complicated:

1. Move fighter death/Slip/respawn transitions into a dedicated fighter-state or match-combat system.
2. Move hazard/status-VFX updating out of `Game`.
3. Make `RoundManager` own actual match lifecycle before adding stocks/rematch.
4. Keep CPU as another controller implementation rather than putting AI logic into `Player` or `Game`.

## Standalone map creator

Open `map-creator.html` directly. It is intentionally separate from the game and does not require npm, a build step, or the LAN server.

Editor features:

- snapped grid sizes: 10, 20, 25, 50, or 100 px
- click-drag block creation
- snapped block movement
- bottom-right resize handle for selected blocks
- per-block colors
- optional per-block material names
- P1 and P2 spawn placement
- water-line placement
- pan with middle mouse or Space-drag
- cursor-centered wheel zoom
- undo / redo with Ctrl+Z and Ctrl+Y
- JSON import, copy, and download
- true-scale P1/P2 silhouettes using the live dimensions from `src/config.js`
- movable translucent player-scale ghost
- optional real torso collision-box overlay

Tool shortcuts:

```text
1  SELECT
2  BLOCK
3  P1 SPAWN
4  P2 SPAWN
5  WATER
6  ERASE

F  FIT MAP
G  TOGGLE GRID
DEL  DELETE SELECTED BLOCK
```

The creator exports the runtime map shape directly. A downloaded JSON can be sent back for review/registration in `MapRegistry`, or committed to the repo for conversion into a selectable map.

Per-block `color` is now understood by both the runtime terrain renderer and map-selection thumbnails. Maps without block colors still use `groundColor` exactly as before.

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
  "background": "#dfe8eb",
  "groundColor": "#596057",
  "outlineColor": "#202020",
  "outlineSize": 10,
  "spawns": [
    { "x": 560, "y": 500 },
    { "x": 1640, "y": 500 }
  ],
  "rectangles": [
    {
      "x": 300,
      "y": 560,
      "w": 1600,
      "h": 180,
      "color": "#596057",
      "material": "default"
    }
  ]
}
```

Map rectangles are full solid collision geometry for the physical torso. Procedural feet provide support/step contacts on rectangle tops, while torso sides and undersides still block walls and ceilings. A depenetration pass also ejects characters that somehow begin a frame overlapping a block, preventing them from walking around inside solids. Visual rectangles may touch or overlap freely. Rectangle `color` is optional and overrides the map-level `groundColor` for that block. Rectangle `material` is also optional and defaults to `default`.

## Current maps

- TEST PLANE

TEST PLANE is the only registered arena for movement and combat tuning. It is a flat 2400 x 1200 world with a wide floor, side containment walls, no platforms, and water placed below the playable world. The pale blue sky is `#8fc4df`.

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

Revolver is now primarily a knockback/recoil weapon rather than a ranged health shredder.

- Normal shot damage: 4.
- Charged shot damage: 9.
- LMB still uses the weapon spin as its fire cooldown.
- Q reload grants 10 temporary health and 15% damage reduction for 1 second.
- E still requires full charge and loads six charged rounds.
- Knockback and recoil remain intentionally much stronger than the raw health damage.

## Wand

Wand is a space-control weapon, not a raw DPS weapon.

- LMB damage: 1.5 with a 0.22 second cooldown. It still passes through terrain and fighters and can damage each fighter once.
- Q damage: 1.0 per homing star, three stars per cast.
- E contact damage: 1.5.
- E bursts into twelve fragments on first terrain impact.
- E burst fragments deal 0.75 damage each.
- Its value is rapid fire, phasing, homing and area coverage rather than health damage.

## Sake

Sake keeps its utility/chaos identity, with melee now paying off more strongly than its ranged options.

- Drink melee buff: +15%.
- Drink defense buff: 18% damage reduction.
- Drink regeneration: 6 health over 5 seconds.
- Drunk state: 30% damage reduction, +25% general damage, +20% melee.
- Spit damage: 0.6 per damaging pulse.
- Spill puddle damage: 3 plus Slip.
- Shards: 1 direct damage plus 1 bleed DPS for 3 seconds.
- Drunk swing base damage: 10 before current drunk/buff multipliers.
- Gourd throw base damage: 7 plus 1.5 bleed DPS for 3 seconds.

## Dagger

Dagger is the high-commitment burst weapon. Its melee Lunge is intentionally stronger than its throw.

- LMB Lunge: 12 damage, or 17 while cloaked.
- Q Throw: 2 impact damage.
- Normal throw bleed: 1.8 DPS for 3 seconds.
- Cloaked throw bleed: 2.25 DPS for 6 seconds.
- E Cloak remains 8 seconds with invulnerability during the first 4 seconds.
- The risky blade-first Lunge is the weapon's main direct-damage payoff.

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

Each fighter now has its own five-bar combat HUD. P1 is shown on the left and P2 on the right:

- ATTACK1, ATTACK2, ATTACK3: small white readiness bars.
- HEALTH: red.
- CHARGE: yellow.

Charge is stored per fighter. It rises passively at that fighter's weapon-specific rate and gains weapon-specific hit bonuses.

Major multiplayer tuning values are centralized in `src/combat/Balance.js`.

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
