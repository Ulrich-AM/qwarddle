'use strict';

// Mushroom M1-M4: spores, dizziness, green ground hazards and a synchronized purple burst.
class MushroomSpore extends Projectile {
  constructor({ gravity = 180, ...options } = {}) {
    super({ shape:'circle', outlineColor:'#272622', outlineWidth:2, ...options });
    this.gravity = gravity;
    this.initialLife = this.life;
    // Each spray has four hits. Treat the spores as status/damage particles,
    // not four separate body-launching collisions.
    this.noPhysicalHit = true;
  }

  update(dt) {
    this.vy += this.gravity * dt;
    super.update(dt);
  }

  render(ctx) {
    ctx.save();
    ctx.globalAlpha *= Math.min(1, this.life / Math.min(0.25, this.initialLife));
    super.render(ctx);
    ctx.restore();
  }
}

class MushroomSeed extends MushroomSpore {
  constructor({ onPlant = null, ...options } = {}) {
    super({ ...options, gravity:850 });
    this.onPlant = onPlant;
    this.nonCombat = true;
    this.handlesTerrain = true;
    this.hitRadius = 7;
  }

  update(dt, context = {}) {
    const previousY = this.y;
    super.update(dt);
    if (this.dead) return;

    // Only top-face contact grows mushrooms. A spore that hits a side or
    // underside is discarded, never planted inside a wall.
    for (const rect of context.terrain?.rectangles || []) {
      const top = rect.y - this.hitRadius;
      const withinX = this.x >= rect.x + 5 && this.x <= rect.x + rect.w - 5;
      if (withinX && previousY <= top + 1 && this.y >= top && this.vy > 0) {
        this.dead = true;
        this.onPlant?.(this.x, rect.y);
        return;
      }
    }

    if (context.terrain?.circleIntersectsSolid?.(this.x, this.y, this.hitRadius)) {
      this.dead = true;
    }
  }
}

class GreenMushroom {
  constructor({ x, y, owner, sprite, damage = 8, duration = 9 } = {}) {
    Object.assign(this, { x, y, owner, sprite, damage, duration });
    this.age = 0;
    this.dead = false;
    this.width = 42;
    this.height = 46;
    this.growTime = 0.28;
  }

  update(dt, game) {
    if (this.dead) return;
    this.age += dt;
    if (this.age >= this.duration || this.owner?.dead) {
      this.dead = true;
      return;
    }
    if (this.age < this.growTime) return;

    for (const target of game.getHazardActors()) {
      if (target === this.owner || target.dead || target.isInvulnerable?.()) continue;
      const box = target.hitbox?.();
      if (!box) continue;
      const left = this.x - this.width * 0.5;
      const right = this.x + this.width * 0.5;
      const top = this.y - this.height;
      if (box.x + box.w * 0.5 < left || box.x - box.w * 0.5 > right ||
          box.y + box.h * 0.5 < top || box.y - box.h * 0.5 > this.y) continue;

      // Consumed on first valid contact; no overlapping per-frame damage.
      this.dead = true;
      target.takeDamage(this.damage);
      target.hitFlash = Math.max(target.hitFlash || 0, 0.12);
      target.applyDizziness?.(2.0);
      if (target.health <= 0) target.dead = true;
      break;
    }
  }

  render(ctx) {
    const grow = Math.min(1, this.age / this.growTime);
    const fade = Math.min(1, (this.duration - this.age) / 0.6);
    const w = Math.round(this.width * (0.3 + grow * 0.7));
    const h = Math.round(this.height * (0.25 + grow * 0.75));
    ctx.save();
    ctx.globalAlpha *= Math.max(0, fade);
    ctx.imageSmoothingEnabled = false;
    if (this.sprite?.complete && this.sprite.naturalWidth > 0) {
      ctx.drawImage(this.sprite, Math.round(this.x - w / 2), Math.round(this.y - h), w, h);
    } else {
      ctx.fillStyle = '#232923';
      ctx.fillRect(Math.round(this.x - w / 2 - 2), Math.round(this.y - h - 2), w + 4, h + 4);
      ctx.fillStyle = this.fallbackColor || '#49c36e';
      ctx.fillRect(Math.round(this.x - w / 2), Math.round(this.y - h), w, h);
    }
    ctx.restore();
  }
}


/**
 * Purple mines are inert until an opponent passes over any mature mushroom.
 * All mines from the same fighter detonate together and immediately disappear.
 * Damage is applied once per victim, not once per particle, preventing a
 * four-mushroom burst from being an accidental instant kill.
 */
class PurpleMushroom extends GreenMushroom {
  constructor({ x, y, owner, sprite } = {}) {
    super({ x, y, owner, sprite, duration:12, damage:0 });
    this.growTime = 0.38;
    this.width = 46;
    this.height = 48;
    this.triggerWidth = 84;
    this.triggerHeight = 170;
    this.burstWidth = 160;
    this.burstHeight = 205;
    this.fallbackColor = '#a06bda';
  }

