'use strict';

class Projectile {
  constructor({
    x = 0, y = 0, vx = 0, vy = 0,
    damage = 10, knockback = 100, life = 3,
    width = 14, height = 9, color = '#ededed'
  } = {}) {
    Object.assign(this, { x, y, vx, vy, damage, knockback, life, width, height, color });
    this.dead = false;
    this.angle = Math.atan2(vy, vx);
    this.hitRadius = Math.max(width, height) * 0.5;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (Math.abs(this.vx) + Math.abs(this.vy) > 0.001) this.angle = Math.atan2(this.vy, this.vx);
    if (this.life <= 0) this.dead = true;
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
    ctx.restore();
  }
}
