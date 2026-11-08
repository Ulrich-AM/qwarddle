# VS CPU: design proposal

**Status:** Planning only. No CPU implementation in the Mushroom M4 branch.

## Goal

Add **VS CPU** as a new playable game mode with an opponent that moves, aims,
fights, and sometimes makes mistakes. Keep the current **SOLO** training dummy
available. Use exactly the same Player, Game, WeaponMount and collision
simulation as a human fighter. No AI-only teleportation, invulnerability,
perfect aiming or bypassed cooldowns.

## Existing boundaries

- `FighterController` already defines `axis`, `down`, `consumePrimary`,
  `consumeAttack2`, `consumeAttack3`, `defenseHeld`, `poll`,
  and `aimWorld`.
- `Game.setMode` already switches the second fighter's controller.
  Right now solo mode uses `IdleController` for P2.
- `Game` is the authoritative owner of physics, projectile collisions,
  charge, death, hazards and match simulation. CPU must not duplicate any of it.
- The active training map ends in water. A CPU must recognize the real edge
  from `Terrain`, not assume endless flat ground.

## Behavior model

A small finite-state controller is preferable to a full pathfinding system
for a two-fighter, side-view arena:

1. **APPROACH** when outside the currently equipped weapon's useful range.
2. **HOLD** while in preferred firing range or preparing an ability.
3. **RETREAT** when too close, near hazards, or under strong pressure.
4. **ATTACK** when within line of sight and weapon actions are ready.
5. **EVADE** when a clear threat is moving into the current position.
6. **RECOVER** after knockdowns or when needing to reorient near an edge.

State decisions should occur at a modest interval, not every physics tick.
Between decisions, the controller holds normal input commands. Reactions use
small delays and aim jitter so the fighter remains beatable and visibly human.

## Suggested phases

### CPU-0: Controller foundation

Add `CPUController`, with no menu integration yet. Implement the normal
controller methods, held inputs, attack edge triggers, decision cooldowns,
seedable random source and debugging traces. Unit test against the
`FighterController` contract.

### CPU-1: Movement and positioning

Track opponent position/velocity, select a desired weapon range,
approach/retreat, turn, jump and recover after falls. Inspect
`Terrain.groundYAt` and upcoming floor edges before committing to a step.
No teleportation or hidden correction forces.

### CPU-2: Combat and awareness

Use existing `WeaponRegistry` / weapon instance readiness and slot charge,
not a separate fake damage system. Add per-weapon tactical profiles:

- Revolver: line up shots; reload when low; use full-charge rounds sparingly.
- Wand: keep a medium distance; use homing and burst abilities intentionally.
- Dagger: approach, lunge, throw and cloak with a recovery window.
- Sake: maintain a drink cadence; decide when to spit, spill or chug.
- Mushroom: work within spray range; place green/purple mushrooms with
  sufficient charge; avoid running through enemy ground hazards.

Read hostile projectiles/hazards through the existing Game view where
appropriate. Only react to visible or recently observed threats.
Difficulty changes reaction delay, action probabilities and aim noise,
not health, physics, damage or unfair information.

### CPU-3: Menu and round integration

Add **VS CPU** to the PLAY screen while keeping **SOLO** training intact.
Allow selecting a CPU difficulty and possibly a loadout. Reset CPU internal
state on respawn, map change and new round. No effect on COUCH or LAN modes.

### CPU-4: Playtesting and balance

Test 20 or more matches per difficulty/weapon configuration. Measure
falling into water, stuck states, attack rates, charge waste, projectile
accuracy, decision interval and CPU-vs-human outcomes.

## Suggested starting difficulty profiles

| Difficulty | Decision interval | Reaction delay | Aim noise |
| --- | --- | --- | --- |
| Easy | 0.35-0.55 s | 0.50-0.70 s | 12-18 degrees |
| Normal | 0.22-0.35 s | 0.30-0.45 s | 7-12 degrees |
| Hard | 0.12-0.22 s | 0.17-0.30 s | 3-7 degrees |

These are provisional tuning targets, not implemented gameplay values.

## Acceptance criteria

- A CPU plays the same match without modifying any fighter physics or damage.
- It does not run into water during straightforward pursuit on the test plane.
- It can pursue, attack, retreat and recover without input-locking.
- All weapon actions respect cooldowns, charge and attack readiness.
- It remains fallible at every difficulty.
- SOLO, COUCH and LAN behave exactly as before.
