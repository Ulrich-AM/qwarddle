'use strict';

class Player {
  static defaultAppearance() {
    return {
      // Placeholder groups only. Future body/limb sprites can replace these
      // shapes while keeping the same three customization colors.
      body:'#9a78c7',
      legUpper0:'#d88b55', legLower0:'#d88b55', foot0:'#d88b55',
      legUpper1:'#d88b55', legLower1:'#d88b55', foot1:'#d88b55',
      armUpper:'#69a9b7', armLower:'#69a9b7', hand:'#69a9b7'
    };
  }

  constructor({ input, terrain, config, appearance = null }) {
    this.input = input;
    this.terrain = terrain;
    this.cfg = config;
    this.appearance = { ...Player.defaultAppearance(), ...(appearance || {}) };

    this.spriteRoot = 'assets/sprites/characters/';
    this.characterSprites = {
      body:this.loadCharacterSprite(['body.png', 'head-body.png']),
      hand:this.loadCharacterSprite(['hand.png']),
      foot:this.loadCharacterSprite(['foot.png'])
    };

    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.prevVx = 0;
    this.onGround = true;
    this.facing = 1;
    this.bodyAngle = 0;
    this.wasMoving = false;
    this.landingPulse = 0;
    this.stepPulse = 0;
    this.time = 0;

    // Minimal combat state. tempHealth is a disposable buffer used by
    // effects such as the revolver reload buff.
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.tempHealth = 0;
    this.tempHealthTime = 0;

    this.legs = [new ProceduralLeg(0), new ProceduralLeg(1)];
    this.hand = new FloatingHand({ terrain:this.terrain, config:this.cfg });
    this.arm = new ProceduralArm({ config:this.cfg });
    this.weaponMount = new WeaponMount({ hand:this.hand });
  }

  loadCharacterSprite(candidates) {
    const image = new Image();
    let index = 0;

    const tryNext = () => {
      if (index >= candidates.length) return;
      image.src = this.spriteRoot + candidates[index++];
    };

    image.onerror = tryNext;
    tryNext();
    return image;
  }

  spriteReady(image) {
    return !!image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  }

  drawSpriteCentered(ctx, image, centerX, centerY, maxWidth, maxHeight = maxWidth) {
    if (!this.spriteReady(image)) return false;
    const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    ctx.drawImage(image, centerX - width / 2, centerY - height / 2, width, height);
    return true;
  }

  setAppearance(appearance) {
    this.appearance = { ...this.appearance, ...(appearance || {}) };
    this.hand.color = this.appearance.hand;
  }

  resize(width) {
    this.worldWidth = width;
  }

  supportBaseY(x = this.x) {
    const ground = this.terrain.groundYAt ? this.terrain.groundYAt(x) : this.terrain.yAt(x);
    const y = ground == null ? this.terrain.yAt(x) : ground;
    return y - this.cfg.bodyH / 2 - this.cfg.bodyHeight;
  }

  stanceOffset(index) {
    return (index ? 1 : -1) * this.cfg.stanceSpread * 0.5;
  }

  bodyPoint(localX, localY) {
    const c = Math.cos(this.bodyAngle);
    const s = Math.sin(this.bodyAngle);
    return {
      x: this.x + localX * c - localY * s,
      y: this.y + localX * s + localY * c
    };
  }

  hipFor(index) {
    return this.bodyPoint(index ? this.cfg.hipInset : -this.cfg.hipInset, this.cfg.bodyH * 0.38);
  }

  solveKnee(hx, hy, fx, fy, bend) {
    const L1 = this.cfg.upperLeg;
    const L2 = this.cfg.lowerLeg;
    let dx = fx - hx;
    let dy = fy - hy;
    let d = Math.max(0.001, MathEx.hypot(dx, dy));
    const max = L1 + L2 - 0.01;
    const min = Math.abs(L1 - L2) + 0.01;
    d = MathEx.clamp(d, min, max);

    const raw = MathEx.hypot(dx, dy) || 1;
    const ux = dx / raw;
    const uy = dy / raw;
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const px = hx + ux * a;
    const py = hy + uy * a;
    return { x:px - uy * h * bend, y:py + ux * h * bend };
  }

