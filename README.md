# QWARDDLE v0.0.20

A local-first 2D fighter prototype built with plain HTML, CSS, JavaScript, and Canvas 2D.

Open `index.html` directly. No npm, bundler, or local server is required.

## Current flow

MAIN MENU -> SOLO / LOCAL -> SETUP -> MAP / CUSTOMIZE -> FIGHT

LOCAL now contains COUCH and LAN. COUCH uses one computer plus a controller. LAN uses two computers on the same network, with separate keyboard/mouse input on each machine. ONLINE remains disabled. SOLO still uses an idle P2 placeholder until the CPU session.

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

## Active-body locomotion

Normal locomotion uses an active-body / active-ragdoll hybrid, but the ground gait is now deterministic rather than trigger-driven.

- The torso uses its real body-sized collision box.
- Ground walking/running advances a gait phase continuously while moving.
- The two legs are offset by half a cycle, so one leg swings while the other provides support.
- Walk cadence is 2.60 gait cycles per second and run cadence is 3.20 cycles per second. Two steps occur per cycle.
- The swing portion occupies 40% of each leg cycle, leaving brief double-support windows between steps.
- Swing foot targets are body-relative and move from a rear stride position to a forward stride position. The visible foot still spring-follows that target, so the gait remains floppy without being able to stall.
- Planted feet remain soft spring contacts rather than teleported points.
- One-foot support now spans 68 px, close to the actual leg reach, so a normal run step stays supported while true overextension still causes release/fall.
- Upper-leg and lower-leg lengths are enforced every fixed update with soft positional constraints.
- Knees and feet are projected out of floor rectangles so active knees cannot sink through platforms.
- Jumping releases both ground contacts and drives both feet toward compact airborne targets inside the reachable two-bone chain, preventing the long stretched-leg jump pose.
- Ragdolls continue to inherit torso, knee, foot, elbow, and hand velocities from active mode.
- Slip/Dagger recovery still adopts the ragdoll pose instead of rebuilding a fresh standing skeleton.

The menu and customization preview run the same Player locomotion at an internal 120 Hz and implement the same ground-contact API as real maps.

### Surface response

Ground acceleration, braking, reversing, and planted-foot grip are separate multipliers so future map materials can change slipperiness without rewriting movement.

Default movement tuning:

```text
walk speed        270
run speed         445
acceleration      720
reverse braking  1450
deceleration     1500
```

Maps do not need materials. Existing rectangles automatically use the default response.

Future rectangles may optionally provide a `material` and maps may define:

```json
{
  "surfaceMaterials": {
    "ice": {
      "acceleration": 0.45,
      "deceleration": 0.18,
      "reverse": 0.35,
      "footGrip": 0.28
    }
  }
}
```

`footGrip` scales the planted-foot motor as well as movement response, so a slippery surface can affect both stopping distance and how securely the active legs hold contact.

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

The revolver remains the high-knockback burst weapon, but raw damage has been reduced for longer matches.

- Normal shot damage: 10.
- Charged shot damage: 20.
- LMB still uses the weapon spin as its fire cooldown.
- Q reload grants 10 temporary health and 15% damage reduction for 1 second.
- E still requires full charge and loads six charged rounds.
- Recoil and knockback remain intentionally extreme so the weapon keeps its identity without relying on huge health damage.

## Wand

Wand is tuned around persistent space control rather than raw burst damage.

- LMB damage: 4. The star passes through terrain and fighters, damaging each fighter only once.
- Q damage: 2.5 per homing star.
- E contact damage: 3.5.
- E no longer ricochets. The large star phases through fighters and bursts into twelve smaller stars on its first terrain impact.
- E burst fragments deal 2.25 damage each.

## Sake

Sake keeps its utility/chaos identity, but its old drunk-state multipliers were too strong for real matches.

- Drink melee buff: +15%.
- Drink defense buff: 18% damage reduction.
- Drink regeneration: 6 health over 5 seconds.
- Drunk state: 30% damage reduction, +25% general damage, +20% melee, while keeping the strong movement/jump boost.
- Spit damage: 1 per damaging pulse during the sustained 1.5 second spray.
- Spill puddle damage: 4 plus Slip.
- Shards: 1.5 direct damage plus 1.5 bleed DPS for 3 seconds.
- Drunk swing base damage: 8 before current buffs.
- Gourd throw base damage: 10 plus 2 bleed DPS for 3 seconds.
- Gourd shards now inherit the thrower's owner identity and cannot damage their owner.

## Dagger

Dagger remains a mobility/burst weapon, with lower damage so Cloak does not compress matches too heavily.

- LMB Lunge: 9 damage, or 13 while cloaked.
- Q Throw: 3 impact damage.
- Normal throw bleed: 2.5 DPS for 3 seconds.
- Cloaked throw bleed: 3.25 DPS for 6 seconds.
- E Cloak remains 8 seconds with invulnerability during the first 4 seconds.
- Held/thrown/stuck/drop visuals and the short offensive-ragdoll Lunge are unchanged.

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
