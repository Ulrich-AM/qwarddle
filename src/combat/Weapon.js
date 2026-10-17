'use strict';

// Small base contract for every future weapon. A weapon does not own the hand;
// WeaponMount supplies position, aim direction, muzzle transform, and recoil.
class Weapon {
  constructor({
    id = 'weapon',
    name = 'Weapon',
    damage = 10,
    cooldown = 0.25,
    knockback = 100,
    recoil = 0,
    muzzleOffset = 30
  } = {}) {
    Object.assign(this, { id, name, damage, cooldown, knockback, recoil, muzzleOffset });
    this.cooldownRemaining = 0;
    this.mount = null;
    this.chargeRate = 0;
    this.chargeOnHit = 0;
  }

  onEquip(mount) { this.mount = mount; }
  onUnequip() { this.mount = null; }

  update(dt /*, context */) {
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
  }

  canUse() { return this.cooldownRemaining <= 0; }

  beginUse() {
    if (!this.canUse()) return false;
    this.cooldownRemaining = this.cooldown;
    return true;
  }

  primary(/* context */) { return false; }
  secondary(/* context */) { return false; }

  attackReadiness(/* game */) {
    const primary = this.cooldown > 0
      ? MathEx.clamp(1 - this.cooldownRemaining / this.cooldown, 0, 1)
      : 1;
    return [primary, 1, 1];
  }

  render(/* ctx, context */) {}
}
