'use strict';

// Keeps the normal fighter controllable without faking the legs as a giant
// invisible body collider. Planted feet form a support base. A spring/damper
// force holds the torso near standing height while that base is credible.
class ActiveBodySupport {
  constructor(player) {
    this.player = player;
    this.cfg = player.cfg;
    this.strength = 1;
    this.targetY = player.y;
    this.centerX = player.x;
    this.contacts = [];
    this.edgeBias = 0;
  }

  standingOffset() {
    return this.cfg.bodyH * 0.5 + this.cfg.bodyHeight;
  }

  reset() {
    this.strength = 1;
    this.targetY = this.player.y;
    this.centerX = this.player.x;
    this.contacts = [];
    this.edgeBias = 0;
    this.evaluate();
  }

  footContact(leg) {
    if (!leg || leg.state !== 'plant') return null;

    const surface = this.player.terrain.surfaceYAt?.(leg.plantX, leg.plantY);
    if (surface == null) return null;

    const anchorError = MathEx.hypot(
      leg.foot.x - leg.plantX,
      leg.foot.y - surface
    );
    const range = Math.max(4, this.cfg.footContactRange);
    const positional = MathEx.clamp(1 - anchorError / range, 0, 1);
    const velocity = MathEx.clamp(
      1 - MathEx.hypot(leg.foot.vx, leg.foot.vy) / 900,
      0.35,
      1
    );

    leg.contactStrength = MathEx.expLerp(
      leg.contactStrength ?? 0,
      positional * velocity,
      18,
      1 / 120
    );

    const hip = this.player.hipFor(leg.index);
    const maxReach = Math.max(1, this.cfg.upperLeg + this.cfg.lowerLeg);
    const reach = MathEx.hypot(leg.foot.x - hip.x, leg.foot.y - hip.y) / maxReach;

    return {
      leg,
      x:leg.foot.x,
      y:surface,
      reach,
      strength:leg.contactStrength
    };
  }

