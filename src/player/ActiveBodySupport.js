'use strict';

// Physical torso support around the original deterministic procedural legs.
//
// Important separation:
// - ProceduralLeg owns plant/swing/air and exact foot placement.
// - ActiveBodySupport only reads those planted contacts and applies forces to
//   the torso. It never drags a planted foot or turns a normal leg into physics.
class ActiveBodySupport {
  constructor(player) {
    this.player = player;
    this.cfg = player.cfg;

    this.strength = 1;
    this.targetY = player.y;
    this.centerX = player.x;
    this.contacts = [];
    this.edgeBias = 0;

    this.landingAssistTime = 0;
    this.landingAssistY = null;

    // Brief floor-backed continuity prevents a fast procedural stride from
    // turning one overextended planted foot into a full-body airborne state.
    this.contactGraceTime = 0;
    this.lastStableTargetY = player.y;
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
    this.landingAssistTime = 0;
    this.landingAssistY = null;
    this.contactGraceTime = this.cfg.supportContactGrace;
    this.lastStableTargetY = this.player.y;
    this.evaluate();
  }

  update(dt) {
    if (this.landingAssistTime > 0) {
      this.landingAssistTime = Math.max(0, this.landingAssistTime - dt);
      if (this.landingAssistTime <= 0) this.landingAssistY = null;
    }

    if (this.contactGraceTime > 0) {
      this.contactGraceTime = Math.max(0, this.contactGraceTime - dt);
    }
  }

  floorContinuitySurface() {
    const player = this.player;
    const referenceY = player.footReferenceY();
    const surface = player.terrain.surfaceYAt?.(player.x, referenceY);
    if (surface == null) return null;
    if (Math.abs(surface - referenceY) > this.cfg.supportFloorContinuityTolerance) {
      return null;
    }
    return surface;
  }

  applyFloorContinuity(surfaceY) {
    if (surfaceY == null || this.contactGraceTime <= 0) return false;

    const ratio = MathEx.clamp(
      this.contactGraceTime / Math.max(0.001, this.cfg.supportContactGrace),
      0,
      1
    );

    this.strength = Math.max(
      this.strength,
      MathEx.lerp(0.24, this.cfg.supportGraceStrength, ratio)
    );
    this.targetY = surfaceY - this.standingOffset();
    this.centerX = this.player.x;
    this.edgeBias = 0;
    return true;
  }

  footContact(leg) {
    if (!leg || leg.state !== 'plant') return null;

    const surface = this.player.terrain.surfaceYAt?.(
      leg.plantX,
      leg.plantY
    );
    if (surface == null) return null;

    const tolerance = Math.max(5, this.cfg.supportLandingTolerance * 0.5);
    if (Math.abs(surface - leg.plantY) > tolerance) return null;

    const hip = this.player.hipFor(leg.index);
    const maxReach = Math.max(1, this.cfg.upperLeg + this.cfg.lowerLeg);
    const reach = MathEx.hypot(
      leg.plantX - hip.x,
      surface - hip.y
    ) / maxReach;

    return {
      leg,
      x:leg.plantX,
      y:surface,
      reach
    };
  }

