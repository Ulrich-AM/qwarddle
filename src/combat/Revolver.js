'use strict';

class Revolver extends Weapon {
  constructor() {
    super({
      id:'revolver',
      name:'REVOLVER',
      damage:23,
      cooldown:0,
      knockback:390,
      recoil:285,
      muzzleOffset:58
    });

    this.projectileSpeed = 1080;
    this.capacity = 6;
    this.rounds = Array(this.capacity).fill('normal');
    this.chamberCursor = 0;

    // Each shot spins the held revolver once. This animation IS the fire cooldown.
    this.shotSpinDuration = 0.19;
    this.shotSpinRemaining = 0;
    this.shotSpinAngle = 0;

    // Q: quick top-up reload. Preserves whatever is still in the cylinder and
    // appends normal rounds to the end of the firing order.
    this.reloadDuration = 0.58;
    this.reloadRemaining = 0;
    this.reloadSpinAngle = 0;
    this.reloadTurns = 1;
    this.reloadStartHudAngle = 0;

    // E: dump everything, then load six charged rounds. Exactly two revolver spins.
    this.chargeDuration = 0.72;
    this.chargeRemaining = 0;
    this.chargeSpinAngle = 0;
    this.chargeTurns = 2;
    this.chargePending = false;

    this.hudAngle = 0;
    this.hudAngleTarget = 0;

    this.chargedDamage = 52;
    this.chargedKnockback = 820;
    this.chargedHandRecoil = 720;
    this.chargedBodyRecoil = 940;

    this.spriteRoot = 'assets/sprites/revolver/';
    this.normalChamberColor = '#aeb7c3';
    this.chargedChamberColor = '#ff0000';
    this.sprites = {
      cylinder:this.loadSprite('revolver-cylinder.png'),
      // Kept as the editable/source map. Runtime uses derived per-chamber masks
      // below so opening index.html through file:// never depends on canvas readback.
      cylinderBullets:this.loadSprite('revolver-cylinder-bullets.png'),
      round:this.loadSprite('revolver-round.png'),
      chargedRound:this.loadSprite('revolver-roundcharged.png')
    };

    this.chamberMasks = Array(this.capacity).fill(null);
    for (let i = 0; i < this.capacity; i++) {
      const chamberIndex = i;
      this.loadSprite(`chambers/chamber-${i + 1}.png`, (image) => {
        this.chamberMasks[chamberIndex] = {
          normal:this.tintMask(image, this.normalChamberColor),
          charged:this.tintMask(image, this.chargedChamberColor)
        };
      });
    }
  }

  loadSprite(file, onload = null) {
    const image = new Image();
    image.onload = () => onload?.(image);
    image.src = this.spriteRoot + file;
    return image;
  }

  sourceSize(image) {
    if (!image) return null;
    const width = image.naturalWidth || image.width || 0;
    const height = image.naturalHeight || image.height || 0;
    return width > 0 && height > 0 ? { width, height } : null;
  }

  imageReady(image) {
    if (!image) return false;
    if ('complete' in image && !image.complete) return false;
    return !!this.sourceSize(image);
  }

  drawImageFitted(ctx, image, centerX, centerY, maxWidth, maxHeight = maxWidth) {
    if (!this.imageReady(image)) return false;
    const source = this.sourceSize(image);
    const scale = Math.min(maxWidth / source.width, maxHeight / source.height);
    const width = source.width * scale;
    const height = source.height * scale;
    ctx.drawImage(image, centerX - width / 2, centerY - height / 2, width, height);
    return true;
  }

