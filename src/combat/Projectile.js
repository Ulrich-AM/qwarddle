'use strict';

class Projectile {
  constructor({
    x = 0, y = 0, vx = 0, vy = 0,
    damage = 10, knockback = 100, life = 3,
    width = 14, height = 9, color = '#ededed',
    shape = 'rect', outlineColor = null, outlineWidth = 0,
    onHit = null, owner = null
  } = {}) {
    Object.assign(this, {
      x, y, vx, vy, damage, knockback, life, width, height, color,
      shape, outlineColor, outlineWidth, onHit, owner
    });
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
    ctx.translate(Math.round(this.x), Math.round(this.y));

    if (this.shape === 'circle') {
      const radius = this.hitRadius;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();

      if (this.outlineColor && this.outlineWidth > 0) {
        ctx.strokeStyle = this.outlineColor;
        ctx.lineWidth = this.outlineWidth;
        ctx.stroke();
      }
    } else {
      ctx.rotate(this.angle);
      if (this.outlineColor && this.outlineWidth > 0) {
        ctx.fillStyle = this.outlineColor;
        ctx.fillRect(
          -this.width / 2 - this.outlineWidth,
          -this.height / 2 - this.outlineWidth,
          this.width + this.outlineWidth * 2,
          this.height + this.outlineWidth * 2
        );
      }
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
    }

    ctx.restore();
  }
}
