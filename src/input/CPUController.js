'use strict';

// VS CPU, phases CPU-0 to CPU-2. The CPU produces ordinary controller input;
// Game/Player/WeaponMount remain authoritative for physics, charge and damage.
class CPUController extends FighterController {
  static profiles = Object.freeze({
    easy: Object.freeze({
      think:0.46, reaction:0.45, aimError:95, aggression:0.55,
      dodgeChance:0.32, runChance:0.35
    }),
    normal: Object.freeze({
      think:0.26, reaction:0.27, aimError:43, aggression:0.80,
      dodgeChance:0.60, runChance:0.70
    }),
    hard: Object.freeze({
      think:0.16, reaction:0.17, aimError:20, aggression:0.93,
      dodgeChance:0.83, runChance:0.86
    })
  });

  constructor({ difficulty = 'normal', seed = 0x16a4bc71 } = {}) {
    super();
    this.difficulty = CPUController.profiles[difficulty] ? difficulty : 'normal';
    this.profile = CPUController.profiles[this.difficulty];
    this.initialSeed = seed >>> 0;
    this.seed = this.initialSeed;
    this.game = null;
    this.slot = null;
    this.reset();
  }

  random() {
    // Repeatable decisions for tests. CPU seeds can differ between matches.
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  bind(game, slot) {
    this.game = game;
    this.slot = slot;
    return this;
  }

  reset() {
    this.time = 0;
    this.decisionTimer = 0.15;
    this.moveX = 0;
    this.run = false;
    this.jumpTimer = 0;
    this.state = 'hold';
    this.aimPoint = null;
    this.observations = [];
    this.pressed = new Set();
    this.lastTarget = null;
    this.specialBias = this.random() < 0.74;
    this.actionCooldown = 0;
    this.dodgeCooldown = 0;
    this.lastDecision = null;
  }

  axis(negative, positive) {
    return negative === 'left' && positive === 'right' ? this.moveX : 0;
  }

  down(action) {
    if (action === 'run') return this.run;
    if (action === 'jump') return this.jumpTimer > 0;
    return false;
  }

  consumePrimary() { return this.takeAction('primary'); }
  consumeAttack2() { return this.takeAction('attack2'); }
  consumeAttack3() { return this.takeAction('attack3'); }
  defenseHeld() { return false; }

  takeAction(action) {
    const hit = this.pressed.has(action);
    this.pressed.delete(action);
    return hit;
  }

  aimWorld(game = this.game, slot = this.slot) {
    if (this.aimPoint) return { ...this.aimPoint };
    const foe = game?.getOpponentSlot?.(slot)?.actor;
    return foe ? { x:foe.x, y:foe.y - 8 } :
      { x:(slot?.actor?.x || 0) + 100, y:slot?.actor?.y || 0 };
  }

  observeOpponent() {
    const foeSlot = this.game?.getOpponentSlot?.(this.slot);
    const foe = foeSlot?.activeBody?.() || foeSlot?.actor;
    if (!foe || foeSlot?.isDead?.()) return null;
    const observation = {
      time:this.time,
      x:foe.x, y:foe.y,
      vx:foe.vx || 0, vy:foe.vy || 0,
      alive:true
    };
    this.observations.push(observation);
    const cutoff = this.time - this.profile.reaction;
    while (this.observations.length > 2 &&
           this.observations[1].time <= cutoff) {
      this.observations.shift();
    }
    return this.observations[0];
  }

  weaponPlan(weapon) {
    const profiles = {
      revolver:{ preferred:460, near:240, far:1100 },
      wand:{ preferred:400, near:210, far:780 },
      dagger:{ preferred:125, near:80, far:520 },
      sake:{ preferred:195, near:110, far:350 },
      mushroom:{ preferred:160, near:105, far:235 }
    };
    return profiles[weapon?.id] || profiles.revolver;
  }

  supportInterval(terrain, x) {
    return (terrain?.groundIntervals || []).find(([a,b]) => x >= a && x <= b) || null;
  }

  // Safety is checked at every fixed step, not just when the tactical AI
  // thinks. Predict stopping distance instead of discovering a cliff late.
  safeMovement(requested) {
    const actor = this.slot?.actor;
    const terrain = this.game?.terrain;
    if (!actor || !terrain) return requested;

    const interval = this.supportInterval(terrain, actor.x);
    if (!interval) {
      const safeX = terrain.clampGroundX?.(actor.x, 155);
      if (Number.isFinite(safeX)) return Math.sign(safeX - actor.x);
      return 0;
    }

    if (!requested) return 0;
    const [left, right] = interval;
    const speedTowardEdge = Math.max(0, (actor.vx || 0) * requested);
    const buffer = 110 + speedTowardEdge * 0.38;
    if (requested < 0 && actor.x - left < buffer) return 1;
    if (requested > 0 && right - actor.x < buffer) return -1;

    const predicted = actor.x + requested * (100 + speedTowardEdge * 0.25);
    if (!terrain.hasGroundAt?.(predicted)) return -requested;
    return requested;
  }

  threatNear() {
    const actor = this.slot?.actor;
    if (!actor || !this.game) return false;

    for (const hazard of this.game.hazards || []) {
      if (hazard.dead || hazard.owner === actor || !Number.isFinite(hazard.x)) continue;
      const dx = hazard.x - actor.x;
      if (Math.abs(dx) < 116 && Math.abs((hazard.y || actor.y) - actor.y) < 180) {
        return true;
      }
    }

    for (const p of this.game.projectiles?.items || []) {
      if (p.dead || p.owner === actor || p.nonCombat || !p.vx) continue;
      const t = (actor.x - p.x) / p.vx;
      if (t <= 0 || t > 0.50) continue;
      const projectedY = p.y + (p.vy || 0) * t +
        (p.gravity || 0) * t * t * 0.5;
      if (Math.abs(projectedY - actor.y) < 85) return true;
    }
    return false;
  }

  decide(target) {
    const actor = this.slot.actor;
    const weapon = actor.weaponMount?.weapon;
    const plan = this.weaponPlan(weapon);
    const dx = target.x - actor.x;
    const distance = Math.abs(dx);
    const toward = Math.sign(dx) || actor.facing || 1;
    const offset = this.profile.aimError;
    const prediction = Math.min(0.12, this.profile.reaction * 0.3);
    this.aimPoint = {
      x:target.x + target.vx * prediction + (this.random() * 2 - 1) * offset,
      y:target.y - 8 + target.vy * prediction +
        (this.random() * 2 - 1) * offset * 0.7
    };

    const danger = this.threatNear();
    const unsupported = !this.supportInterval(this.game.terrain, actor.x);
    const retreat = distance < plan.near;
    const approach = distance > plan.preferred + 36;
    this.state = unsupported ? 'recover' : danger ? 'evade' :
      retreat ? 'retreat' : approach ? 'approach' : 'hold';

    this.moveX = this.state === 'approach' ? toward :
      this.state === 'retreat' ? -toward : 0;
    if (this.state === 'recover') {
      this.moveX = this.safeMovement(0);
      this.run = false;
    }
    if (this.state === 'evade') {
      this.moveX = -toward;
      if (this.random() < this.profile.dodgeChance &&
          this.dodgeCooldown <= 0 && actor.onGround) {
        this.jumpTimer = 0.14;
        this.dodgeCooldown = 1.1 + this.random() * 0.5;
      }
    }

    this.run = !!this.moveX && distance > plan.near + 55 &&
      this.random() < this.profile.runChance;

    // Environmental obstacles and terrain transitions use normal jumping.
    const ahead = actor.x + this.moveX * 90;
    if (this.moveX && actor.onGround &&
        !this.game.terrain.hasGroundAt?.(ahead)) {
      this.moveX = -this.moveX;
      this.run = false;
    }
    this.moveX = this.safeMovement(this.moveX);

    const available = weapon?.attackReadiness?.(this.slot.gameView) || [0,0,0];
    const full = this.slot.charge >= this.slot.maxCharge - 0.001;
    const inSight = Math.abs(target.y - actor.y) < 310;
    const attackChance = this.profile.aggression;

    if (inSight && this.random() < attackChance) {
      const id = weapon?.id;
      if (id === 'mushroom') {
        if (available[0] >= 0.98 && distance < plan.far) this.pressed.add('primary');
        if (full && available[2] >= 0.98 &&
            distance < 730 && distance > 100) {
          this.pressed.add('attack3');
          this.specialBias = this.random() < 0.78;
        } else if (!this.specialBias &&
                   this.slot.charge >= 50 && available[1] >= 0.98 &&
                   distance < 640 && this.random() < 0.40) {
          this.pressed.add('attack2');
          this.specialBias = this.random() < 0.67;
        }
      } else if (id === 'revolver') {
        if (weapon.rounds?.length === 0 && available[1] >= 0.98) {
          this.pressed.add('attack2');
        } else if (available[0] >= 0.98 && distance < plan.far) {
          this.pressed.add('primary');
        }
        if (full && available[2] >= 0.98 && distance < 950) {
          this.pressed.add('attack3');
        }
      } else if (id === 'wand') {
        if (available[0] >= 0.98 && distance < plan.far) this.pressed.add('primary');
        if (available[1] >= 0.98 && distance < 650 &&
            this.random() < 0.32) this.pressed.add('attack2');
        if (full && available[2] >= 0.98 && distance < 710) this.pressed.add('attack3');
      } else if (id === 'dagger') {
        if (available[0] >= 0.98 && distance < 180) this.pressed.add('primary');
        if (available[1] >= 0.98 && distance < 640 &&
            this.random() < 0.48) this.pressed.add('attack2');
        if (available[2] >= 0.98 && distance < 330 &&
            this.random() < 0.26) this.pressed.add('attack3');
      } else if (id === 'sake') {
        if (available[0] >= 0.98 &&
            (distance < 480 || weapon.drunkMeter < 5)) {
          this.pressed.add('primary');
        }
        if (available[1] >= 0.98 && distance < 340) this.pressed.add('attack2');
        if (available[2] >= 0.98 &&
            (weapon.drunkMeter >= 5 || full)) this.pressed.add('attack3');
      }
    }

    this.lastDecision = {
      time:this.time, state:this.state, distance, weapon:weapon?.id,
      moveX:this.moveX, danger
    };
  }

  poll(dt = 1 / 120) {
    dt = MathEx.clamp(Number.isFinite(dt) ? dt : 1 / 120, 0, 0.05);
    this.time += dt;
    this.decisionTimer -= dt;
    this.jumpTimer = Math.max(0, this.jumpTimer - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    // Consume-once buttons must never survive a respawn or a knockdown frame.
    this.pressed.clear();

    if (!this.game || !this.slot || !this.slot.canControl?.()) {
      this.moveX = 0;
      this.run = false;
      return;
    }

    const delayedTarget = this.observeOpponent();
    if (!delayedTarget) {
      this.moveX = 0;
      this.run = false;
      this.aimPoint = null;
      this.state = 'hold';
      return;
    }

    if (this.decisionTimer <= 0) {
      this.decide(delayedTarget);
      this.decisionTimer = this.profile.think * (0.8 + this.random() * 0.4);
    }

    this.moveX = this.safeMovement(this.moveX);
    if (!this.moveX) this.run = false;
  }
}
