'use strict';

class WandStarProjectile extends Projectile {
  constructor({
    sprite = null,
    size = 24,
    spinSpeed = 7,
    ignoresTerrain = false,
    pierceTargets = false,
    homingTurnRate = 0,
    fadeOut = false,
    ...options
  } = {}) {
    super({ width:size, height:size, ...options });
    this.sprite = sprite;
    this.size = size;
    this.spinSpeed = spinSpeed;
    this.spinAngle = 0;
    this.ignoresTerrain = ignoresTerrain;
    this.pierceTargets = pierceTargets;
    this.homingTurnRate = homingTurnRate;
    this.fadeOut = fadeOut;
    this.initialLife = this.life;
    this.hitTargets = new Set();
  }

  nearestTarget(targets = []) {
    let best = null;
    let bestDistance = Infinity;
    for (const target of targets) {
      if (!target || target === this.owner || target.dead || !target.hitbox || this.hitTargets.has(target)) continue;
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = target;
      }
    }
    return best;
  }

  updateHoming(dt, targets) {
    if (this.homingTurnRate <= 0) return;
    const target = this.nearestTarget(targets);
    if (!target) return;

    const speed = MathEx.hypot(this.vx, this.vy);
    if (speed <= 0.001) return;

    const current = Math.atan2(this.vy, this.vx);
    const desired = Math.atan2(target.y - this.y, target.x - this.x);
    let delta = desired - current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    const maxTurn = this.homingTurnRate * dt;
    const angle = current + MathEx.clamp(delta, -maxTurn, maxTurn);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt, context = {}) {
    this.updateHoming(dt, context.targets || []);
    super.update(dt);
    this.spinAngle += this.spinSpeed * dt;
  }

  render(ctx) {
    ctx.save();
    ctx.globalAlpha = this.fadeOut
      ? MathEx.clamp(this.life / Math.max(0.001, this.initialLife), 0, 1)
      : 1;
    ctx.translate(Math.round(this.x), Math.round(this.y));

    // Quantized rotation keeps the low-resolution star art crunchy while moving.
    const step = Math.PI / 8;
    ctx.rotate(Math.round(this.spinAngle / step) * step);
    ctx.imageSmoothingEnabled = false;

    if (this.sprite?.complete && this.sprite.naturalWidth > 0) {
      const rawScale = this.size / Math.max(this.sprite.naturalWidth, this.sprite.naturalHeight);
      const scale = rawScale >= 1 ? Math.max(1, Math.floor(rawScale)) : rawScale;
      const width = Math.max(1, Math.round(this.sprite.naturalWidth * scale));
      const height = Math.max(1, Math.round(this.sprite.naturalHeight * scale));
      ctx.drawImage(this.sprite, Math.round(-width / 2), Math.round(-height / 2), width, height);
    } else {
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    }

    ctx.restore();
  }
}

class WandBouncingStar extends WandStarProjectile {
  constructor({ system = null, smallSprite = null, ...options } = {}) {
    super({ ...options, pierceTargets:true, ignoresTerrain:true });
    this.system = system;
    this.smallSprite = smallSprite;
    this.terrainBounces = 0;
    this.bounceLock = 0;
    this.handlesTerrain = true;
    this.hitRadius = this.size * 0.46;
    this.noPhysicalHit = true;
  }

  circleTouchesRect(rect) {
    const closestX = MathEx.clamp(this.x, rect.x, rect.x + rect.w);
    const closestY = MathEx.clamp(this.y, rect.y, rect.y + rect.h);
    const dx = this.x - closestX;
    const dy = this.y - closestY;
    return dx * dx + dy * dy <= this.hitRadius * this.hitRadius;
  }

