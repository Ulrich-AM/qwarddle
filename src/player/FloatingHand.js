'use strict';

class FloatingHand {
  constructor({ terrain, config, color = '#d7dce3' }) {
    this.terrain = terrain;
    this.cfg = config;
    this.color = color;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.motorX = 0;
    this.motorY = 0;
    this.time = 0;
  }

  origin(player) {
    return { x:player.x, y:player.y + this.cfg.handOriginY };
  }

  reset(player) {
    const origin = this.origin(player);
    this.x = origin.x + player.facing * this.cfg.handRestX;
    this.y = origin.y + this.cfg.handRestY;
    this.vx = 0;
    this.vy = 0;
    this.targetX = this.x;
    this.targetY = this.y;
    this.motorX = this.x;
    this.motorY = this.y;
    this.resolveWorldCollision(player.worldWidth, this.terrain.height);
  }

  rawPointerTarget(player, pointer) {
    // The visible aim pointer is truly unrestricted. It may exist far outside
    // the arena; only the physical hand/arm has a reach limit.
    return { x:pointer.x, y:pointer.y };
  }

  // Only the PHYSICAL hand has a reach limit. The visible white pointer is the
  // true mouse position and can be arbitrarily far away from the body.
  motorTarget(player, pointer) {
    const origin = this.origin(player);
    let dx = pointer.x - origin.x;
    let dy = pointer.y - origin.y;
    const distance = MathEx.hypot(dx, dy);

    if (distance > this.cfg.handReach && distance > 0.0001) {
      const scale = this.cfg.handReach / distance;
      dx *= scale;
      dy *= scale;
    }

    const half = this.cfg.handSize * 0.5;
    const x = origin.x + dx;
    let y = origin.y + dy;

    // The motor respects actual solid island terrain, but water/open space does
    // not behave like an invisible wall.
    const ground = this.terrain.groundYAt ? this.terrain.groundYAt(x) : this.terrain.yAt(x);
    if (ground != null) y = Math.min(y, ground - half);
    return { x, y };
  }

  applyImpulse(ix, iy) {
    this.vx += ix;
    this.vy += iy;
  }

  resolveWorldCollision(worldWidth, worldHeight) {
    const half = this.cfg.handSize * 0.5;
    const ground = this.terrain.groundYAt ? this.terrain.groundYAt(this.x) : this.terrain.yAt(this.x);
    if (ground != null) {
      const floorY = ground - half;
      if (this.y > floorY) {
        this.y = floorY;
        if (this.vy > 0) this.vy *= -this.cfg.handCollisionBounce;
        this.vx *= this.cfg.handCollisionFriction;
      }
    }
  }

  update(dt, player, pointer) {
    this.time += dt;

    const raw = this.rawPointerTarget(player, pointer);
    this.targetX = raw.x;
    this.targetY = raw.y;

    const base = this.motorTarget(player, pointer);
    const speedFactor = MathEx.clamp(MathEx.hypot(this.vx, this.vy) / 650, 0, 1);
    const wobble = this.cfg.handWobble * (0.72 + speedFactor * 0.50);
    const wx = Math.sin(this.time * this.cfg.handWobbleSpeed + 0.3) * wobble;
    const wy = Math.cos(this.time * this.cfg.handWobbleSpeed * 0.79 + 1.2) * wobble * 0.88;
    this.motorX = base.x + wx;
    this.motorY = base.y + wy;

    const ax = (this.motorX - this.x) * this.cfg.handSpring - this.vx * this.cfg.handDamping;
    const ay = (this.motorY - this.y) * this.cfg.handSpring - this.vy * this.cfg.handDamping;
    this.vx += ax * dt;
    this.vy += ay * dt;

    const speed = MathEx.hypot(this.vx, this.vy);
    if (speed > this.cfg.handMaxSpeed) {
      const scale = this.cfg.handMaxSpeed / speed;
      this.vx *= scale;
      this.vy *= scale;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Wobble/recoil may pass the normal arm reach. hardReach is only a safety
    // tether so the fist can feel loose without ever escaping the character.
    const origin = this.origin(player);
    let dx = this.x - origin.x;
    let dy = this.y - origin.y;
    const distance = MathEx.hypot(dx, dy);
    if (distance > this.cfg.handHardReach && distance > 0.0001) {
      const nx = dx / distance;
      const ny = dy / distance;
      this.x = origin.x + nx * this.cfg.handHardReach;
      this.y = origin.y + ny * this.cfg.handHardReach;
      const outward = this.vx * nx + this.vy * ny;
      if (outward > 0) {
        this.vx -= outward * nx * 0.85;
        this.vy -= outward * ny * 0.85;
      }
    }

    this.resolveWorldCollision(player.worldWidth, this.terrain.height);
  }

  render(ctx, player, debug = false, showAimPointer = true) {
    const size = this.cfg.handSize;
    const handSprite = player.characterSprites?.hand;

    if (player.spriteReady?.(handSprite)) {
      player.drawSpriteCentered(ctx, handSprite, this.x, this.y, size * 1.45, size * 1.45);
    } else {
      ctx.fillStyle = '#202020';
      ctx.fillRect(this.x - size / 2 - 2, this.y - size / 2 - 2, size + 4, size + 4);
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x - size / 2, this.y - size / 2, size, size);
    }

    if (showAimPointer) {
      ctx.fillStyle = 'rgba(255,255,255,0.80)';
      ctx.fillRect(this.targetX - 2, this.targetY - 2, 4, 4);
    }

    if (!debug) return;
    const origin = this.origin(player);
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, this.cfg.handReach, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#7ff';
    ctx.fillRect(this.targetX - 3, this.targetY - 3, 6, 6);
    ctx.fillStyle = '#f7f';
    ctx.fillRect(this.motorX - 2, this.motorY - 2, 4, 4);
    ctx.restore();
  }
}
