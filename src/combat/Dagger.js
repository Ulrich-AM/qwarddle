'use strict';

class DaggerBlinkTrail {
  constructor({ x0, y0, x1, y1, bodyColor = '#d7dce3', duration = 0.28 } = {}) {
    Object.assign(this, { x0, y0, x1, y1, bodyColor, duration });
    this.age = 0;
    this.dead = false;
  }

  update(dt) {
    this.age += dt;
    if (this.age >= this.duration) this.dead = true;
  }

  render(ctx) {
    const alpha = MathEx.clamp(1 - this.age / this.duration, 0, 1) * 0.35;
    const count = 7;

    ctx.save();
    ctx.globalAlpha *= alpha;
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const x = MathEx.lerp(this.x0, this.x1, t);
      const y = MathEx.lerp(this.y0, this.y1, t);
      const size = 30 + t * 14;
      ctx.fillStyle = '#202020';
      ctx.fillRect(Math.round(x - size / 2 - 2), Math.round(y - size / 2 - 2), Math.round(size + 4), Math.round(size + 4));
      ctx.fillStyle = this.bodyColor;
      ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), Math.round(size), Math.round(size));
    }
    ctx.restore();
  }
}

class DaggerStuckEffect {
  constructor({ target, duration = 3, sprite = null } = {}) {
    this.target = target;
    this.duration = duration;
    this.age = 0;
    this.dead = false;
    this.sprite = sprite;
    this.offsetX = (Math.random() - 0.5) * 18;
    this.offsetY = -4 + (Math.random() - 0.5) * 16;
    this.angle = (Math.random() - 0.5) * 1.1;
  }

  update(dt) {
    this.age += dt;
    if (this.age >= this.duration || !this.target) this.dead = true;
  }

  render(ctx) {
    if (this.dead || !this.target) return;
    ctx.save();
    ctx.translate(Math.round(this.target.x + this.offsetX), Math.round(this.target.y + this.offsetY));
    ctx.rotate(this.angle);
    ctx.imageSmoothingEnabled = false;

    if (this.sprite?.complete && this.sprite.naturalWidth > 0) {
      const desired = 38;
      const scale = desired / Math.max(this.sprite.naturalWidth, this.sprite.naturalHeight);
      const w = Math.max(1, Math.round(this.sprite.naturalWidth * scale));
      const h = Math.max(1, Math.round(this.sprite.naturalHeight * scale));
      ctx.drawImage(this.sprite, -Math.round(w * 0.45), -Math.round(h * 0.5), w, h);
    } else {
      ctx.fillStyle = '#202020';
      ctx.fillRect(-19, -5, 38, 10);
      ctx.fillStyle = '#d7dce3';
      ctx.fillRect(-17, -3, 34, 6);
    }

    ctx.restore();
  }
}

class DaggerProjectile extends Projectile {
  constructor({ sprite = null, ...options } = {}) {
    super(options);
    this.sprite = sprite;
    this.noPhysicalHit = true;
    this.hitRadius = 8;
  }

  render(ctx) {
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.rotate(this.angle);
    ctx.imageSmoothingEnabled = false;

    if (this.sprite?.complete && this.sprite.naturalWidth > 0) {
      const desired = 42;
      const scale = desired / Math.max(this.sprite.naturalWidth, this.sprite.naturalHeight);
      const w = Math.max(1, Math.round(this.sprite.naturalWidth * scale));
      const h = Math.max(1, Math.round(this.sprite.naturalHeight * scale));
      ctx.drawImage(this.sprite, -Math.round(w * 0.45), -Math.round(h * 0.5), w, h);
    } else {
      ctx.fillStyle = '#202020';
      ctx.fillRect(-22, -5, 44, 10);
      ctx.fillStyle = '#d7dce3';
      ctx.fillRect(-20, -3, 40, 6);
    }

    ctx.restore();
  }
}

class Dagger extends Weapon {
  constructor() {
    super({
      id:'dagger',
      name:'DAGGER',
      damage:0,
      cooldown:0,
      knockback:0,
      recoil:0,
      muzzleOffset:38
    });

    this.blinkCooldown = 3;
    this.throwCooldown = 5;
    this.cloakCooldown = 17;

    this.blinkCooldownRemaining = 0;
    this.throwCooldownRemaining = 0;
    this.cloakCooldownRemaining = 0;

    this.cloakDuration = 8;
    this.cloakRemaining = 0;
    this.cloakIframeDuration = 4;

    this.spriteRoot = 'assets/sprites/dagger/';
    this.sprite = this.loadSprite('dagger.png');
  }

  loadSprite(file) {
    const image = new Image();
    image.src = this.spriteRoot + file;
    return image;
  }

  imageReady(image) {
    return !!image && image.complete && image.naturalWidth > 0;
  }

  isCloaked() {
    return this.cloakRemaining > 0;
  }

  update(dt) {
    super.update(dt);
    this.blinkCooldownRemaining = Math.max(0, this.blinkCooldownRemaining - dt);
    this.throwCooldownRemaining = Math.max(0, this.throwCooldownRemaining - dt);
    this.cloakCooldownRemaining = Math.max(0, this.cloakCooldownRemaining - dt);
    this.cloakRemaining = Math.max(0, this.cloakRemaining - dt);
  }

  bodyOverlapsTerrain(player, x, y) {
    const box = player.collisionBox(x, y);
    for (const rect of player.terrain.rectangles || []) {
      if (box.right <= rect.x || box.left >= rect.x + rect.w ||
          box.bottom <= rect.y || box.top >= rect.y + rect.h) {
        continue;
      }
      return true;
    }
    return false;
  }