  burst() {
    if (this.dead) return;
    this.dead = true;
    if (!this.system) return;

    const count = 12;
    const speed = 520;
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2;
      this.system.spawn(new WandStarProjectile({
        x:this.x,
        y:this.y,
        vx:Math.cos(angle) * speed,
        vy:Math.sin(angle) * speed,
        damage:5,
        knockback:130,
        life:2.4,
        size:32,
        color:'#fff3a6',
        sprite:this.smallSprite,
        spinSpeed:10,
        ignoresTerrain:true,
        onHit:this.onHit,
        owner:this.owner
      }));
    }
  }

  resolveBounce(prevX, prevY, rect) {
    const r = this.hitRadius;
    const closestX = MathEx.clamp(this.x, rect.x, rect.x + rect.w);
    const closestY = MathEx.clamp(this.y, rect.y, rect.y + rect.h);
    let nx = this.x - closestX;
    let ny = this.y - closestY;
    let length = MathEx.hypot(nx, ny);

    if (length > 0.001) {
      nx /= length;
      ny /= length;
      this.x = closestX + nx * (r + 1);
      this.y = closestY + ny * (r + 1);
    } else {
      // If the center crossed fully into a block in one fixed step, use the
      // incoming direction to choose the face that was approached.
      if (Math.abs(this.vx) > Math.abs(this.vy)) {
        nx = this.vx > 0 ? -1 : 1;
        ny = 0;
      } else {
        nx = 0;
        ny = this.vy > 0 ? -1 : 1;
      }
      this.x = prevX + nx * 2;
      this.y = prevY + ny * 2;
    }

    // Reflect the velocity across the collision normal. This preserves the
    // incoming angle instead of forcing a canned horizontal/vertical bounce.
    let dot = this.vx * nx + this.vy * ny;
    if (dot > 0) {
      nx = -nx;
      ny = -ny;
      dot = -dot;
    }
    this.vx -= 2 * dot * nx;
    this.vy -= 2 * dot * ny;
  }

  update(dt, context = {}) {
    const prevX = this.x;
    const prevY = this.y;
    this.bounceLock = Math.max(0, this.bounceLock - dt);
    super.update(dt, context);
    if (this.dead || this.bounceLock > 0) return;

    const rectangles = context.terrain?.rectangles || [];
    for (const rect of rectangles) {
      if (!this.circleTouchesRect(rect)) continue;

      this.terrainBounces += 1;
      if (this.terrainBounces >= 2) {
        this.burst();
        return;
      }

      this.resolveBounce(prevX, prevY, rect);
      this.bounceLock = 0.055;
      return;
    }
  }
}

class Wand extends Weapon {
  constructor() {
    super({
      id:'wand',
      name:'WAND',
      damage:7,
      cooldown:0.22,
      knockback:110,
      recoil:30,
      muzzleOffset:48
    });

    this.primarySpeed = 720;
    this.smallStarSize = 32;
    this.largeStarSize = 68;
    this.qCooldown = 1.0;
    this.eCooldown = 1.5;
    this.chargeRate = 7;
    this.chargeOnHit = 2;
    this.qCooldownRemaining = 0;
    this.eCooldownRemaining = 0;

    this.spriteRoot = 'assets/sprites/wand/';
    this.sprites = {
      wand:this.loadSprite('wand.png'),
      small:this.loadSprite('star-small.png'),
      large:this.loadSprite('star-large.png')
    };
  }

  loadSprite(file) {
    const image = new Image();
    image.src = this.spriteRoot + file;
    return image;
  }

  imageReady(image) {
    return !!image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  }

  update(dt, context) {
    super.update(dt, context);
    this.qCooldownRemaining = Math.max(0, this.qCooldownRemaining - dt);
    this.eCooldownRemaining = Math.max(0, this.eCooldownRemaining - dt);
  }

  muzzle(mount, distance = this.muzzleOffset) {
    const hand = mount.position();
    return {
      x:hand.x + mount.dirX * distance,
      y:hand.y + mount.dirY * distance
    };
  }

  primary({ mount, projectiles, player, game }) {
    if (!projectiles || !this.beginUse()) return false;

    const muzzle = this.muzzle(mount);
    projectiles.spawn(new WandStarProjectile({
      owner:player,
      x:muzzle.x,
      y:muzzle.y,
      vx:mount.dirX * this.primarySpeed,
      vy:mount.dirY * this.primarySpeed,
      damage:this.damage,
      knockback:this.knockback,
      life:3.2,
      size:this.smallStarSize,
      color:'#fff3a6',
      sprite:this.sprites.small,
      spinSpeed:11,
      ignoresTerrain:true,
      onHit:() => game?.gainCharge(this.chargeOnHit)
    }));

    mount.applyRecoil(this.recoil);
    return true;
  }

