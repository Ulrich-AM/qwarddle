'use strict';

const MathEx = {
  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
  lerp(a, b, t) { return a + (b - a) * t; },
  expLerp(a, b, k, dt) { return this.lerp(a, b, 1 - Math.exp(-k * dt)); },
  hump(t) { return 16 * t * t * (1 - t) * (1 - t); },
  hypot(x, y) { return Math.hypot(x, y); },
  hermite(p0, v0, p1, v1, t, duration) {
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * p0 + h10 * v0 * duration + h01 * p1 + h11 * v1 * duration;
  }
};
