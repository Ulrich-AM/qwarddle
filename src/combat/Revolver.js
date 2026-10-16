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
    ctx.translate(p.x, p.y);
    ctx.rotate(mount.angle + spin);
    ctx.fillStyle = '#bcbcbc';
    // Rectangle placeholder only. Swap this for the final revolver sprite later.
    ctx.fillRect(-31, -17, 62, 34);
    ctx.restore();
  }

  renderHud(ctx, x = 28, y = 28) {
    const big = 72;
    ctx.save();
    ctx.translate(x + big / 2, y + big / 2);
    ctx.rotate(this.hudAngle);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-big / 2, -big / 2, big, big);
    ctx.restore();

    const normalSize = 12;
    const chargedSize = 16;
    const gap = 10;
    const startX = x + big + 22;
    const centerY = y + big / 2;

    for (let i = 0; i < this.rounds.length; i++) {
      const charged = this.rounds[i] === 'charged';
      const size = charged ? chargedSize : normalSize;
      const slotX = startX + i * (normalSize + gap);
      ctx.save();
      ctx.translate(slotX + normalSize / 2, centerY);
      if (charged) ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }
}