  // Q slot. Three lightly-homing stars in a small fan around the aim direction.
  reload({ mount, projectiles, player, game }) {
    if (!projectiles || this.qCooldownRemaining > 0) return false;

    const muzzle = this.muzzle(mount);
    const base = Math.atan2(mount.dirY, mount.dirX);
    const spread = 0.34;
    const speed = 560;

    for (const offset of [-spread, 0, spread]) {
      const angle = base + offset;
      projectiles.spawn(new WandStarProjectile({
        owner:player,
        x:muzzle.x,
        y:muzzle.y,
        vx:Math.cos(angle) * speed,
        vy:Math.sin(angle) * speed,
        damage:4,
        knockback:85,
        life:3,
        size:this.smallStarSize,
        color:'#fff3a6',
        sprite:this.sprites.small,
        spinSpeed:9,
        homingTurnRate:1.45,
        fadeOut:true,
        onHit:() => game?.gainCharge(this.chargeOnHit)
      }));
    }

    this.qCooldownRemaining = this.qCooldown;
    return true;
  }

  // E slot. The large star ignores fighters physically, damages each fighter
  // once while passing through, ricochets once, then bursts on the second impact.
  special({ mount, projectiles, player, game }) {
    if (!projectiles || this.eCooldownRemaining > 0 || !game?.hasFullCharge()) return false;

    const muzzle = this.muzzle(mount, 54);
    const speed = 540;
    projectiles.spawn(new WandBouncingStar({
      owner:player,
      system:projectiles,
      smallSprite:this.sprites.small,
      x:muzzle.x,
      y:muzzle.y,
      vx:mount.dirX * speed,
      vy:mount.dirY * speed,
      damage:6,
      knockback:0,
      life:7,
      size:this.largeStarSize,
      color:'#ffe56b',
      sprite:this.sprites.large,
      spinSpeed:6,
      onHit:() => game?.gainCharge(this.chargeOnHit)
    }));

    game.consumeFullCharge();
    this.eCooldownRemaining = this.eCooldown;
    return true;
  }

  attackReadiness(game) {
    const primary = this.cooldown > 0
      ? MathEx.clamp(1 - this.cooldownRemaining / this.cooldown, 0, 1)
      : 1;
    const attack2 = MathEx.clamp(1 - this.qCooldownRemaining / this.qCooldown, 0, 1);
    const eCooldown = MathEx.clamp(1 - this.eCooldownRemaining / this.eCooldown, 0, 1);
    const attack3 = game?.hasFullCharge() ? eCooldown : 0;
    return [primary, attack2, attack3];
  }

  render(ctx, { mount }) {
    const p = mount.position();
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));

    const step = Math.PI / 16;
    // wand.png is drawn tip-up. Rotate that local -Y axis onto the aim vector so
    // the actual tip, rather than the side of the sprite, always points outward.
    const artAngle = mount.angle + Math.PI * 0.5;
    ctx.rotate(Math.round(artAngle / step) * step);
    ctx.imageSmoothingEnabled = false;

    if (this.imageReady(this.sprites.wand)) {
      const desired = 72;
      const rawScale = desired / Math.max(this.sprites.wand.naturalWidth, this.sprites.wand.naturalHeight);
      const scale = rawScale >= 1 ? Math.max(1, Math.floor(rawScale)) : rawScale;
      const width = Math.max(1, Math.round(this.sprites.wand.naturalWidth * scale));
      const height = Math.max(1, Math.round(this.sprites.wand.naturalHeight * scale));
      // Keep the hand near the lower end of the wand while the tip extends along aim.
      ctx.drawImage(this.sprites.wand, -Math.round(width * 0.5), -Math.round(height * 0.78), width, height);
    } else {
      ctx.fillStyle = '#202020';
      ctx.fillRect(-8, -4, 50, 8);
      ctx.fillStyle = '#d5c28c';
      ctx.fillRect(-5, -2, 44, 4);
    }

    ctx.restore();
  }
}
