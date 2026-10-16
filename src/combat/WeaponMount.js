'use strict';

class WeaponMount {
  constructor({ hand }) {
    this.hand = hand;
    this.weapon = null;
    this.angle = 0;
    this.dirX = 1;
    this.dirY = 0;
    this.aimOverrideTime = 0;
    this.overrideDirX = 1;
    this.overrideDirY = 0;
  }

  equip(weapon) {
    if (this.weapon === weapon) return;
    if (this.weapon?.onUnequip) this.weapon.onUnequip(this);
    this.weapon = weapon || null;
    if (this.weapon?.onEquip) this.weapon.onEquip(this);
  }

  unequip() { this.equip(null); }

  setAimOverride(dirX, dirY, duration = 0.16) {
    const length = MathEx.hypot(dirX, dirY) || 1;
    this.overrideDirX = dirX / length;
    this.overrideDirY = dirY / length;
    this.aimOverrideTime = Math.max(this.aimOverrideTime, duration);
  }

  update(dt, player, pointer) {
    if (this.aimOverrideTime > 0) {
      this.aimOverrideTime = Math.max(0, this.aimOverrideTime - dt);
      this.dirX = this.overrideDirX;
      this.dirY = this.overrideDirY;
      this.angle = Math.atan2(this.dirY, this.dirX);
    } else {
      const origin = this.hand.origin(player);
      const dx = this.hand.targetX - origin.x;
      const dy = this.hand.targetY - origin.y;
      const length = MathEx.hypot(dx, dy);
      if (length > 0.001) {
        this.dirX = dx / length;
        this.dirY = dy / length;
        this.angle = Math.atan2(this.dirY, this.dirX);
      } else {
        this.dirX = player.facing;
        this.dirY = 0;
        this.angle = player.facing < 0 ? Math.PI : 0;
      }
    }
    this.weapon?.update?.(dt, { mount:this, player, pointer });
  }

  position() { return { x:this.hand.x, y:this.hand.y }; }
  muzzle(distance = 30) {
    return {
      x:this.hand.x + this.dirX * distance,
      y:this.hand.y + this.dirY * distance,
      angle:this.angle,
      dirX:this.dirX,
      dirY:this.dirY
    };
  }
  applyRecoil(strength) { this.hand.applyImpulse(-this.dirX * strength, -this.dirY * strength); }
  primary(context) { return this.weapon?.primary?.({ ...context, mount:this }) || false; }
  reload(context) { return this.weapon?.reload?.({ ...context, mount:this }) || false; }
  special(context) { return this.weapon?.special?.({ ...context, mount:this }) || this.weapon?.quickDraw?.({ ...context, mount:this }) || false; }
  render(ctx, debug = false) { this.weapon?.render?.(ctx, { mount:this, debug }); }
}