  evaluate() {
    const player = this.player;
    const contacts = player.legs
      .map((leg) => this.footContact(leg))
      .filter(Boolean);

    this.contacts = contacts;

    if (!contacts.length) {
      this.strength = 0;
      this.targetY = player.y;
      this.centerX = player.x;
      this.edgeBias = 0;
      return this;
    }

    const xs = contacts.map((contact) => contact.x);
    const ys = contacts.map((contact) => contact.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const centerX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
    const surfaceY = ys.reduce((sum, y) => sum + y, 0) / ys.length;

    let horizontalStrength = 1;

    if (contacts.length === 1) {
      const distance = Math.abs(player.x - centerX);
      horizontalStrength = 1 - distance / Math.max(1, this.cfg.supportSingleFootRadius);
    } else if (player.x < minX) {
      horizontalStrength = 1 - (minX - player.x) / Math.max(1, this.cfg.supportEdgeFalloff);
    } else if (player.x > maxX) {
      horizontalStrength = 1 - (player.x - maxX) / Math.max(1, this.cfg.supportEdgeFalloff);
    }

    const worstReach = Math.max(...contacts.map((contact) => contact.reach));
    const stretchStrength = MathEx.clamp((1.04 - worstReach) / 0.14, 0, 1);
    const contactStrength = contacts.reduce((sum, contact) => sum + contact.strength, 0) / contacts.length;

    this.strength =
      MathEx.clamp(horizontalStrength, 0, 1) *
      stretchStrength *
      contactStrength;
    this.targetY = surfaceY - this.standingOffset();
    this.centerX = centerX;

    const supportWidth = Math.max(
      this.cfg.supportSingleFootRadius,
      maxX - minX + this.cfg.supportEdgeFalloff
    );
    this.edgeBias = MathEx.clamp((player.x - centerX) / supportWidth, -1, 1);
    return this;
  }

  canJump() {
    this.evaluate();
    return this.strength >= 0.22 &&
      Math.abs(this.player.y - this.targetY) <= 24 &&
      this.player.vy > -80;
  }

  release() {
    this.strength = 0;
    this.contacts = [];
    this.edgeBias = 0;
    this.player.onGround = false;
    this.player.releaseFeetToAir();
  }

  verticalAcceleration() {
    this.evaluate();

    if (this.strength <= this.cfg.supportMinStrength) {
      return this.cfg.gravity;
    }

    const motion01 = MathEx.clamp(
      Math.abs(this.player.vx) / Math.max(1, this.cfg.runSpeed),
      0,
      1
    );
    const bob =
      Math.sin(this.player.time * (7.0 + motion01 * 4.5)) *
      this.cfg.bodyBob *
      motion01 * 0.55;

    const dynamicTargetY = this.targetY + bob;
    const error = dynamicTargetY - this.player.y;
    const supportAccel =
      error * this.cfg.supportSpring -
      this.player.vy * this.cfg.supportDamping;

    // Full support cancels gravity and replaces it with the spring motor.
    // Partial/edge support lets progressively more gravity through.
    return this.cfg.gravity * (1 - this.strength) +
      supportAccel * this.strength;
  }

  landingCandidates(previousY, currentY) {
    if (this.player.vy < 0) return [];

    const previousFootLine = previousY + this.standingOffset();
    const currentFootLine = currentY + this.standingOffset();
    const tolerance = this.cfg.supportLandingTolerance;
    const candidates = [];

    for (let i = 0; i < this.player.legs.length; i++) {
      const x = this.player.x + this.player.stanceOffset(i);
      const surface = this.player.terrain.surfaceYAt?.(x, currentFootLine);
      if (surface == null) continue;

      const crossed =
        previousFootLine <= surface + tolerance &&
        currentFootLine >= surface - tolerance;

      if (!crossed) continue;
      if (Math.abs(surface - currentFootLine) > tolerance * 2.5) continue;

      candidates.push({ index:i, x, y:surface });
    }

    return candidates;
  }

  tryLanding(previousY, currentY) {
    const candidates = this.landingCandidates(previousY, currentY);
    if (!candidates.length) return false;

    const player = this.player;
    const impact = Math.max(0, player.vy);

    for (const candidate of candidates) {
      player.legs[candidate.index].plant(candidate.x, candidate.y);
    }

    // A missing foot stays airborne. This allows one-foot ledge catches instead
    // of snapping the fighter to a full two-foot stance.
    for (let i = 0; i < player.legs.length; i++) {
      if (!candidates.some((candidate) => candidate.index === i)) {
        player.legs[i].releaseToAir();
      }
    }

    // Do not move the torso here. Feet acquire soft contact targets and the
    // support spring catches the body over subsequent fixed steps.
    player.vy *= 0.62;
    player.onGround = true;
    player.landingPulse = MathEx.clamp((impact - 90) / 430, 0, 1);

    this.evaluate();
    return true;
  }

  forceLanding(surfaceY, impact = 0) {
    const player = this.player;

    for (let i = 0; i < player.legs.length; i++) {
      const x = player.clampFootXToReach(i, player.x + player.stanceOffset(i));
      const y = player.terrain.surfaceYAt?.(x, surfaceY) ?? surfaceY;
      player.legs[i].plant(x, y, false);
    }

    this.targetY = surfaceY - this.standingOffset();

    // Torso collision is only a last-resort safety catch. Move it only enough
    // to leave solid terrain, then let the leg/support motors recover the pose.
    const torsoBottom = player.y + player.cfg.bodyH * 0.5;
    if (torsoBottom > surfaceY) {
      player.y -= torsoBottom - surfaceY + 0.01;
    }

    player.vy = Math.min(player.vy * 0.38, 120);
    player.onGround = true;
    player.landingPulse = MathEx.clamp((impact - 90) / 430, 0, 1);
    this.evaluate();
  }

  updateOrientation(dt, horizontalAcceleration) {
    const player = this.player;
    this.evaluate();

    const velocityLean =
      MathEx.clamp(player.vx / Math.max(1, this.cfg.runSpeed), -1.25, 1.25) *
      this.cfg.accelLean;

    const accelLean =
      MathEx.clamp(horizontalAcceleration / Math.max(1, this.cfg.reverseAccel), -1, 1) *
      this.cfg.accelLean * 0.72;

    if (this.strength > this.cfg.supportMinStrength) {
      const wobble =
        Math.sin(player.time * 7.2 + player.x * 0.014) *
        this.cfg.bodyWobble *
        (0.45 + (1 - this.strength) * 1.5);

      const target = MathEx.clamp(
        velocityLean + accelLean + this.edgeBias * this.cfg.supportEdgeLean + wobble,
        -this.cfg.bodyAngularMax,
        this.cfg.bodyAngularMax
      );

      const angularAccel =
        (target - player.bodyAngle) * this.cfg.bodyAngularSpring -
        player.bodyAngularVelocity * this.cfg.bodyAngularDamping;

      player.bodyAngularVelocity += angularAccel * dt;
    } else {
      // In air the torso keeps its existing angular momentum rather than being
      // procedurally snapped upright.
      player.bodyAngularVelocity *= Math.exp(-this.cfg.bodyAngularAirDamping * dt);
    }

    player.bodyAngle += player.bodyAngularVelocity * dt;
    player.bodyAngle = MathEx.clamp(
      player.bodyAngle,
      -this.cfg.bodyAngularMax * 1.65,
      this.cfg.bodyAngularMax * 1.65
    );
  }
}
