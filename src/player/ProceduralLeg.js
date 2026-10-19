'use strict';

class ProceduralLeg {
  constructor(index) {
    this.index = index;
    this.state = 'plant';

    this.foot = { x:0, y:0, vx:0, vy:0 };
    this.knee = { x:0, y:0, vx:0, vy:0 };

    // plantX/plantY are contact targets, not hard positions. The physical foot
    // is spring-driven toward them and is allowed to lag/compress.
    this.plantX = 0;
    this.plantY = 0;
    this.contactStrength = 1;

    this.lastFootX = 0;
    this.lastFootY = 0;

    this.swing = {
      sx:0, sy:0,
      svx:0, svy:0,
      tx:0, ty:0,
      t:1,
      duration:0.18,
      height:20,
      landing:false
    };
  }

  plant(x, y, snap = false) {
    this.state = 'plant';
    this.plantX = x;
    this.plantY = y;

    if (snap) {
      this.foot.x = x;
      this.foot.y = y;
      this.foot.vx = 0;
      this.foot.vy = 0;
      this.contactStrength = 1;
    } else {
      // A new contact begins softly. Active support ramps up as the physical
      // foot converges on the contact target.
      this.contactStrength = Math.max(
        0.18,
        Math.min(this.contactStrength, 0.35)
      );
    }
  }

  releaseToAir() {
    this.state = 'air';
    this.contactStrength = 0;
  }

  beginSwing(targetX, targetY, duration, height, landing = false) {
    this.swing.sx = this.foot.x;
    this.swing.sy = this.foot.y;
    this.swing.svx = this.foot.vx;
    this.swing.svy = this.foot.vy;
    this.swing.tx = targetX;
    this.swing.ty = targetY;
    this.swing.t = 0;
    this.swing.duration = Math.max(0.075, duration);
    this.swing.height = height;
    this.swing.landing = landing;
    this.contactStrength = 0;
    this.state = 'swing';
  }
}