  inArea(actor, width, height) {
    const box = actor.hitbox?.();
    if (!box) return false;
    const left = box.x - box.w * 0.5;
    const right = box.x + box.w * 0.5;
    const bottom = box.y + box.h * 0.5;
    return right >= this.x - width &&
      left <= this.x + width &&
      bottom >= this.y - height &&
      bottom <= this.y + 8;
  }

  update(dt, game) {
    if (this.dead) return;
    this.age += dt;
    if (this.age >= this.duration || this.owner?.dead) {
      this.dead = true;
      return;
    }
    if (this.age < this.growTime) return;

    for (const actor of game.getHazardActors()) {
      if (!actor || actor === this.owner || actor.dead || actor.isInvulnerable?.()) continue;
      if (this.inArea(actor, this.triggerWidth, this.triggerHeight)) {
        this.detonateChain(game);
        return;
      }
    }
  }

  detonateChain(game) {
    const active = game.hazards.filter(
      hazard => hazard instanceof PurpleMushroom &&
        hazard.owner === this.owner && !hazard.dead
    );
    if (!active.length) return false;

    // Atomic disarming also prevents the remaining hazards from triggering on
    // their update later in the same simulation step.
    for (const mushroom of active) mushroom.dead = true;

    for (const target of game.getHazardActors()) {
      if (!target || target === this.owner || target.dead || target.isInvulnerable?.()) continue;
      const inRange = active.filter(
        mushroom => mushroom.inArea(target, mushroom.burstWidth, mushroom.burstHeight)
      );
      if (!inRange.length) continue;

      // A single nearby mine is dangerous, while clustering several pays off.
      // The cap keeps four simultaneous explosions survivable at full health.
      const damage = Math.min(34, 18 + (inRange.length - 1) * 5);
      target.takeDamage(damage);
      target.hitFlash = Math.max(target.hitFlash || 0, 0.17);
      target.applyDizziness?.(0.72);
      target.applyPurpleSpores?.(1.4);
      if (target.health <= 0) target.dead = true;
    }

    for (const mushroom of active) mushroom.spraySpores(game);
    return true;
  }

  spraySpores(game) {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      const speed = 170 + (i % 4) * 26;
      const spore = new MushroomSpore({
        owner:this.owner,
        x:this.x, y:this.y - 22,
        vx:Math.cos(angle) * speed,
        vy:Math.sin(angle) * speed - 65,
        width:11 + (i % 3) * 2,
        height:11 + (i % 3) * 2,
        life:0.72 + (i % 3) * 0.09,
        gravity:145,
        damage:0,
        knockback:0,
        color:i % 3 ? '#b66ced' : '#ead0fa'
      });
      // The burst damage was resolved above. Particles are visual only.
      spore.nonCombat = true;
      spore.ignoresTerrain = true;
      game.projectiles.spawn(spore);
    }
  }

  render(ctx) {
    if (this.age >= this.growTime && !this.dead) {
      ctx.save();
      ctx.strokeStyle = 'rgba(170, 88, 220, 0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - 4, 18 + Math.sin(this.age * 5) * 3, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    super.render(ctx);
  }
}

class Mushroom extends Weapon {
  constructor() {
    super({
      id:'mushroom',
      name:'MUSHROOM',
      damage:1,
      cooldown:0.72,
      knockback:12,
      recoil:12,
      muzzleOffset:42
    });
    this.chargeRate = 6;
    this.chargeOnHit = 1.5;
    this.qChargeCost = 50;
    this.qCooldown = 1.6;
    this.qCooldownRemaining = 0;
    this.eCooldown = 3.0;
    this.eCooldownRemaining = 0;
    this.purpleSeedCount = 4;
    this.maxPurpleMushrooms = 4;
    this.sporesPerSpray = 4;
    this.seedCount = 4;
    this.maxMushrooms = 5;
    this.sprites = {
      weapon:this.loadSprite('mushroom.png'),
      green:this.loadSprite('green-mushroom.png'),
      purple:this.loadSprite('purple-mushroom.png')
    };
  }

  loadSprite(file) {
    const image = new Image();
    image.src = 'assets/sprites/mushroom/' + file;
    return image;
  }

  update(dt, context) {
    super.update(dt, context);
    this.qCooldownRemaining = Math.max(0, this.qCooldownRemaining - dt);
    this.eCooldownRemaining = Math.max(0, this.eCooldownRemaining - dt);
  }

  muzzle(mount) {
    return mount.muzzle(this.muzzleOffset);
  }