  evaluate() {
    const player = this.player;
    const contacts = player.legs
      .map((leg) => this.footContact(leg))
      .filter(Boolean);

    this.contacts = contacts;

    if (contacts.length) {
      const xs = contacts.map((contact) => contact.x);
      const ys = contacts.map((contact) => contact.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const centerX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
      const surfaceY = ys.reduce((sum, y) => sum + y, 0) / ys.length;

      let horizontalStrength = 1;

      if (contacts.length === 1) {
        const distance = Math.abs(player.x - centerX);
        horizontalStrength =
          1 - distance / Math.max(1, this.cfg.supportSingleFootRadius);
      } else if (player.x < minX) {
        horizontalStrength =
          1 - (minX - player.x) / Math.max(1, this.cfg.supportEdgeFalloff);
      } else if (player.x > maxX) {
        horizontalStrength =
          1 - (player.x - maxX) / Math.max(1, this.cfg.supportEdgeFalloff);
      }

      const worstReach = Math.max(
        ...contacts.map((contact) => contact.reach)
      );
      const stretchStrength = MathEx.clamp(
        (1.035 - worstReach) / 0.15,
        0,
        1
      );

      const grip = MathEx.clamp(
        player.currentSurfaceResponse?.footGrip ?? 1,
        0.05,
        1.5
      );

      this.strength =
        MathEx.clamp(horizontalStrength, 0, 1) *
        stretchStrength *
        Math.min(1, Math.sqrt(grip));

      this.targetY = surfaceY - this.standingOffset();
      this.centerX = centerX;

      const supportWidth = Math.max(
        this.cfg.supportSingleFootRadius,
        maxX - minX + this.cfg.supportEdgeFalloff
      );
      this.edgeBias = MathEx.clamp(
        (player.x - centerX) / supportWidth,
        -1,
        1
      );

      // Healthy contacts continually recharge a very short support grace. If a
      // sprint outruns one planted leg, use the real floor under the torso while
      // the next procedural step catches up instead of dropping both legs.
      if (
        worstReach < 1.02 &&
        horizontalStrength > 0.16 &&
        this.strength > this.cfg.supportMinStrength * 1.5
      ) {
        this.contactGraceTime = this.cfg.supportContactGrace;
        this.lastStableTargetY = this.targetY;
      } else if (this.strength <= this.cfg.supportMinStrength) {
        this.applyFloorContinuity(this.floorContinuitySurface());
      }

      return this;
    }

    // If both feet are between valid contacts for only a few frames, preserve
    // support only when a real floor is still directly underneath the torso.
    // Over an actual gap this returns null and gravity takes over immediately.
    if (this.applyFloorContinuity(this.floorContinuitySurface())) {
      return this;
    }

    // Landing assist is not a fake permanent floor. It only catches the torso
    // briefly while the original legs play their short landing swing.
    if (
      this.landingAssistTime > 0 &&
      Number.isFinite(this.landingAssistY)
    ) {
      const ratio = MathEx.clamp(
        this.landingAssistTime / Math.max(0.001, this.cfg.supportLandingAssist),
        0,
        1
      );

      this.strength = 0.34 + ratio * 0.56;
      this.targetY = this.landingAssistY - this.standingOffset();
      this.centerX = player.x;
      this.edgeBias = 0;
      return this;
    }

    this.strength = 0;
    this.targetY = player.y;
    this.centerX = player.x;
    this.edgeBias = 0;
    return this;
  }

  canJump() {
    this.evaluate();
    return (
      this.strength >= 0.22 &&
      Math.abs(this.player.y - this.targetY) <= 28 &&
      this.player.vy > -90
    );
  }

  release() {
    this.strength = 0;
    this.contacts = [];
    this.edgeBias = 0;
    this.landingAssistTime = 0;
    this.landingAssistY = null;
    this.contactGraceTime = 0;
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
      Math.sin(this.player.time * (7.0 + motion01 * 3.2)) *
      this.cfg.bodyBob *
      motion01 *
      0.42;

    const dynamicTargetY = this.targetY + bob;
    const error = dynamicTargetY - this.player.y;
    const supportAccel =
      error * this.cfg.supportSpring -
      this.player.vy * this.cfg.supportDamping;

    return (
      this.cfg.gravity * (1 - this.strength) +
      supportAccel * this.strength
    );
  }

  landingCandidates(previousY, currentY) {
    if (this.player.vy < 0) return [];

    const previousFootLine = previousY + this.standingOffset();
    const currentFootLine = currentY + this.standingOffset();
    const tolerance = this.cfg.supportLandingTolerance;
    const candidates = [];

    for (let i = 0; i < this.player.legs.length; i++) {
      const x = this.player.clampFootXToReach(
        i,
        this.player.x + this.player.stanceOffset(i)
      );
      const surface = this.player.terrain.surfaceYAt?.(
        x,
        currentFootLine
      );
      if (surface == null) continue;

      const crossed =
        previousFootLine <= surface + tolerance &&
        currentFootLine >= surface - tolerance;

      if (!crossed) continue;
      if (Math.abs(surface - currentFootLine) > tolerance * 3) continue;

      candidates.push({ index:i, x, y:surface });
    }

    return candidates;
  }

  beginLanding(candidates, impact = 0) {
    if (!candidates?.length) return false;

    const player = this.player;
    const surfaceY =
      candidates.reduce((sum, candidate) => sum + candidate.y, 0) /
      candidates.length;

    // A sufficiently violent floor collision becomes a real temporary ragdoll.
    // Player stores the impact request; Game performs the state handoff after
    // the normal actor update so movement code does not need to know FighterSlot.
    if (player.handleLandingImpact?.(impact)) return false;

    for (const candidate of candidates) {
      const leg = player.legs[candidate.index];

      if (leg.state === 'plant') continue;
      if (leg.state === 'swing' && leg.swing?.landing) continue;

      leg.beginSwing(
        candidate.x,
        candidate.y,
        this.cfg.landingTime,
        this.cfg.stepHeight * 0.48,
        true
      );
    }

    this.landingAssistY = surfaceY;
    this.landingAssistTime = this.cfg.supportLandingAssist;
    this.contactGraceTime = this.cfg.supportContactGrace;
    this.lastStableTargetY = surfaceY - this.standingOffset();

    // Remove only part of the fall speed. The torso spring absorbs the rest,
    // so there is no y-position teleport at contact.
    player.vy *= 0.55;
    player.onGround = true;
    player.landingPulse = MathEx.clamp((impact - 90) / 430, 0, 1);

    this.evaluate();
    return true;
  }

  tryLanding(previousY, currentY) {
    if (this.landingAssistTime > 0) return false;
    const candidates = this.landingCandidates(previousY, currentY);
    return this.beginLanding(candidates, Math.max(0, this.player.vy));
  }

  forceLanding(surfaceY, impact = 0) {
    const player = this.player;

    if (this.landingAssistTime <= 0) {
      const candidates = [];

      for (let i = 0; i < player.legs.length; i++) {
        const x = player.clampFootXToReach(
          i,
          player.x + player.stanceOffset(i)
        );
        const y = player.terrain.surfaceYAt?.(x, surfaceY) ?? surfaceY;
        candidates.push({ index:i, x, y });
      }

      this.beginLanding(candidates, impact);
    }

    // Safety only: if the actual torso itself entered solid terrain, move it
    // the minimum amount necessary to leave the rectangle. Never restart an
    // in-progress landing swing from this safety path.
    const torsoBottom = player.y + player.cfg.bodyH * 0.5;
    if (torsoBottom > surfaceY) {
      player.y -= torsoBottom - surfaceY + 0.01;
      if (player.vy > 0) player.vy *= 0.25;
    }

    this.evaluate();
  }

  beginRecoveryLanding() {
    const player = this.player;
    const referenceY = player.footReferenceY();
    const candidates = [];

    for (let i = 0; i < player.legs.length; i++) {
      const x = player.clampFootXToReach(
        i,
        player.x + player.stanceOffset(i)
      );
      const surface = player.terrain.surfaceYAt?.(x, referenceY);
      if (surface == null) continue;
      if (Math.abs(surface - referenceY) > 110) continue;
      candidates.push({ index:i, x, y:surface });
    }

    return this.beginLanding(candidates, Math.max(0, player.vy));
  }

  updateOrientation(dt, horizontalAcceleration) {
    const player = this.player;
    this.evaluate();

    const speed01 = MathEx.clamp(
      Math.abs(player.vx) / Math.max(1, this.cfg.runSpeed),
      0,
      1.35
    );
    const recovery01 = player.balanceRecoveryRatio?.() ?? 0;

    const velocityLean =
      MathEx.clamp(
        player.vx / Math.max(1, this.cfg.runSpeed),
        -1.35,
        1.35
      ) *
      this.cfg.accelLean;

    const normalizedAcceleration = MathEx.clamp(
      horizontalAcceleration / Math.max(1, this.cfg.reverseAccel),
      -1,
      1
    );
    const accelLean =
      normalizedAcceleration *
      this.cfg.accelLean *
      0.72;

    if (this.strength > this.cfg.supportMinStrength) {
      const gaitWobble =
        Math.sin(player.time * (7.0 + speed01 * 4.2) + player.x * 0.006) *
        this.cfg.bodyWobble *
        (0.18 + speed01 * 0.82) *
        (1 + recovery01 * 1.45);

      const swing = player.currentSwingInfo?.();
      const stepSide = swing ? (swing.leg.index ? 1 : -1) : 0;
      const stepLean =
        stepSide *
        player.stepPulse *
        this.cfg.bodyStepLean *
        speed01;

      const target = MathEx.clamp(
        velocityLean +
          accelLean +
          this.edgeBias * this.cfg.supportEdgeLean +
          gaitWobble +
          stepLean,
        -this.cfg.bodyAngularMax,
        this.cfg.bodyAngularMax
      );

      const spring =
        this.cfg.bodyAngularSpring *
        MathEx.lerp(1, this.cfg.bodyRecoverySpringScale, recovery01);
      const damping =
        this.cfg.bodyAngularDamping *
        MathEx.lerp(1, this.cfg.bodyRecoveryDampingScale, recovery01);

      const angularAccel =
        (target - player.bodyAngle) * spring -
        player.bodyAngularVelocity * damping;

      player.bodyAngularVelocity += angularAccel * dt;

      // Acceleration changes angular velocity directly, so a hard stop or
      // reversal visibly throws the torso before the spring catches it.
      player.bodyAngularVelocity +=
        normalizedAcceleration *
        this.cfg.bodyAngularAccelerationKick *
        dt;
    } else {
      player.bodyAngularVelocity *= Math.exp(
        -this.cfg.bodyAngularAirDamping * dt
      );
    }

    player.bodyAngle += player.bodyAngularVelocity * dt;
    player.bodyAngle = MathEx.clamp(
      player.bodyAngle,
      -this.cfg.bodyAngularMax * 1.55,
      this.cfg.bodyAngularMax * 1.55
    );
  }
}
