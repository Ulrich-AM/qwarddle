'use strict';

class ProceduralArm {
  constructor({ config }) {
    this.cfg = config;
    this.elbow = { x:0, y:0, vx:0, vy:0 };
    this.target = { x:0, y:0 };
    this.time = 0;
  }

  // Deliberately centered. The body hides the root of the arm so the spindly
  // connector feels like it comes from inside the square instead of a shoulder
  // marker glued to one side.
  shoulder(player) {
    return player.bodyPoint(0, 0);
  }

  // This is not strict two-bone IK anymore. The two arm sections are allowed
  // to stretch/shrink with hand distance. That removes the violent elbow flip
  // that fixed-length IK produced when the aim crossed from left to right.
  elbowTarget(shoulder, hand) {
    const dx = hand.x - shoulder.x;
    const dy = hand.y - shoulder.y;
    const distance = Math.max(0.001, MathEx.hypot(dx, dy));
    const ux = dx / distance;
    const uy = dy / distance;
    const px = -uy;
    const py = ux;

    const reach01 = MathEx.clamp(distance / Math.max(1, this.cfg.handReach), 0, 1);
    const midpoint = this.cfg.armMidpoint;
    const midX = shoulder.x + dx * midpoint;
    const midY = shoulder.y + dy * midpoint;

    // More bend when the hand is close, straighter when extended.
    const bend = MathEx.lerp(this.cfg.armCloseBend, this.cfg.armFarBend, reach01);

    // There are two possible perpendicular sides. Pick the one closest to the
    // previous target, with a tiny preference for the visually lower one. This
    // gives continuity instead of a sign flip when the cursor crosses the body.
    const a = { x:midX + px * bend, y:midY + py * bend };
    const b = { x:midX - px * bend, y:midY - py * bend };
    const da = MathEx.hypot(a.x - this.target.x, a.y - this.target.y) - a.y * 0.002;
    const db = MathEx.hypot(b.x - this.target.x, b.y - this.target.y) - b.y * 0.002;
    return da <= db ? a : b;
  }

  reset(player, hand) {
    const shoulder = this.shoulder(player);
    const dx = hand.x - shoulder.x;
    const dy = hand.y - shoulder.y;
    const d = Math.max(0.001, MathEx.hypot(dx, dy));
    const midX = shoulder.x + dx * this.cfg.armMidpoint;
    const midY = shoulder.y + dy * this.cfg.armMidpoint;
    const px = -dy / d;
    const py = dx / d;
    this.target.x = midX + px * this.cfg.armFarBend;
    this.target.y = midY + py * this.cfg.armFarBend;
    this.elbow.x = this.target.x;
    this.elbow.y = this.target.y;
    this.elbow.vx = 0;
    this.elbow.vy = 0;
  }

  update(dt, player, hand) {
    this.time += dt;
    const shoulder = this.shoulder(player);
    const target = this.elbowTarget(shoulder, hand);
    const motion = MathEx.clamp(MathEx.hypot(hand.vx, hand.vy) / 900, 0, 1);

    target.x += Math.sin(this.time * 6.2 + 0.4) * this.cfg.elbowWobble * (0.3 + motion * 0.7);
    target.y += Math.cos(this.time * 5.1 + 1.0) * this.cfg.elbowWobble * 0.6;
    this.target.x = target.x;
    this.target.y = target.y;

    const ax = (target.x - this.elbow.x) * this.cfg.elbowSpring - this.elbow.vx * this.cfg.elbowDamping;
    const ay = (target.y - this.elbow.y) * this.cfg.elbowSpring - this.elbow.vy * this.cfg.elbowDamping + this.cfg.armGravity;
    this.elbow.vx += ax * dt;
    this.elbow.vy += ay * dt;

    const speed = MathEx.hypot(this.elbow.vx, this.elbow.vy);
    if (speed > this.cfg.elbowMaxSpeed) {
      const scale = this.cfg.elbowMaxSpeed / speed;
      this.elbow.vx *= scale;
      this.elbow.vy *= scale;
    }

    this.elbow.x += this.elbow.vx * dt;
    this.elbow.y += this.elbow.vy * dt;

    // Secondary-motion leash only. The arm can stretch, but the elbow itself
    // should not fly arbitrarily far away from its procedural target.
    const dx = this.elbow.x - target.x;
    const dy = this.elbow.y - target.y;
    const lag = MathEx.hypot(dx, dy);
    if (lag > this.cfg.elbowLagMax && lag > 0.0001) {
      const scale = this.cfg.elbowLagMax / lag;
      this.elbow.x = target.x + dx * scale;
      this.elbow.y = target.y + dy * scale;
      this.elbow.vx *= 0.76;
      this.elbow.vy *= 0.76;
    }
  }

  drawOutlinedSegment(ctx, a, b, width, color) {
    ctx.lineCap = 'round';

    ctx.strokeStyle = '#202020';
    ctx.lineWidth = width + 4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  render(ctx, player, hand, debug = false) {
    const shoulder = this.shoulder(player);
    const elbow = this.elbow;

    this.drawOutlinedSegment(
      ctx,
      shoulder,
      elbow,
      this.cfg.armWidthUpper,
      player.appearance?.armUpper || '#76b887'
    );

    this.drawOutlinedSegment(
      ctx,
      elbow,
      hand,
      this.cfg.armWidthLower,
      player.appearance?.armLower || '#69a9b7'
    );

    if (debug) {
      ctx.fillStyle = '#7f7';
      for (const p of [shoulder, elbow]) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#f7f';
      ctx.beginPath();
      ctx.arc(this.target.x, this.target.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