  placeAt(x) {
    this.x = x;
    this.y = this.supportBaseY();
    this.vx = 0;
    this.vy = 0;
    this.prevVx = 0;
    this.onGround = true;
    this.landingPulse = 0;
    this.stepPulse = 0;

    for (let i = 0; i < 2; i++) {
      const leg = this.legs[i];
      const footX = this.x + this.stanceOffset(i);
      const footY = this.terrain.yAt(footX);
      const hip = this.hipFor(i);
      leg.plant(footX, footY);
      const knee = this.solveKnee(hip.x, hip.y, footX, footY, -this.facing * this.cfg.kneeBend);
      leg.knee.x = knee.x;
      leg.knee.y = knee.y;
      leg.lastFootX = footX;
      leg.lastFootY = footY;
    }

    this.hand.reset(this);
    this.arm.reset(this, this.hand);
  }

  reset(width) {
    this.worldWidth = width;
    this.x = width * 0.5;
    this.y = this.supportBaseY();
    this.vx = 0;
    this.vy = 0;
    this.prevVx = 0;
    this.onGround = true;
    this.facing = 1;
    this.bodyAngle = 0;
    this.wasMoving = false;
    this.landingPulse = 0;
    this.stepPulse = 0;
    this.time = 0;

    // Minimal combat state. tempHealth is a disposable buffer used by
    // effects such as the revolver reload buff.
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.tempHealth = 0;
    this.tempHealthTime = 0;

    for (let i = 0; i < 2; i++) {
      const leg = this.legs[i];
      const footX = this.x + this.stanceOffset(i);
      const footY = this.terrain.yAt(footX);
      const hip = this.hipFor(i);
      leg.plant(footX, footY);
      const knee = this.solveKnee(hip.x, hip.y, footX, footY, -this.facing * this.cfg.kneeBend);
      leg.knee.x = knee.x;
      leg.knee.y = knee.y;
      leg.lastFootX = footX;
      leg.lastFootY = footY;
    }

    this.hand.reset(this);
    this.arm.reset(this, this.hand);
  }


  grantTemporaryHealth(amount, duration) {
    this.tempHealth = Math.max(this.tempHealth, amount);
    this.tempHealthTime = Math.max(this.tempHealthTime, duration);
  }

  takeDamage(amount) {
    let remaining = Math.max(0, amount);
    if (this.tempHealth > 0) {
      const absorbed = Math.min(this.tempHealth, remaining);
      this.tempHealth -= absorbed;
      remaining -= absorbed;
    }
    this.health = Math.max(0, this.health - remaining);
    return this.health <= 0;
  }

  anySwing() {
    return this.legs.some((leg) => leg.state === 'swing');
  }

  currentSwingInfo() {
    const leg = this.legs.find((candidate) => candidate.state === 'swing');
    return leg ? { leg, t:leg.swing.t, landing:leg.swing.landing } : null;
  }

