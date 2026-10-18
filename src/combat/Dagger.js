'use strict';

class DaggerBlinkTrail {
  constructor({ x0, y0, x1, y1, bodyColor = '#d7dce3', duration = 0.22 } = {}) {
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
    const count = 4;

    ctx.save();
    ctx.globalAlpha *= alpha;
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const x = MathEx.lerp(this.x0, this.x1, t);
      const y = MathEx.lerp(this.y0, this.y1, t);
      const size = 28 + t * 10;

      ctx.fillStyle = '#202020';
      ctx.fillRect(
        Math.round(x - size / 2 - 2),
        Math.round(y - size / 2 - 2),
        Math.round(size + 4),
        Math.round(size + 4)
      );
      ctx.fillStyle = this.bodyColor;
      ctx.fillRect(
        Math.round(x - size / 2),
        Math.round(y - size / 2),
        Math.round(size),
        Math.round(size)
      );
    }
    ctx.restore();
  }
}

class DaggerStuckEffect {
  constructor({ target, duration = 3, sprite = null, visualSize = 82 } = {}) {
    this.target = target;
    this.duration = duration;
    this.age = 0;
    this.dead = false;
    this.sprite = sprite;
    this.visualSize = visualSize;
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
    ctx.translate(
      Math.round(this.target.x + this.offsetX),
      Math.round(this.target.y + this.offsetY)
    );
    ctx.rotate(this.angle + Math.PI * 0.5);
    ctx.imageSmoothingEnabled = false;

    if (this.sprite?.complete && this.sprite.naturalWidth > 0) {
      const scale = this.visualSize / Math.max(this.sprite.naturalWidth, this.sprite.naturalHeight);
      const w = Math.max(1, Math.round(this.sprite.naturalWidth * scale));
      const h = Math.max(1, Math.round(this.sprite.naturalHeight * scale));
      ctx.drawImage(this.sprite, -Math.round(w * 0.5), -Math.round(h * 0.5), w, h);
    } else {
      ctx.fillStyle = '#202020';
      ctx.fillRect(-30, -6, 60, 12);
      ctx.fillStyle = '#d7dce3';
      ctx.fillRect(-27, -3, 54, 6);
    }

    ctx.restore();
  }
}

class DaggerProjectile extends Projectile {
  constructor({ sprite = null, visualSize = 82, spinSpeed = 18, ...options } = {}) {
    super(options);
    this.sprite = sprite;
    this.visualSize = visualSize;
    this.spinSpeed = spinSpeed;
    this.spinAngle = 0;
    this.noPhysicalHit = true;
    this.hitRadius = Math.max(10, visualSize * 0.18);
  }

  update(dt) {
    super.update(dt);
    this.spinAngle += this.spinSpeed * dt;
  }

  render(ctx) {
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.rotate(this.angle + Math.PI * 0.5 + this.spinAngle);
    ctx.imageSmoothingEnabled = false;

    if (this.sprite?.complete && this.sprite.naturalWidth > 0) {
      const scale = this.visualSize / Math.max(this.sprite.naturalWidth, this.sprite.naturalHeight);
      const w = Math.max(1, Math.round(this.sprite.naturalWidth * scale));
      const h = Math.max(1, Math.round(this.sprite.naturalHeight * scale));
      ctx.drawImage(this.sprite, -Math.round(w * 0.5), -Math.round(h * 0.5), w, h);
    } else {
      ctx.fillStyle = '#202020';
      ctx.fillRect(-30, -6, 60, 12);
      ctx.fillStyle = '#d7dce3';
      ctx.fillRect(-27, -3, 54, 6);
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

    this.visualSize = 82;
    this.returnDuration = 0.85;
    this.returnRemaining = 0;

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
    this.returnRemaining = Math.max(0, this.returnRemaining - dt);
  }

  primary({ mount, player, game }) {
    if (!player || !game || this.blinkCooldownRemaining > 0 || this.returnRemaining > 0) return false;

    const cloaked = this.isCloaked();
    const directionLength = MathEx.hypot(mount.dirX, mount.dirY) || 1;
    const dirX = mount.dirX / directionLength;
    const dirY = mount.dirY / directionLength;

    const started = game.startPlayerAttackRagdoll?.({
      weapon:this,
      duration:cloaked ? 0.44 : 0.38,
      dirX,
      dirY,
      speed:cloaked ? 930 : 790,
      damage:cloaked ? 21 : 15,
      knockback:cloaked ? 390 : 320
    });

    if (!started) return false;
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
      owner:player,
      sprite:this.sprite,
      visualSize:this.visualSize,
      x:hand.x + mount.dirX * 28,
      y:hand.y + mount.dirY * 28,
      vx:mount.dirX * speed,
      vy:mount.dirY * speed,
      damage:5 * player.buffMultiplier('damage'),
      knockback:0,
      life:2.2,
      width:this.visualSize,
      height:this.visualSize * 0.26,
      color:'#d7dce3',
      outlineColor:'#202020',
      outlineWidth:3,
      onHit:(target) => {
        target.applyBleed?.(dotDuration, dotDps);
        game.addHazard(new DaggerStuckEffect({
          target,
          duration:dotDuration,
          sprite:this.sprite,
          visualSize:this.visualSize
        }));
      }
    });

    projectiles.spawn(projectile);
    this.throwCooldownRemaining = this.throwCooldown;
    this.returnRemaining = this.returnDuration;
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

  spawnRushTrail(game, x0, y0, x1, y1, player) {
    game.addHazard(new DaggerBlinkTrail({
      x0,
      y0,
      x1,
      y1,
      bodyColor:player.appearance?.body || '#d7dce3'
    }));
  }

  drawHeld(ctx, x, y, angle, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= MathEx.clamp(alpha, 0, 1);
    ctx.translate(Math.round(x), Math.round(y));

    // dagger.png points upward. Rotating +90 degrees makes its blade follow the
    // aim direction, while the bottom-center pivot stays in the fighter's hand.
    ctx.rotate(angle + Math.PI * 0.5);
    ctx.imageSmoothingEnabled = false;

    if (this.imageReady(this.sprite)) {
      const scale = this.visualSize / Math.max(this.sprite.naturalWidth, this.sprite.naturalHeight);
      const w = Math.max(1, Math.round(this.sprite.naturalWidth * scale));
      const h = Math.max(1, Math.round(this.sprite.naturalHeight * scale));

      // Bottom-center is the rotation pivot. The entire sprite sits above the
      // hand, so the hand lines up with the handle rather than the blade.
      ctx.drawImage(
        this.sprite,
        -Math.round(w * 0.5),
        -h,
        w,
        h
      );
    } else {
      ctx.fillStyle = '#202020';
      ctx.fillRect(-6, -72, 12, 72);
      ctx.fillStyle = '#d7dce3';
      ctx.fillRect(-3, -68, 6, 62);
    }

    ctx.restore();
  }

  renderRagdoll(ctx, ragdoll, data) {
    if (!ragdoll || !data) return;
    const dirX = data.aimDirX ?? 1;
    const dirY = data.aimDirY ?? 0;
    const angle = Math.atan2(dirY, dirX);
    this.drawHeld(ctx, ragdoll.hand.x, ragdoll.hand.y, angle, 1);
  }

  render(ctx, { mount }) {
    const p = mount.position();
    const alpha = this.returnRemaining > 0
      ? 1 - this.returnRemaining / this.returnDuration
      : 1;

    this.drawHeld(ctx, p.x, p.y, mount.angle, alpha);
  }
}
