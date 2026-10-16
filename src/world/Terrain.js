'use strict';

// One simple island test map. Terrain coordinates are now independent from the
// browser window so the camera can zoom out and look beyond the arena.
class Terrain {
  constructor() {
    this.worldWidth = 2200;
    this.worldHeight = 980;
    this.viewWidth = 1280;
    this.viewHeight = 720;

    this.waterY = 650;
    this.islandLeft = 190;
    this.islandRight = 2010;
    this.baseYValue = 590;

    // Keep the old slope as part of the island so locomotion still gets tested.
    this.rise = 115;
    this.slopeStartValue = 1220;
    this.slopeEndValue = 1620;
  }

  resize(width, height) {
    this.viewWidth = width;
    this.viewHeight = height;
  }

  baseY() { return this.baseYValue; }
  slopeStart() { return this.slopeStartValue; }
  slopeEnd() { return this.slopeEndValue; }

  hasGroundAt(x) {
    return x >= this.islandLeft && x <= this.islandRight;
  }

  clampGroundX(x, margin = 0) {
    return MathEx.clamp(x, this.islandLeft + margin, this.islandRight - margin);
  }

  // Returns null when there is no solid island beneath this X.
  groundYAt(x) {
    if (!this.hasGroundAt(x)) return null;
    const base = this.baseY();
    const x1 = this.slopeStart();
    const x2 = this.slopeEnd();
    if (x <= x1) return base;
    if (x >= x2) return base - this.rise;
    const t = (x - x1) / (x2 - x1);
    return base - this.rise * t;
  }

  // Compatibility helper for older systems. Off-island queries return a deep
  // underwater floor, never the water surface itself.
  yAt(x) {
    const ground = this.groundYAt(x);
    return ground == null ? this.waterY + 360 : ground;
  }

  slopeAt(x) {
    if (!this.hasGroundAt(x)) return 0;
    return x > this.slopeStart() && x < this.slopeEnd()
      ? -this.rise / (this.slopeEnd() - this.slopeStart())
      : 0;
  }

  draw(ctx) {
    const huge = 12000;

    // Water extends far past the map on purpose: the camera has no map clamp.
    ctx.fillStyle = '#526d7a';
    ctx.fillRect(-huge, this.waterY, huge * 2, huge);

    // Subtle second band makes it read as water without adding fancy effects.
    ctx.fillStyle = '#607e8c';
    ctx.fillRect(-huge, this.waterY, huge * 2, 16);

    const left = this.islandLeft;
    const right = this.islandRight;
    const x1 = this.slopeStart();
    const x2 = this.slopeEnd();
    const base = this.baseY();
    const top = base - this.rise;

    // Island top + chunky cliff sides. No outlines.
    ctx.fillStyle = '#3b4146';
    ctx.beginPath();
    ctx.moveTo(left, base);
    ctx.lineTo(x1, base);
    ctx.lineTo(x2, top);
    ctx.lineTo(right, top);
    ctx.lineTo(right + 54, this.waterY + 120);
    ctx.lineTo(left - 54, this.waterY + 120);
    ctx.closePath();
    ctx.fill();

    // A lighter top strip keeps the playable surface readable at the zoomed-out scale.
    ctx.fillStyle = '#596057';
    ctx.beginPath();
    ctx.moveTo(left, base - 8);
    ctx.lineTo(x1, base - 8);
    ctx.lineTo(x2, top - 8);
    ctx.lineTo(right, top - 8);
    ctx.lineTo(right, top);
    ctx.lineTo(x2, top);
    ctx.lineTo(x1, base);
    ctx.lineTo(left, base);
    ctx.closePath();
    ctx.fill();
  }
}