  chooseTrailingLeg(direction) {
    let best = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < 2; i++) {
      const leg = this.legs[i];
      if (leg.state !== 'plant') continue;
      const score = (this.x - leg.foot.x) * direction;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  clampFootXToReach(index, x) {
    const hip = this.hipFor(index);
    const maxReach = this.cfg.upperLeg + this.cfg.lowerLeg - 4;
    for (let n = 0; n < 2; n++) {
      if (this.terrain.clampGroundX) x = this.terrain.clampGroundX(x, 2);
      const groundY = this.terrain.groundYAt ? this.terrain.groundYAt(x) : this.terrain.yAt(x);
      const safeGroundY = groundY == null ? this.terrain.yAt(x) : groundY;
      const dy = safeGroundY - hip.y;
      const maxDX = Math.sqrt(Math.max(1, maxReach * maxReach - dy * dy));
      x = MathEx.clamp(x, hip.x - maxDX, hip.x + maxDX);
    }
    return x;
  }

  predictedLandingX(index, direction, speed01) {
    const stride = this.cfg.stepLength + this.cfg.runStepBonus * speed01;
    let x = this.x + this.vx * this.cfg.landingPrediction + direction * stride * 0.42 + this.stanceOffset(index);
    return this.clampFootXToReach(index, x);
  }

  startNormalStep(index, direction, speed01) {
    const duration = MathEx.lerp(this.cfg.swingTime, this.cfg.runSwingTime, speed01);
    const targetX = this.predictedLandingX(index, direction, speed01);
    this.legs[index].beginSwing(
      targetX,
      (this.terrain.groundYAt ? this.terrain.groundYAt(targetX) : this.terrain.yAt(targetX)) ?? this.terrain.yAt(targetX),
      duration,
      this.cfg.stepHeight * (0.85 + 0.35 * speed01),
      false
    );
  }

  releaseFeetToAir() {
    for (const leg of this.legs) leg.releaseToAir();
  }

  snapFeetOnLanding() {
    for (let i = 0; i < 2; i++) {
      const leg = this.legs[i];
      let x = this.clampFootXToReach(i, leg.foot.x);
      x = MathEx.clamp(x, this.x - 44, this.x + 44);
      const gy = (this.terrain.groundYAt ? this.terrain.groundYAt(x) : this.terrain.yAt(x));
      if (gy != null) leg.plant(x, gy);
      else leg.releaseToAir();
    }
    this.stepPulse = 1;
  }

  updateFootStates(dt, moving, speed01, direction) {
    for (const leg of this.legs) {
      leg.lastFootX = leg.foot.x;
      leg.lastFootY = leg.foot.y;

      if (leg.state === 'plant') {
        leg.foot.x = leg.plantX;
        leg.foot.y = leg.plantY;
        leg.foot.vx = 0;
        leg.foot.vy = 0;
      } else if (leg.state === 'swing') {
        const s = leg.swing;
        s.t = Math.min(1, s.t + dt / s.duration);
        const t = s.t;
        leg.foot.x = MathEx.hermite(s.sx, s.svx, s.tx, 0, t, s.duration);
        leg.foot.y = MathEx.hermite(s.sy, s.svy, s.ty, 0, t, s.duration) - MathEx.hump(t) * s.height;
        leg.foot.vx = (leg.foot.x - leg.lastFootX) / dt;
        leg.foot.vy = (leg.foot.y - leg.lastFootY) / dt;

        if (t >= 1) {
          leg.plant(s.tx, s.ty);
          this.stepPulse = 1;
        }
      } else if (leg.state === 'air') {
        const hip = this.hipFor(leg.index);
        const targetX = hip.x - this.vx * 0.020 - this.facing * this.cfg.airTuckX + this.stanceOffset(leg.index)
          + (leg.index ? this.cfg.airSpread : -this.cfg.airSpread) * 0.5;
        const targetY = hip.y + this.cfg.airTuckY + (leg.index ? 2 : -2);
        const ax = (targetX - leg.foot.x) * this.cfg.airFootSpring - leg.foot.vx * this.cfg.airFootDamping;
        const ay = (targetY - leg.foot.y) * this.cfg.airFootSpring - leg.foot.vy * this.cfg.airFootDamping + this.cfg.gravity * 0.18;
        leg.foot.vx += ax * dt;
        leg.foot.vy += ay * dt;
        leg.foot.vx = MathEx.clamp(leg.foot.vx, -720, 720);
        leg.foot.vy = MathEx.clamp(leg.foot.vy, -720, 720);
        leg.foot.x += leg.foot.vx * dt;
        leg.foot.y += leg.foot.vy * dt;
      }
    }

    if (!this.onGround) return;

    if (this.legs.some((leg) => leg.state === 'air')) {
      if (!this.anySwing()) this.snapFeetOnLanding();
      return;
    }

    if (this.anySwing()) return;

    if (moving) {
      const index = this.chooseTrailingLeg(direction);
      const leg = this.legs[index];
      const hip = this.hipFor(index);
      const trailing = (this.x - leg.foot.x) * direction;
      const reach = MathEx.hypot(leg.foot.x - hip.x, leg.foot.y - hip.y) / (this.cfg.upperLeg + this.cfg.lowerLeg);
      if (!this.wasMoving || trailing > this.cfg.stepTrigger || reach > 0.90) {
        this.startNormalStep(index, direction, speed01);
      }
    } else if (Math.abs(this.vx) < 2) {
      let worst = -1;
      let worstDistance = 0;
      for (let i = 0; i < 2; i++) {
        const home = this.x + this.stanceOffset(i);
        const distance = Math.abs(this.legs[i].foot.x - home);
        if (distance > worstDistance) {
          worstDistance = distance;
          worst = i;
        }
      }
      if (worst >= 0 && worstDistance > this.cfg.restRecenter) {
        const targetX = this.clampFootXToReach(worst, this.x + this.stanceOffset(worst));
        this.legs[worst].beginSwing(
          targetX,
          (this.terrain.groundYAt ? this.terrain.groundYAt(targetX) : this.terrain.yAt(targetX)) ?? this.terrain.yAt(targetX),
          this.cfg.stopSettleTime,
          this.cfg.stepHeight * 0.52,
          false
        );
      }
    }
  }

  updateKnees(dt, speed01) {
    for (let i = 0; i < 2; i++) {
      const leg = this.legs[i];
      const hip = this.hipFor(i);
      const swingT = leg.state === 'swing' ? leg.swing.t : 0;
      const wobble = Math.sin(this.time * 9 + i * 2.3 + swingT * Math.PI) * this.cfg.kneeWobble * speed01;
      const target = this.solveKnee(
        hip.x,
        hip.y,
        leg.foot.x,
        leg.foot.y,
        -this.facing * this.cfg.kneeBend
      );
      target.x += wobble;

      const oldX = leg.knee.x;
      const oldY = leg.knee.y;
      leg.knee.x = MathEx.expLerp(leg.knee.x, target.x, this.cfg.kneeResponse, dt);
      leg.knee.y = MathEx.expLerp(leg.knee.y, target.y, this.cfg.kneeResponse, dt);

      const dx = leg.knee.x - target.x;
      const dy = leg.knee.y - target.y;
      const distance = MathEx.hypot(dx, dy);
      if (distance > this.cfg.kneeLagMax) {
        leg.knee.x = target.x + dx / distance * this.cfg.kneeLagMax;
        leg.knee.y = target.y + dy / distance * this.cfg.kneeLagMax;
      }

      if (!Number.isFinite(leg.knee.x + leg.knee.y)) {
        leg.knee.x = oldX;
        leg.knee.y = oldY;
      }
    }
  }

  update(dt, pointer) {
    this.time += dt;
    if (this.tempHealthTime > 0) {
      this.tempHealthTime = Math.max(0, this.tempHealthTime - dt);
      if (this.tempHealthTime <= 0) this.tempHealth = 0;
    }

    const axis = this.input.axis('left', 'right');
    const running = this.input.down('run');
    const maxSpeed = running ? this.cfg.runSpeed : this.cfg.walkSpeed;

    this.prevVx = this.vx;
    if (axis) {
      this.facing = axis;
      const acceleration = this.onGround ? this.cfg.accel : this.cfg.airAccel;
      this.vx = MathEx.clamp(this.vx + axis * acceleration * dt, -maxSpeed, maxSpeed);
    } else if (this.onGround) {
      const drag = this.cfg.friction * dt;
      this.vx = Math.abs(this.vx) <= drag ? 0 : this.vx - Math.sign(this.vx) * drag;
    }

    if (this.input.down('jump') && this.onGround) {
      this.vy = -this.cfg.jumpSpeed;
      this.onGround = false;
      this.landingPulse = 0;
      this.releaseFeetToAir();
    }

    const moving = Math.abs(this.vx) > 14;
    const speed01 = MathEx.clamp(Math.abs(this.vx) / this.cfg.runSpeed, 0, 1);
    const direction = Math.sign(this.vx) || this.facing;

    this.x += this.vx * dt;
    this.x = MathEx.clamp(this.x, this.cfg.bodyW / 2 + 16, this.worldWidth - this.cfg.bodyW / 2 - 16);

    const hasGround = this.terrain.hasGroundAt ? this.terrain.hasGroundAt(this.x) : true;
    if (!hasGround && this.onGround) {
      this.onGround = false;
      this.releaseFeetToAir();
    }

    const swingInfo = this.currentSwingInfo();
    const gaitLift = this.onGround && swingInfo && !swingInfo.landing
      ? MathEx.hump(swingInfo.t) * this.cfg.bodyBob * speed01
      : 0;

    this.landingPulse = Math.max(0, this.landingPulse - dt * 5.2);
    this.stepPulse = Math.max(0, this.stepPulse - dt * 8.0);

    if (this.onGround && hasGround) {
      const squash = this.landingPulse * this.cfg.landingSquash;
      const targetY = this.supportBaseY() - gaitLift + squash + this.stepPulse * 1.1;
      this.vy += ((targetY - this.y) * this.cfg.supportSpring - this.vy * this.cfg.supportDamping) * dt;
    } else {
      this.vy += this.cfg.gravity * dt;
    }
    this.y += this.vy * dt;

    if (!this.onGround && hasGround && this.vy >= 0 && this.y >= this.supportBaseY()) {
      const impact = this.vy;
      this.onGround = true;
      this.landingPulse = MathEx.clamp((impact - 120) / 430, 0, 1);
      if (this.cfg.landingSnap >= 0.5) this.snapFeetOnLanding();
    }

    const groundY = this.terrain.groundYAt ? this.terrain.groundYAt(this.x) : this.terrain.yAt(this.x);
    if (groundY != null) {
      const bodyFloor = groundY - this.cfg.bodyH / 2 - 7;
      if (this.y > bodyFloor) {
        this.y = bodyFloor;
        this.vy = Math.min(0, this.vy);
        if (!this.onGround) {
          this.onGround = true;
          this.landingPulse = 1;
          if (this.cfg.landingSnap >= 0.5) this.snapFeetOnLanding();
        }
      }
    }

    const acceleration = (this.vx - this.prevVx) / Math.max(dt, 0.0001);
    const velocityLean = (this.vx / this.cfg.runSpeed) * this.cfg.accelLean;
    const accelKick = MathEx.clamp(acceleration / this.cfg.accel, -1, 1) * this.cfg.accelLean * 0.38;
    this.bodyAngle = MathEx.expLerp(
      this.bodyAngle,
      MathEx.clamp(velocityLean + accelKick, -0.19, 0.19),
      this.onGround ? 11 : 4,
      dt
    );

    this.updateFootStates(dt, moving, speed01, direction);
    this.updateKnees(dt, speed01);
    this.hand.update(dt, this, pointer);
    this.arm.update(dt, this, this.hand);
    this.weaponMount.update(dt, this, pointer);
    this.wasMoving = moving;
  }

  drawSegment(ctx, a, b, width, color) {
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

  drawLeg(ctx, index, debug) {
    const hip = this.hipFor(index);
    const leg = this.legs[index];
    const knee = leg.knee;
    const foot = leg.foot;

    this.drawSegment(ctx, hip, knee, 10, this.appearance[`legUpper${index}`]);
    this.drawSegment(ctx, knee, foot, 9, this.appearance[`legLower${index}`]);

    ctx.save();
    ctx.translate(foot.x, foot.y);
    const footAngle = leg.state === 'plant' ? Math.atan(this.terrain.slopeAt(foot.x)) : 0;
    ctx.rotate(footAngle);

    if (!this.drawSpriteCentered(
      ctx,
      this.characterSprites.foot,
      0,
      -this.cfg.footH * 0.5,
      this.cfg.footW * 1.35,
      this.cfg.footH * 2.2
    )) {
      ctx.fillStyle = '#202020';
      ctx.fillRect(-this.cfg.footW / 2 - 2, -this.cfg.footH - 2, this.cfg.footW + 4, this.cfg.footH + 4);
      ctx.fillStyle = this.appearance[`foot${index}`];
      ctx.fillRect(-this.cfg.footW / 2, -this.cfg.footH, this.cfg.footW, this.cfg.footH);
    }
    ctx.restore();

    if (debug) {
      ctx.fillStyle = index ? '#ff7' : '#7ff';
      for (const point of [hip, knee, foot]) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (leg.state === 'plant') {
        ctx.fillStyle = '#7f7';
        ctx.fillRect(leg.plantX - 3, leg.plantY - 3, 6, 6);
      }
      if (leg.state === 'swing') {
        ctx.strokeStyle = '#f7f';
        ctx.strokeRect(leg.swing.tx - 4, leg.swing.ty - 4, 8, 8);
      }
    }
  }

  render(ctx, debug = false, options = {}) {
    this.drawLeg(ctx, 0, debug);
    this.drawLeg(ctx, 1, debug);

    // Arm first: its center-mounted shoulder is hidden beneath the square body.
    // This makes the strange spindly connector feel attached without drawing a
    // visible shoulder joint on the face of the character.
    this.arm.render(ctx, this, this.hand, debug);

    const swing = this.currentSwingInfo();
    const sway = swing && !swing.landing
      ? Math.sin(Math.PI * swing.t) * (swing.leg.index ? 1 : -1) * this.cfg.bodySway
      : 0;

    ctx.save();
    ctx.translate(this.x + sway, this.y);
    ctx.rotate(this.bodyAngle);
    if (!this.drawSpriteCentered(ctx, this.characterSprites.body, 0, 0, this.cfg.bodyW * 1.22, this.cfg.bodyH * 1.22)) {
      ctx.fillStyle = '#202020';
      ctx.fillRect(-this.cfg.bodyW / 2 - 2, -this.cfg.bodyH / 2 - 2, this.cfg.bodyW + 4, this.cfg.bodyH + 4);
      ctx.fillStyle = this.appearance.body;
      ctx.fillRect(-this.cfg.bodyW / 2, -this.cfg.bodyH / 2, this.cfg.bodyW, this.cfg.bodyH);
    }
    ctx.restore();

    // No face for now. Hand is visible over the body; the equipped weapon is
    // drawn last so its grip/muzzle stay readable.
    this.hand.color = this.appearance.hand;
    this.hand.render(ctx, this, debug, options.showAimPointer !== false);
    this.weaponMount.render(ctx, debug);
  }

  debugText() {
    return `vx ${this.vx.toFixed(1)}  vy ${this.vy.toFixed(1)}  grounded ${this.onGround}  slope ${this.terrain.slopeAt(this.x).toFixed(2)}  L:${this.legs[0].state.toUpperCase()} R:${this.legs[1].state.toUpperCase()}`;
  }
}
