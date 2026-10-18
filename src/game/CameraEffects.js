'use strict';

// Fighter-style camera. In two-fighter play it frames both active bodies and
// smoothly adjusts zoom instead of following one player only.
class CameraEffects {
  constructor() {
    this.width = 1280;
    this.height = 720;
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.zoom = 0.72;
    this.targetZoom = this.zoom;
    this.response = 3.8;
    this.zoomResponse = 3.2;
    this.verticalBias = 34;
    this.minZoom = 0.42;
    this.maxZoom = 0.78;
    this.horizontalPadding = 520;
    this.verticalPadding = 340;
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
    this.zoom = 0.72;
    this.targetZoom = this.zoom;
  }

  resetGroup(subjects = []) {
    const valid = subjects.filter(Boolean);
    if (!valid.length) {
      this.reset();
      return;
    }

    const minX = Math.min(...valid.map((subject) => subject.x));
    const maxX = Math.max(...valid.map((subject) => subject.x));
    const minY = Math.min(...valid.map((subject) => subject.y));
    const maxY = Math.max(...valid.map((subject) => subject.y));

    this.x = (minX + maxX) * 0.5;
    this.y = (minY + maxY) * 0.5 - this.verticalBias;
    this.targetX = this.x;
    this.targetY = this.y;
    this.zoom = 0.72;
    this.targetZoom = this.zoom;
  }

  update(dt, player, pointerWorld) {
    const aimX = pointerWorld.x - player.x;
    const aimY = pointerWorld.y - player.y;
    this.targetX = player.x + aimX * 0.20;
    this.targetY = player.y - this.verticalBias + aimY * 0.10;

    this.x = MathEx.expLerp(this.x, this.targetX, this.response, dt);
    this.y = MathEx.expLerp(this.y, this.targetY, this.response, dt);
    this.zoom = MathEx.expLerp(this.zoom, 0.72, this.zoomResponse, dt);
  }

  updateFighters(dt, subjects = []) {
    const valid = subjects.filter((subject) => {
      return subject && Number.isFinite(subject.x) && Number.isFinite(subject.y);
    });
    if (!valid.length) return;

    const minX = Math.min(...valid.map((subject) => subject.x));
    const maxX = Math.max(...valid.map((subject) => subject.x));
    const minY = Math.min(...valid.map((subject) => subject.y));
    const maxY = Math.max(...valid.map((subject) => subject.y));

    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);

    this.targetX = (minX + maxX) * 0.5;
    this.targetY = (minY + maxY) * 0.5 - this.verticalBias;

    const zoomX = this.width / (spanX + this.horizontalPadding);
    const zoomY = this.height / (spanY + this.verticalPadding);
    this.targetZoom = MathEx.clamp(
      Math.min(zoomX, zoomY, this.maxZoom),
      this.minZoom,
      this.maxZoom
    );

    this.x = MathEx.expLerp(this.x, this.targetX, this.response, dt);
    this.y = MathEx.expLerp(this.y, this.targetY, this.response, dt);
    this.zoom = MathEx.expLerp(this.zoom, this.targetZoom, this.zoomResponse, dt);
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