  primary({ mount, projectiles, player, game }) {
    if (!projectiles || !player || !this.beginUse()) return false;
    const muzzle = this.muzzle(mount);
    const angle = Math.atan2(mount.dirY, mount.dirX);
    const offsets = [-0.22, -0.07, 0.07, 0.22];

    for (const offset of offsets) {
      const a = angle + offset;
      const speed = 400 + Math.random() * 35;
      projectiles.spawn(new MushroomSpore({
        owner:player,
        x:muzzle.x, y:muzzle.y,
        vx:Math.cos(a) * speed,
        vy:Math.sin(a) * speed,
        damage:this.damage * player.buffMultiplier('damage'),
        knockback:this.knockback,
        life:0.52,
        width:11, height:11,
        color:'#f8d58c',
        onHit:(target) => {
          if (target?.isInvulnerable?.()) return;
          target.applyDizziness?.(1.2);
          game?.gainCharge?.(this.chargeOnHit);
        }
      }));
    }
    mount.applyRecoil(this.recoil);
    return true;
  }

  // Q: requires 50 charge and spends it at launch. Each seed makes one hazard
  // only after crossing an actual ground top, not after an arbitrary timeout.
  reload({ mount, projectiles, player, game }) {
    if (!projectiles || !game?.hasCharge?.(this.qChargeCost) ||
        this.qCooldownRemaining > 0 || !player) return false;
    if (!game.consumeCharge(this.qChargeCost)) return false;

    const muzzle = this.muzzle(mount);
    for (let i = 0; i < this.seedCount; i++) {
      const spread = i - (this.seedCount - 1) * 0.5;
      projectiles.spawn(new MushroomSeed({
        owner:player,
        x:muzzle.x, y:muzzle.y,
        vx:mount.dirX * 285 + spread * 92,
        vy:Math.min(-210, mount.dirY * 200 - 260) - Math.abs(spread) * 32,
        damage:0, knockback:0,
        life:3.8, width:14, height:14, color:'#72df82',
        onPlant:(x, y) => {
          const hazards = game.game?.hazards || [];
          const owned = hazards.filter(h => h instanceof GreenMushroom && h.owner === player && !h.dead);
          if (owned.length >= this.maxMushrooms) owned[0].dead = true;
          game.addHazard(new GreenMushroom({
            x, y, owner:player, sprite:this.sprites.green
          }));
        }
      }));
    }
    this.qCooldownRemaining = this.qCooldown;
    mount.applyRecoil(25);
    return true;
  }

  // E: spend the entire meter to plant synchronized purple mines.
  // Passing above any mature mine makes all mines from this owner burst.
  special({ mount, projectiles, player, game }) {
    if (!projectiles || !player || player.dead || !game?.hasFullCharge?.() ||
        this.eCooldownRemaining > 0) return false;
    if (!game.consumeFullCharge()) return false;

    const muzzle = this.muzzle(mount);
    for (let i = 0; i < this.purpleSeedCount; i++) {
      const spread = i - (this.purpleSeedCount - 1) * 0.5;
      projectiles.spawn(new MushroomSeed({
        owner:player,
        x:muzzle.x, y:muzzle.y,
        vx:mount.dirX * 265 + spread * 106,
        vy:Math.min(-230, mount.dirY * 190 - 295) - Math.abs(spread) * 38,
        damage:0,
        knockback:0,
        life:4.0, width:15, height:15, color:'#b66ced',
        onPlant:(x, y) => {
          if (player.dead) return;
          const hazards = game.game?.hazards || [];
          const owned = hazards.filter(
            h => h instanceof PurpleMushroom && h.owner === player && !h.dead
          );
          while (owned.length >= this.maxPurpleMushrooms) {
            owned.shift().dead = true;
          }
          game.addHazard(new PurpleMushroom({
            x, y, owner:player, sprite:this.sprites.purple
          }));
        }
      }));
    }
    this.eCooldownRemaining = this.eCooldown;
    mount.applyRecoil(32);
    return true;
  }

  attackReadiness(game) {
    const primary = MathEx.clamp(1 - this.cooldownRemaining / this.cooldown, 0, 1);
    const qReady = MathEx.clamp(1 - this.qCooldownRemaining / this.qCooldown, 0, 1);
    const eReady = MathEx.clamp(1 - this.eCooldownRemaining / this.eCooldown, 0, 1);
    return [
      primary,
      game?.hasCharge?.(this.qChargeCost) ? qReady : 0,
      game?.hasFullCharge?.() ? eReady : 0
    ];
  }

  render(ctx, { mount }) {
    const p = mount.position();
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    ctx.rotate(Math.round((mount.angle + Math.PI * 0.5) / (Math.PI / 16)) * (Math.PI / 16));
    ctx.imageSmoothingEnabled = false;
    if (this.sprites.weapon.complete && this.sprites.weapon.naturalWidth > 0) {
      ctx.drawImage(this.sprites.weapon, -29, -48, 58, 58);
    } else {
      ctx.fillStyle = '#252525';
      ctx.fillRect(-8, -34, 16, 49);
      ctx.fillStyle = '#ef7f3b';
      ctx.fillRect(-18, -39, 36, 24);
    }
    ctx.restore();
  }
}
