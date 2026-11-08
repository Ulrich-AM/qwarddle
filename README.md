# QWARDDLE v0.0.24

A local-first 2D fighter prototype built with plain HTML, CSS, JavaScript, and Canvas 2D.

Open `index.html` directly. No npm, bundler, or local server is required.

## Current flow

MAIN MENU -> SOLO / LOCAL -> SETUP -> CUSTOMIZE -> FIGHT

LOCAL now contains COUCH and LAN. COUCH uses one computer plus a controller. LAN uses two computers on the same network, with separate keyboard/mouse input on each machine. ONLINE remains disabled. SOLO still uses an idle P2 placeholder until the CPU session. While only one map is registered, the map-selection screen is skipped automatically and that arena is used directly.

## v0.0.24

The v0.0.24 flat-PvP pass introduced TEST PLANE with a 2,400 x 1,200 arena and `#8fc4df` sky. The unreleased appearance pass described below expands this map and replaces its flat sky color.

- Revolver: 2.5 normal damage per shot, 6.5 charged damage, 0.34 s between shots, 0.58 s reload, 270 regular / 690 charged knockback.
- Wand: 0.9 primary damage with a 0.32 s cooldown; each primary star still passes through terrain and fighters, hitting a fighter once. Q sends three 0.8-damage homing stars every 1.30 s; E still bursts on the first terrain hit.
- Dagger: Lunge increases to 14 normal damage or 18 while cloaked. The direct melee hit remains the main payoff for committing to close range.
- Sake's close-range drunk swing remains at 10 base damage before buffs; ranged Sake effects retain their reduced values.
- The RMB/LT held body-only defensive ragdoll (40% direct damage reduction, no movement or attacks) remains available.
- Gameplay cursors are local CSS circles with black outlines, not painted into the shared LAN video stream.
- Key intervals, damage, and projectile knockback parameters are centralized in `src/combat/Balance.js` for further PvP tuning.

These are initial PvP balance targets, not claims of proven competitive balance. Expected sustained hit damage per second, assuming every attack connects and omitting charged special attacks, is about 5.7 for normal Revolver (including reload time), 2.8 for Wand primary plus up to 1.8 from Q, and 4.7 for Dagger Lunge alone. Real hit rates and knockback make these matchup-dependent.

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

TEST PLANE is the only registered arena for movement and combat tuning. It is a flat 7,200 x 1,700 world with one finite floor rectangle from x=500 to x=6,700, no platforms or side walls, and open water beyond either edge at y=1,270. The sky is a light-blue vertical gradient.

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

- Normal shot damage: 2.5.
- Charged shot damage: 6.5.
- LMB uses a 0.34 second weapon spin as its fire cooldown.
- Q reload grants 10 temporary health and 15% damage reduction for 1 second.
- E still requires full charge and loads six charged rounds.
- Knockback and recoil remain intentionally much stronger than the raw health damage.

## Wand

Wand is a space-control weapon, not a raw DPS weapon.

- LMB damage: 0.9 with a 0.32 second cooldown. It still passes through terrain and fighters and can damage each fighter once.
- Q damage: 0.8 per homing star, three stars per cast, 1.30 second cooldown.
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

- LMB Lunge: 14 damage, or 18 while cloaked.
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


## Unreleased menu and arena appearance pass

- The test plane is widened from 2,400 to 7,200 world units so the left and right edges no longer dominate the fight camera. The single ground rectangle now begins at x=500 and ends at x=6,700, leaving open water at either end.
- The water threshold is raised from y=1,600 to y=1,270. A map-specific translucent water overlay makes the submerged ground visible without changing the floor collision surface.
- The game sky now uses optional `skyTop`, `skyMiddle` and `skyBottom` colors, drawn as a screen-space vertical gradient. Maps without these values keep their existing single-color backgrounds.
- The main menu now has a red, white and black arcade treatment, direct SOLO/COUCH/LAN entry points and the same interactive real-player preview. The new styles are isolated in `menu-theme.css`.
- This pass does not change weapon balance, fighter physics, host-authoritative LAN, or the map JSON contract used by older maps.


## Menu copy, shoreline and impact tuning

- Removed the promotional taglines and reduced the main menu to direct game mode instructions.
- TEST PLANE is bounded by real shore edges at x=500 and x=6,700. Ground collision ends there; water remains beneath both sides of the arena, and the default spawns stay on solid ground.
- Raised automatic ragdoll crash thresholds: floor 980 to 1,320, wall 760 to 1,040, ceiling 930 to 1,200. Stumble thresholds also increase to 680 / 650 / 800 respectively.
- Reduced the contribution of extreme horizontal speed and tilt to floor crash detection. Intentional ragdolls, weapon knockbacks and death effects are unchanged.
- These thresholds are initial feel adjustments and need playtesting after ordinary jumps, running, wall collisions and high-speed attacks.


## Mushroom weapon M1-M3

MUSHROOM is selectable from WEAPONS. The weapon and green hazard use the
sprites under `assets/sprites/mushroom/`. The purple asset is reserved for M4.

- LMB fires four short-range spores (1 damage each, 0.72s interval).
  Each hit causes 1.2s of dizziness, with occasional 0.32s horizontal
  movement reversal. Jumping, aiming and attacking are unchanged.
- Q costs 50 of 100 charge immediately and fires four ballistic seeds.
  Seeds plant only on the top of solid geometry. The green mushrooms grow
  for 0.28s, last up to 9s, and on touch deal 8 damage plus 2s dizziness.