  pointSegmentDistance(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length2 = dx * dx + dy * dy;
    if (length2 <= 0.0001) return MathEx.hypot(px - x0, py - y0);

    const t = MathEx.clamp(((px - x0) * dx + (py - y0) * dy) / length2, 0, 1);
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    return MathEx.hypot(px - x, py - y);
  }

  primary({ mount, player, game }) {
    if (!player || !game || this.blinkCooldownRemaining > 0) return false;

    const cloaked = this.isCloaked();
    const distance = cloaked ? 270 : 215;
    const damage = cloaked ? 20 : 14;
    const x0 = player.x;
    const y0 = player.y;

    let dirX = mount.dirX;
    let dirY = mount.dirY;
    const length = MathEx.hypot(dirX, dirY) || 1;
    dirX /= length;
    dirY /= length;

    const steps = Math.max(10, Math.ceil(distance / 16));
    let x = x0;
    let y = y0;

    for (let i = 1; i <= steps; i++) {
      const candidateX = x0 + dirX * distance * (i / steps);
      const candidateY = y0 + dirY * distance * (i / steps);
      if (this.bodyOverlapsTerrain(player, candidateX, candidateY)) break;
      x = candidateX;
      y = candidateY;
    }

    player.x = x;
    player.y = y;
    player.vx = dirX * 260;
    player.vy = dirY * 180;
    player.onGround = false;
    player.releaseFeetToAir?.();
    player.resolveBodyPenetration?.();

    game.addHazard(new DaggerBlinkTrail({
      x0,
      y0,
      x1:player.x,
      y1:player.y,
      bodyColor:player.appearance?.body || '#d7dce3'
    }));

    for (const target of game.getTargetableActors()) {
      if (!target || target === player || target.dead) continue;
      const hitRadius = Math.max(target.cfg?.bodyW || 58, target.cfg?.bodyH || 58) * 0.72;
      if (this.pointSegmentDistance(target.x, target.y, x0, y0, player.x, player.y) > hitRadius) continue;
      if (target.isInvulnerable?.()) continue;

      target.takeDamage(damage * player.buffMultiplier('damage'));
      target.vx += dirX * 280;
      target.vy += dirY * 100 - 45;
      if (target.health <= 0 && 'dead' in target) target.dead = true;
    }

    this.blinkCooldownRemaining = this.blinkCooldown;
    return true;
  }

  reload({ mount, projectiles, player, game }) {
    if (!projectiles || !player || !game || this.throwCooldownRemaining > 0) return false;

    const cloaked = this.isCloaked();
    const speed = cloaked ? 1260 : 900;
    const dotDuration = cloaked ? 6 : 3;
    const dotDps = cloaked ? 5.5 : 4.5;
    const hand = mount.position();

    const projectile = new DaggerProjectile({
      sprite:this.sprite,
      x:hand.x + mount.dirX * 28,
      y:hand.y + mount.dirY * 28,
      vx:mount.dirX * speed,
      vy:mount.dirY * speed,
      damage:5 * player.buffMultiplier('damage'),
      knockback:0,
      life:2.2,
      width:42,
      height:10,
      color:'#d7dce3',
      outlineColor:'#202020',
      outlineWidth:3,
      onHit:(target) => {
        target.applyBleed?.(dotDuration, dotDps);
        game.addHazard(new DaggerStuckEffect({
          target,
          duration:dotDuration,
          sprite:this.sprite
        }));
      }
    });

    projectiles.spawn(projectile);
    this.throwCooldownRemaining = this.throwCooldown;
    return true;
  }

  special({ player } = {}) {
    if (!player || this.cloakCooldownRemaining > 0 || this.isCloaked()) return false;

    this.cloakRemaining = this.cloakDuration;
    this.cloakCooldownRemaining = this.cloakCooldown;
    player.addBuff('dagger-cloak', this.cloakDuration, { opacity:0.35 });
    player.addBuff('dagger-cloak-iframe', this.cloakIframeDuration, { invulnerable:true });
    return true;
  }

  attackReadiness() {
    return [
      MathEx.clamp(1 - this.blinkCooldownRemaining / this.blinkCooldown, 0, 1),
      MathEx.clamp(1 - this.throwCooldownRemaining / this.throwCooldown, 0, 1),
      MathEx.clamp(1 - this.cloakCooldownRemaining / this.cloakCooldown, 0, 1)
    ];
  }

  render(ctx, { mount }) {
    const p = mount.position();

    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    const step = Math.PI / 32;
    ctx.rotate(Math.round(mount.angle / step) * step);
    if (mount.dirX < 0) ctx.scale(1, -1);
    ctx.imageSmoothingEnabled = false;

    if (this.imageReady(this.sprite)) {
      const desired = 58;
      const scale = desired / Math.max(this.sprite.naturalWidth, this.sprite.naturalHeight);
      const w = Math.max(1, Math.round(this.sprite.naturalWidth * scale));
      const h = Math.max(1, Math.round(this.sprite.naturalHeight * scale));
      ctx.drawImage(this.sprite, -Math.round(w * 0.42), -Math.round(h * 0.5), w, h);
    } else {
      ctx.fillStyle = '#202020';
      ctx.fillRect(-27, -6, 54, 12);
      ctx.fillStyle = '#d7dce3';
      ctx.fillRect(-24, -3, 48, 6);
    }

    ctx.restore();
  }
}