  tintMask(image, color) {
    if (!this.imageReady(image)) return null;

    const source = this.sourceSize(image);
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, source.width, source.height);
    ctx.globalCompositeOperation = 'source-over';
    return canvas;
  }

  get ammo() { return this.rounds.length; }

  smoothStep01(t) {
    t = MathEx.clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  easeOutCubic(t) {
    t = MathEx.clamp(t, 0, 1);
    return 1 - Math.pow(1 - t, 3);
  }

  isBusy() {
    return this.reloadRemaining > 0 || this.chargeRemaining > 0 || this.shotSpinRemaining > 0;
  }

  update(dt, context) {
    super.update(dt, context);

    if (this.shotSpinRemaining > 0) {
      this.shotSpinRemaining = Math.max(0, this.shotSpinRemaining - dt);
      const p = 1 - this.shotSpinRemaining / this.shotSpinDuration;
      this.shotSpinAngle = Math.PI * 2 * this.easeOutCubic(p);
      if (this.shotSpinRemaining <= 0) this.shotSpinAngle = 0;
    }

    if (this.reloadRemaining > 0) {
      this.reloadRemaining = Math.max(0, this.reloadRemaining - dt);
      const p = 1 - this.reloadRemaining / this.reloadDuration;
      const eased = this.smoothStep01(p);
      this.reloadSpinAngle = Math.PI * 2 * this.reloadTurns * eased;
      this.hudAngle = this.reloadStartHudAngle + this.reloadSpinAngle;

      if (this.reloadRemaining <= 0) {
        while (this.rounds.length < this.capacity) this.rounds.push('normal');
        this.reloadSpinAngle = 0;
        this.hudAngleTarget = this.reloadStartHudAngle + Math.PI * 2 * this.reloadTurns;
        this.hudAngle = this.hudAngleTarget;
      }
    } else if (this.chargeRemaining > 0) {
      this.chargeRemaining = Math.max(0, this.chargeRemaining - dt);
      const p = 1 - this.chargeRemaining / this.chargeDuration;
      const eased = this.smoothStep01(p);
      this.chargeSpinAngle = Math.PI * 2 * this.chargeTurns * eased;
      this.hudAngle = this.reloadStartHudAngle + this.chargeSpinAngle;

      if (this.chargeRemaining <= 0) {
        this.rounds = Array(this.capacity).fill('charged');
        this.chargePending = false;
        this.chargeSpinAngle = 0;
        this.hudAngleTarget = this.reloadStartHudAngle + Math.PI * 2 * this.chargeTurns;
        this.hudAngle = this.hudAngleTarget;
      }
    } else {
      this.reloadSpinAngle = 0;
      this.chargeSpinAngle = 0;
      this.hudAngle = MathEx.expLerp(this.hudAngle, this.hudAngleTarget, 24, dt);
    }
  }

  canFire() {
    return this.rounds.length > 0 && !this.isBusy() && this.canUse();
  }

  advanceCylinderVisual() {
    this.hudAngleTarget += Math.PI * 2 / 3;
  }

  beginShotSpin() {
    this.shotSpinRemaining = this.shotSpinDuration;
    this.shotSpinAngle = 0;
    this.cooldownRemaining = this.shotSpinDuration;
  }

  fireDirection({ mount, projectiles, player }, dirX, dirY) {
    if (!projectiles || !this.canFire()) return false;

    const length = MathEx.hypot(dirX, dirY) || 1;
    dirX /= length;
    dirY /= length;

    const roundType = this.rounds.shift();
    const charged = roundType === 'charged';
    this.chamberCursor = (this.chamberCursor + 1) % this.capacity;
    const hand = mount.position();
    const x = hand.x + dirX * this.muzzleOffset;
    const y = hand.y + dirY * this.muzzleOffset;

    projectiles.spawn(new Projectile({
      x, y,
      vx:dirX * this.projectileSpeed,
      vy:dirY * this.projectileSpeed,
      damage:charged ? this.chargedDamage : this.damage,
      knockback:charged ? this.chargedKnockback : this.knockback,
      life:1.8,
      width:charged ? 40 : 34,
      height:charged ? 24 : 20,
      color:charged ? '#ffffff' : '#e6e6e6'
    }));

    this.advanceCylinderVisual();
    this.beginShotSpin();

    const handRecoil = charged ? this.chargedHandRecoil : this.recoil;
    mount.hand.applyImpulse(-dirX * handRecoil, -dirY * handRecoil);

    if (charged && player) {
      // Intentionally ridiculous: charged rounds throw the whole fighter backward.
      player.vx += -dirX * this.chargedBodyRecoil;
      player.vy += -dirY * this.chargedBodyRecoil * 0.72 - 115;
      if (player.onGround) {
        player.onGround = false;
        player.releaseFeetToAir?.();
      }
    }

    return true;
  }

  primary(context) {
    if (!this.canFire()) return false;
    return this.fireDirection(context, context.mount.dirX, context.mount.dirY);
  }

  reload({ player }) {
    if (this.isBusy() || this.rounds.length >= this.capacity) return false;
    this.reloadRemaining = this.reloadDuration;
    this.reloadStartHudAngle = this.hudAngle;
    this.reloadSpinAngle = 0;
    this.cooldownRemaining = Math.max(this.cooldownRemaining, this.reloadDuration);
    player?.grantTemporaryHealth?.(15, 5.0);
    return true;
  }

  special() {
    if (this.isBusy()) return false;
    const alreadyFullCharged = this.rounds.length === this.capacity && this.rounds.every((round) => round === 'charged');
    if (alreadyFullCharged) return false;

    // Dump every currently loaded round immediately. The two-turn spin is the
    // visible charged reload; all six charged rounds appear when it completes.
    this.rounds.length = 0;
    this.chargePending = true;
    this.chargeRemaining = this.chargeDuration;
    this.reloadStartHudAngle = this.hudAngle;
    this.chargeSpinAngle = 0;
    this.cooldownRemaining = Math.max(this.cooldownRemaining, this.chargeDuration);
    return true;
  }

  render(ctx, { mount }) {
    const p = mount.position();
    const spin = this.shotSpinAngle + this.reloadSpinAngle + this.chargeSpinAngle;
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    ctx.rotate(mount.angle + spin);

    // Temporary block-gun placeholder. The held revolver sprite was removed
    // until the final weapon art direction is settled.
    if (mount.dirX < 0) ctx.scale(1, -1);
    ctx.fillStyle = '#202020';
    ctx.fillRect(-20, -9, 48, 22);
    ctx.fillRect(-4, 9, 13, 20);
    ctx.fillStyle = '#b8b8b8';
    ctx.fillRect(-17, -6, 42, 16);
    ctx.fillRect(-1, 9, 8, 16);

    ctx.restore();
  }

  renderHud(ctx, x = 18, y = 18) {
    const panelW = 244;
    const panelH = 76;
    const cylinderSize = 58;
    const cylinderX = x + 9;
    const cylinderY = y + 9;

    ctx.save();
    ctx.fillStyle = '#292929';
    ctx.fillRect(x, y, panelW, panelH);

    ctx.save();
    ctx.translate(cylinderX + cylinderSize / 2, cylinderY + cylinderSize / 2);
    ctx.rotate(this.hudAngle);

    if (!this.drawImageFitted(ctx, this.sprites.cylinder, 0, 0, cylinderSize, cylinderSize)) {
      ctx.fillStyle = '#d7d7d7';
      ctx.fillRect(-cylinderSize / 2, -cylinderSize / 2, cylinderSize, cylinderSize);
    }

    for (let i = 0; i < this.rounds.length; i++) {
      const chamberIndex = (this.chamberCursor + i) % this.capacity;
      const masks = this.chamberMasks[chamberIndex];
      if (!masks) continue;
      const mask = this.rounds[i] === 'charged' ? masks.charged : masks.normal;
      this.drawImageFitted(ctx, mask, 0, 0, cylinderSize, cylinderSize);
    }
    ctx.restore();

    const roundsStartX = cylinderX + cylinderSize + 18;
    const roundY = y + panelH / 2;
    const slotGap = 25;

    // Six fixed slots make the queue readable. Empty chambers are just faint boxes.
    for (let i = 0; i < this.capacity; i++) {
      const slotX = roundsStartX + i * slotGap;
      if (i >= this.rounds.length) {
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(slotX + 4, roundY - 11, 13, 22);
        continue;
      }

      const charged = this.rounds[i] === 'charged';
      const image = charged ? this.sprites.chargedRound : this.sprites.round;
      if (!this.drawImageFitted(ctx, image, slotX + 10, roundY, 20, 26)) {
        ctx.fillStyle = charged ? this.chargedChamberColor : this.normalChamberColor;
        ctx.fillRect(slotX + 4, roundY - 9, 12, 18);
      }
    }

    ctx.restore();
  }

}