- Up to five green mushrooms can exist per fighter. A consumed mushroom
  deals damage once, then disappears. Green mushrooms never hit their owner.
- Dizziness is processed by the Player after reading the controller axis,
  so keyboard, gamepad and LAN all use the host-authoritative effect.
  The HUD shows DIZZY or DIZZY / REVERSED. Screen visuals are local
  to P1 or passed to the remote LAN client separately from the video stream.
  In couch mode the P2 HUD shows the effect without obscuring P1's view.
- E remains disabled until Phase M4.


## Mushroom M4: purple synchronized detonation

- E requires the full 100-point charge meter and consumes all charge at launch.
  It has an additional 3-second ability cooldown and launches four purple
  seeds, which plant only on actual top-facing solid terrain.
- Purple mushrooms grow for 0.38 seconds and persist for up to 12 seconds.
  Once an opponent walks or jumps over any mature mushroom, all of that
  fighter's active purple mushrooms detonate together and immediately vanish.
- Every detonating mushroom releases 14 visible purple spores in a circular
  spray. Damage is resolved once per target per synchronized burst:
  18 at one mushroom, increasing by 5 per additional nearby mushroom,
  capped at 34. The particles themselves are visual, not extra damage hits.
- Affected opponents receive 0.72 seconds of dizziness, including the
  existing occasional movement reversal, and a separate 1.4-second purple
  screen tint/vignette. The tint fades before its timer expires.
- The same local-only overlay architecture used for green dizziness handles
  the purple effect on a LAN client's device. Shared couch fights show a
  PURPLE SPORES label on the affected fighter's HUD instead of tinting
  the whole shared screen. Protected fighters and the owner are not affected.
- Existing LMB and Q Mushroom behaviors and all other weapons are unchanged.

## Planned: VS CPU mode (design only, not implemented)

The existing SOLO mode currently gives P2 an IdleController placeholder.
A future CPUController should implement the same controller contract and
produce ordinary movement, jump, aim and attack inputs, rather than directly
teleporting or damaging fighters. The game remains host-authoritative.

Suggested implementation phases:

1. CPU-0: a standalone CPUController with configurable response delay,
   decision tick, difficulty settings, target selection, and deterministic
   evaluation hooks. Keep this disconnected from gameplay until tested.
2. CPU-1: movement and positioning with desired range, turnarounds,
   shoreline avoidance, basic jumping and recovery from missed steps.
3. CPU-2: weapon-aware actions for the existing weapons, limited aim accuracy,
   cooldown/charge discipline, and threat detection, including Mushroom hazards.
4. CPU-3: evaluate match outcome and balance. Add CPU selection to the PLAY
   screen while preserving SOLO training as the non-attacking dummy mode.

The CPU should obey regular controls, knockbacks, cooldowns, line of sight,
and reaction delay. A basic state machine (approach, hold, retreat, evade,
recover) is preferred over an expensive planner. Initial tuning should
target playable, fallible behavior rather than perfect accuracy.

### Repeatable Mushroom M4 test

From the repository root, run `node tests/mushroom-m4.test.cjs`.
This test requires Node.js but does not require npm, any installed package,
or a network connection. It covers full-charge gating, purple seed growth,
synchronized detonation, one-time capped damage, immune targets, visual
spore emission and owner immunity.

The separate `docs/VS_CPU_PLAN.md` contains the planned CPU controller
design and milestones. No VS CPU runtime implementation is included in M4.


## VS CPU: CPU-0 to CPU-2 playtest mode

Use **PLAY > VS CPU** on the main menu. Choose **Easy / Normal / Hard**,
select a CPU weapon, and press **FIGHT CPU**. The default enemy weapon is
**MUSHROOM** so you can experience short green dizziness, control reversal,
and the purple spore vignette without a second human.

Customize your own fighter as usual. Your selected CPU is P2, has standard
100 health, starts with 0 charge, and obeys the same weapon cooldowns,
damage, physics and attack pipeline as a human player. CPU respawns use the
same world spawns and reset its decision state. The original **SOLO** mode
remains a non-attacking training dummy; COUCH and LAN are unchanged.

The CPU controller uses a small decision-state system (approach, hold,
retreat, evade), delayed opponent observations, imperfect aim, finite
decision intervals and predicted shoreline avoidance. It uses existing
projectile/hazard positions to attempt ordinary jump evasions and has
weapon-specific tactics for Revolver, Wand, Dagger, Sake and Mushroom.

### Playtesting Mushroom dizziness

1. Start VS CPU with CPU WEAPON = MUSHROOM and DIFFICULTY = NORMAL.
2. Move within approximately 200 world units of the CPU and allow it to
   spray you. A hit applies a subtle green overlay and occasionally
   reverses your left/right controls for a fraction of a second.
3. Let the CPU accumulate charge naturally. When it has at least 50,
   it can launch green mushrooms. At full charge it can create purple
   mushrooms; crossing one causes the linked purple burst and vignette.
4. After testing, compare EASY and HARD to see different reaction times
   and aim errors. Press Escape to return to the main menu.

CPU behavior is provisional. It may occasionally misjudge jump timing,
waste abilities, or struggle near a ledge. This is intended to be a
fallible practice opponent, not a perfect or cheating AI.

Run the standalone behavior tests with
\`node tests/cpu-controller.test.cjs\` (no npm packages required).
