'use strict';

// Fighter-style camera: a real world-space camera with a deliberately wide
// zoom. It follows the player + aim direction but has NO arena/map clamp.
class CameraEffects {
  constructor() {
    this.width = 1280;
    this.height = 720;
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.zoom = 0.72;
    this.response = 3.8;
    this.lookAheadX = 0.20;
    this.lookAheadY = 0.10;
    this.verticalBias = 32;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  reset(player = null) {
    this.x = player ? player.x : 0;
    this.y = player ? player.y - this.verticalBias : 0;
    this.targetX = this.x;
    this.targetY = this.y;
  }

  update(dt, player, pointerWorld) {
    const aimX = pointerWorld.x - player.x;
    const aimY = pointerWorld.y - player.y;

    // No clamps here: if you aim far away, the camera is allowed to look far
    // away as well. The low multipliers keep it readable like a 2D fighter.
    this.targetX = player.x + aimX * this.lookAheadX;
    this.targetY = player.y - this.verticalBias + aimY * this.lookAheadY;

    this.x = MathEx.expLerp(this.x, this.targetX, this.response, dt);
    this.y = MathEx.expLerp(this.y, this.targetY, this.response, dt);
  }

  screenToWorld(x, y) {
    return {
      x:(x - this.width * 0.5) / this.zoom + this.x,
      y:(y - this.height * 0.5) / this.zoom + this.y
    };
  }

  worldToScreen(x, y) {
    return {
      x:(x - this.x) * this.zoom + this.width * 0.5,
      y:(y - this.y) * this.zoom + this.height * 0.5
    };
  }

  begin(ctx) {
    ctx.save();
    ctx.translate(this.width * 0.5, this.height * 0.5);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  end(ctx) {
    ctx.restore();
  }
}
