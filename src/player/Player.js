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
      body:{
        base:this.loadCharacterSprite('qward-body.png'),
        color:this.loadCharacterSprite('qward-body-color.png')
      }
    };
    this.characterTintCache = new WeakMap();

    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.prevVx = 0;
    this.onGround = true;
    this.facing = 1;
    this.bodyAngle = 0;
    this.bodyAngularVelocity = 0;
    this.wasMoving = false;
    this.landingPulse = 0;
    this.stepPulse = 0;
    this.time = 0;

    // Minimal combat state. tempHealth is a disposable buffer used by
    // effects such as the revolver reload buff.
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.dead = false;
    this.hitFlash = 0;
    this.tempHealth = 0;
    this.tempHealthTime = 0;
    this.buffs = new Map();
    this.bleedTime = 0;
    this.bleedDps = 0;
    this.stunTime = 0;

    this.legs = [new ProceduralLeg(0), new ProceduralLeg(1)];
    this.activeBody = new ActiveBodySupport(this);
    this.hand = new FloatingHand({ terrain:this.terrain, config:this.cfg });
    this.arm = new ProceduralArm({ config:this.cfg });
    this.weaponMount = new WeaponMount({ hand:this.hand });
  }

  loadCharacterSprite(file) {
    const image = new Image();
    image.src = this.spriteRoot + file;
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

  tintedCharacterLayer(image, color) {
    if (!this.spriteReady(image)) return null;

    let byColor = this.characterTintCache.get(image);
    if (!byColor) {
      byColor = new Map();
      this.characterTintCache.set(image, byColor);
    }
    if (byColor.has(color)) return byColor.get(color);

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // The -color sprite is a transparent layer whose #ff0000 region marks
    // recolorable pixels. Tinting the layer avoids file:// pixel readback.
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';

    byColor.set(color, canvas);
    return canvas;
  }

  drawCharacterPart(ctx, sprites, tint, centerX, centerY, maxWidth, maxHeight = maxWidth) {
    const baseReady = this.spriteReady(sprites?.base);
    const colorReady = this.spriteReady(sprites?.color);
    if (!baseReady && !colorReady) return false;

    const reference = baseReady ? sprites.base : sprites.color;
    const rawScale = Math.min(maxWidth / reference.naturalWidth, maxHeight / reference.naturalHeight);
    const scale = rawScale >= 1 ? Math.max(1, Math.floor(rawScale)) : rawScale;
    const width = Math.max(1, Math.round(reference.naturalWidth * scale));
    const height = Math.max(1, Math.round(reference.naturalHeight * scale));
    const x = Math.round(centerX - width / 2);
    const y = Math.round(centerY - height / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (colorReady) {
      const tinted = this.tintedCharacterLayer(sprites.color, tint);
      if (tinted) ctx.drawImage(tinted, x, y, width, height);
    }

    if (baseReady) ctx.drawImage(sprites.base, x, y, width, height);
    ctx.restore();
    return true;
  }

  setAppearance(appearance) {
    this.appearance = { ...this.appearance, ...(appearance || {}) };
    this.hand.color = this.appearance.hand;
  }

  resize(width) {
    this.worldWidth = width;
  }

  supportBaseY(x = this.x, referenceY = null) {
    let ground = null;
    if (referenceY != null && this.terrain.surfaceYAt) {
      ground = this.terrain.surfaceYAt(x, referenceY);
    }
    if (ground == null) {
      ground = this.terrain.groundYAt ? this.terrain.groundYAt(x) : this.terrain.yAt(x);
    }
    const y = ground == null ? this.terrain.yAt(x) : ground;
    return y - this.cfg.bodyH / 2 - this.cfg.bodyHeight;
  }

  footSurfaceY(x, referenceY = null) {
    const ref = referenceY ?? this.collisionBox().bottom;
    if (this.terrain.surfaceYAt) {
      const y = this.terrain.surfaceYAt(x, ref);
      if (y != null) return y;
    }
    const ground = this.terrain.groundYAt ? this.terrain.groundYAt(x) : this.terrain.yAt(x);
    return ground == null ? this.terrain.yAt(x) : ground;
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

  constrainLegReach(index) {
    const leg = this.legs[index];
    const hip = this.hipFor(index);
    const maxReach = (this.cfg.upperLeg + this.cfg.lowerLeg) * 0.94;
    const dx = leg.foot.x - hip.x;
    const dy = leg.foot.y - hip.y;
    const distance = MathEx.hypot(dx, dy);

    if (distance <= maxReach || distance <= 0.001) return;

    const nx = dx / distance;
    const ny = dy / distance;
    leg.foot.x = hip.x + nx * maxReach;
    leg.foot.y = hip.y + ny * maxReach;

    const outwardSpeed = leg.foot.vx * nx + leg.foot.vy * ny;
    if (outwardSpeed > 0) {
      leg.foot.vx -= outwardSpeed * nx;
      leg.foot.vy -= outwardSpeed * ny;
    }

    // A planted foot should not immediately snap back to an impossible point on
    // the next frame. Move its safety anchor with the constrained foot instead.
    if (leg.state === 'plant') {
      leg.plantX = leg.foot.x;
      leg.plantY = leg.foot.y;
    }
  }

  placeAt(x, referenceY = null) {
    this.x = x;
    this.y = this.supportBaseY(x, referenceY);
    this.vx = 0;
    this.vy = 0;
    this.prevVx = 0;
    this.onGround = true;
    this.bodyAngle = 0;
    this.bodyAngularVelocity = 0;
    this.landingPulse = 0;
    this.stepPulse = 0;

    for (let i = 0; i < 2; i++) {
      const leg = this.legs[i];
      const footX = this.x + this.stanceOffset(i);
      const footY = this.footSurfaceY(footX, this.collisionBox().bottom);
      const hip = this.hipFor(i);
      leg.plant(footX, footY);
      const knee = this.solveKnee(hip.x, hip.y, footX, footY, -this.facing * this.cfg.kneeBend);
      leg.knee.x = knee.x;
      leg.knee.y = knee.y;
      leg.lastFootX = footX;
      leg.lastFootY = footY;
    }

    this.activeBody.reset();
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
    this.bodyAngularVelocity = 0;
    this.wasMoving = false;
    this.landingPulse = 0;
    this.stepPulse = 0;
    this.time = 0;

    // Minimal combat state. tempHealth is a disposable buffer used by
    // effects such as the revolver reload buff.
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.dead = false;
    this.hitFlash = 0;
    this.tempHealth = 0;
    this.tempHealthTime = 0;
    this.buffs.clear();
    this.bleedTime = 0;
    this.bleedDps = 0;
    this.stunTime = 0;

    for (let i = 0; i < 2; i++) {
      const leg = this.legs[i];
      const footX = this.x + this.stanceOffset(i);
      const footY = this.footSurfaceY(footX, this.collisionBox().bottom);
      const hip = this.hipFor(i);
      leg.plant(footX, footY);
      const knee = this.solveKnee(hip.x, hip.y, footX, footY, -this.facing * this.cfg.kneeBend);
      leg.knee.x = knee.x;
      leg.knee.y = knee.y;
      leg.lastFootX = footX;
      leg.lastFootY = footY;
    }

    this.activeBody.reset();
    this.hand.reset(this);
    this.arm.reset(this, this.hand);
  }


  grantTemporaryHealth(amount, duration) {
    this.tempHealth = Math.max(this.tempHealth, amount);
    this.tempHealthTime = Math.max(this.tempHealthTime, duration);
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + Math.max(0, amount || 0));
  }

  addBuff(id, duration, multipliers = {}) {
    this.buffs.set(id, {
      time:Math.max(0, duration || 0),
      defense:multipliers.defense ?? 1,
      damage:multipliers.damage ?? 1,
      melee:multipliers.melee ?? 1,
      move:multipliers.move ?? 1,
      jump:multipliers.jump ?? 1,
      regen:multipliers.regen ?? 0,
      opacity:multipliers.opacity ?? 1,
      invulnerable:!!multipliers.invulnerable
    });
  }

  removeBuff(id) {
    this.buffs.delete(id);
  }

  buffMultiplier(key) {
    let value = 1;
    for (const buff of this.buffs.values()) value *= buff[key] ?? 1;
    return value;
  }

  visualOpacity() {
    let opacity = 1;
    for (const buff of this.buffs.values()) opacity *= buff.opacity ?? 1;
    return MathEx.clamp(opacity, 0.08, 1);
  }

  isInvulnerable() {
    for (const buff of this.buffs.values()) {
      if (buff.invulnerable) return true;
    }
    return false;
  }

  applyBleed(duration = 3, dps = 3) {
    this.bleedTime = Math.max(this.bleedTime, duration);
    this.bleedDps = Math.max(this.bleedDps, dps);
  }

  applyStun(duration = 0.5) {
    this.stunTime = Math.max(this.stunTime, duration);
  }

  takeDamage(amount) {
    if (this.isInvulnerable()) return false;
    let remaining = Math.max(0, amount) * this.buffMultiplier('defense');
    if (this.tempHealth > 0) {
      const absorbed = Math.min(this.tempHealth, remaining);
      this.tempHealth -= absorbed;
      remaining -= absorbed;
    }
    this.health = Math.max(0, this.health - remaining);
    return this.health <= 0;
  }

  hitbox() {
    return {
      x:this.x,
      y:this.y,
      w:this.cfg.bodyW,
      h:this.cfg.bodyH
    };
  }

  takeHit(projectile) {
    if (this.dead || this.isInvulnerable()) return false;

    this.takeDamage(projectile.damage);
    if (!projectile.noPhysicalHit) {
      const speed = MathEx.hypot(projectile.vx, projectile.vy) || 1;
      const dx = projectile.vx / speed;
      const dy = projectile.vy / speed;
      this.vx += dx * projectile.knockback;
      this.vy += dy * projectile.knockback * 0.16 - 55;
      this.bodyAngularVelocity += dx * projectile.knockback * 0.0024;
      if (this.onGround && Math.abs(projectile.knockback) > 0) {
        this.onGround = false;
        this.releaseFeetToAir?.();
      }
    }

    this.hitFlash = 0.11;
    if (this.health <= 0) this.dead = true;
    return this.dead;
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
      const safeGroundY = this.footSurfaceY(x, this.collisionBox().bottom);
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
      this.footSurfaceY(targetX, this.collisionBox().bottom),
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
      const gy = this.footSurfaceY(x, this.collisionBox().bottom);
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
          this.footSurfaceY(targetX, this.collisionBox().bottom),
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

  collisionBox(x = this.x, y = this.y) {
    const halfW = this.cfg.bodyW * 0.5;
    const halfH = this.cfg.bodyH * 0.5;
    return {
      left:x - halfW,
      right:x + halfW,
      top:y - halfH,
      bottom:y + halfH
    };
  }

  bodyHasSupport() {
    this.activeBody.evaluate();
    return this.activeBody.strength > this.cfg.supportMinStrength;
  }

  resolveHorizontalBodyCollision(previousX) {
    const previous = this.collisionBox(previousX, this.y);
    let current = this.collisionBox();

    for (const rect of this.terrain.rectangles || []) {
      // Merely standing on a floor does not count as horizontal penetration.
      if (current.bottom <= rect.y + 1 || current.top >= rect.y + rect.h - 1) continue;

      if (this.vx > 0 && previous.right <= rect.x + 0.5 && current.right > rect.x) {
        this.x = rect.x - this.cfg.bodyW * 0.5;
        this.vx = 0;
        current = this.collisionBox();
      } else if (this.vx < 0 && previous.left >= rect.x + rect.w - 0.5 && current.left < rect.x + rect.w) {
        this.x = rect.x + rect.w + this.cfg.bodyW * 0.5;
        this.vx = 0;
        current = this.collisionBox();
      }
    }
  }

  resolveVerticalBodyCollision(previousY) {
    const previous = this.collisionBox(this.x, previousY);
    let current = this.collisionBox();
    const inset = 4;

    if (this.vy >= 0) {
      let landingTop = Infinity;
      for (const rect of this.terrain.rectangles || []) {
        if (current.right - inset <= rect.x || current.left + inset >= rect.x + rect.w) continue;
        if (previous.bottom <= rect.y + 0.5 && current.bottom >= rect.y) {
          landingTop = Math.min(landingTop, rect.y);
        }
      }

      if (landingTop < Infinity) {
        const impact = this.vy;
        // This is a safety catch. Normal landings happen through the feet first.
        this.activeBody.forceLanding(landingTop, impact);
      }
      return;
    }

    let ceilingBottom = -Infinity;
    for (const rect of this.terrain.rectangles || []) {
      if (current.right - inset <= rect.x || current.left + inset >= rect.x + rect.w) continue;
      const rectBottom = rect.y + rect.h;
      if (previous.top >= rectBottom - 0.5 && current.top <= rectBottom) {
        ceilingBottom = Math.max(ceilingBottom, rectBottom);
      }
    }

    if (ceilingBottom > -Infinity) {
      this.y = ceilingBottom + this.cfg.bodyH * 0.5;
      this.vy = 0;
    }
  }

  resolveBodyPenetration(maxIterations = 4) {
    const rectangles = this.terrain.rectangles || [];
    let corrected = false;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let movedThisPass = false;

      for (const rect of rectangles) {
        const box = this.collisionBox();
        const rectRight = rect.x + rect.w;
        const rectBottom = rect.y + rect.h;

        if (box.right <= rect.x || box.left >= rectRight ||
            box.bottom <= rect.y || box.top >= rectBottom) {
          continue;
        }

        const pushLeft = box.right - rect.x;
        const pushRight = rectRight - box.left;
        const pushUp = box.bottom - rect.y;
        const pushDown = rectBottom - box.top;
        const minimum = Math.min(pushLeft, pushRight, pushUp, pushDown);

        if (minimum === pushLeft) {
          this.x -= pushLeft + 0.01;
          if (this.vx > 0) this.vx = 0;
        } else if (minimum === pushRight) {
          this.x += pushRight + 0.01;
          if (this.vx < 0) this.vx = 0;
        } else if (minimum === pushUp) {
          this.y -= pushUp + 0.01;
          if (this.vy > 0) this.vy = 0;
        } else {
          this.y += pushDown + 0.01;
          if (this.vy < 0) this.vy = 0;
        }

        movedThisPass = true;
        corrected = true;
      }

      if (!movedThisPass) break;
    }

    return corrected;
  }

  updateStatusEffects(dt) {
    for (const [id, buff] of this.buffs) {
      if (buff.regen > 0 && this.health > 0) this.heal(buff.regen * dt);
      buff.time = Math.max(0, buff.time - dt);
      if (buff.time <= 0) this.buffs.delete(id);
    }

    this.stunTime = Math.max(0, this.stunTime - dt);

    if (this.bleedTime > 0) {
      const tick = Math.min(dt, this.bleedTime);
      this.bleedTime = Math.max(0, this.bleedTime - dt);
      this.health = Math.max(0, this.health - this.bleedDps * tick);
      if (this.bleedTime <= 0) this.bleedDps = 0;
    }

    if (this.tempHealthTime > 0) {
      this.tempHealthTime = Math.max(0, this.tempHealthTime - dt);
      if (this.tempHealthTime <= 0) this.tempHealth = 0;
    }
  }

  update(dt, pointer) {
    if (this.dead) return;

    this.time += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.resolveBodyPenetration();
    this.updateStatusEffects(dt);

    if (this.health <= 0) {
      this.dead = true;
      return;
    }

    const stunned = this.stunTime > 0;
    const axis = stunned ? 0 : this.input.axis('left', 'right');
    const running = !stunned && this.input.down('run');
    const moveMultiplier = this.buffMultiplier('move');
    const maxSpeed = (running ? this.cfg.runSpeed : this.cfg.walkSpeed) * moveMultiplier;

    this.activeBody.evaluate();
    this.onGround = this.activeBody.strength > this.cfg.supportMinStrength;

    this.prevVx = this.vx;

    if (axis) {
      this.facing = axis;

      const reversing = Math.sign(this.vx) !== 0 && Math.sign(this.vx) !== Math.sign(axis);
      const baseAcceleration = this.onGround
        ? (reversing ? this.cfg.reverseAccel : this.cfg.accel)
        : this.cfg.airAccel;
      const acceleration = baseAcceleration * moveMultiplier;
      const desired = axis * maxSpeed;
      const step = acceleration * dt;

      // Preserve recoil and bhop overspeed instead of clamping it away the
      // instant movement input is held in the same direction.
      if (Math.sign(this.vx) === Math.sign(desired) && Math.abs(this.vx) > Math.abs(desired)) {
        // no drive force while already exceeding the intended running speed
      } else if (this.vx < desired) {
        this.vx = Math.min(desired, this.vx + step);
      } else if (this.vx > desired) {
        this.vx = Math.max(desired, this.vx - step);
      }
    } else if (this.onGround) {
      const drag = this.cfg.friction * dt;
      this.vx = Math.abs(this.vx) <= drag
        ? 0
        : this.vx - Math.sign(this.vx) * drag;
    }

    const wantsJump = !stunned && this.input.down('jump');
    if (wantsJump && this.activeBody.canJump()) {
      const bhopWindow = this.landingPulse > 0.12;
      const bhopThreshold = this.cfg.walkSpeed * 0.72 * moveMultiplier;

      if (bhopWindow && Math.abs(this.vx) > bhopThreshold) {
        const maxBhop = this.cfg.runSpeed * this.cfg.bhopMaxSpeedMultiplier * moveMultiplier;
        this.vx = Math.sign(this.vx) * Math.min(
          maxBhop,
          Math.abs(this.vx) * this.cfg.bhopBoost
        );
      }

      this.vy = -this.cfg.jumpSpeed * this.buffMultiplier('jump');
      this.landingPulse = 0;
      this.activeBody.release();
    }

    const moving = Math.abs(this.vx) > 14;
    const speed01 = MathEx.clamp(
      Math.abs(this.vx) / Math.max(1, this.cfg.runSpeed * moveMultiplier),
      0,
      1.25
    );
    const direction = Math.sign(this.vx) || this.facing;

    const previousX = this.x;
    this.x += this.vx * dt;
    this.x = MathEx.clamp(
      this.x,
      this.cfg.bodyW / 2 + 16,
      this.worldWidth - this.cfg.bodyW / 2 - 16
    );
    this.resolveHorizontalBodyCollision(previousX);

    this.activeBody.evaluate();
    if (this.onGround && this.activeBody.strength <= this.cfg.supportMinStrength) {
      this.activeBody.release();
    } else {
      this.onGround = this.activeBody.strength > this.cfg.supportMinStrength;
    }

    this.landingPulse = Math.max(0, this.landingPulse - dt * 5.2);
    this.stepPulse = Math.max(0, this.stepPulse - dt * 8.0);

    const previousY = this.y;
    const verticalAcceleration = this.activeBody.verticalAcceleration();
    this.vy += verticalAcceleration * dt;
    this.y += this.vy * dt;

    // Feet get first chance to catch the body. The torso collision below is only
    // a safety net for very fast falls or awkward wall/ledge interactions.
    if (!this.onGround) {
      this.activeBody.tryLanding(previousY, this.y);
    }

    this.resolveVerticalBodyCollision(previousY);
    this.resolveBodyPenetration();

    this.activeBody.evaluate();
    this.onGround = this.activeBody.strength > this.cfg.supportMinStrength;

    const horizontalAcceleration =
      (this.vx - this.prevVx) / Math.max(dt, 0.0001);
    this.activeBody.updateOrientation(dt, horizontalAcceleration);

    this.updateFootStates(dt, moving, speed01, direction);
    this.constrainLegReach(0);
    this.constrainLegReach(1);
    this.activeBody.evaluate();

    if (this.activeBody.strength <= this.cfg.supportMinStrength && this.onGround) {
      this.activeBody.release();
    } else {
      this.onGround = this.activeBody.strength > this.cfg.supportMinStrength;
    }

    this.updateKnees(dt, MathEx.clamp(speed01, 0, 1));
    this.hand.update(dt, this, pointer);
    this.arm.update(dt, this, this.hand);
    this.weaponMount.update(dt, this, pointer);
    this.wasMoving = moving;
  }

  drawPixelLine(ctx, a, b, width, color) {
    const x0 = Math.round(a.x);
    const y0 = Math.round(a.y);
    const x1 = Math.round(b.x);
    const y1 = Math.round(b.y);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    const size = Math.max(1, Math.round(width));

    // The old renderer stamped one large square for every single pixel of line
    // length. These squares overlap heavily, so spacing them by a fraction of
    // their own size keeps the same chunky silhouette with far fewer draw calls.
    const spacing = Math.max(1, Math.floor(size * 0.34));
    const steps = Math.max(1, Math.ceil(distance / spacing));

    ctx.fillStyle = color;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + dx * t);
      const y = Math.round(y0 + dy * t);
      ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    }
  }

  drawPixelCircle(ctx, x, y, radius, color, pixel = 2) {
    const r = Math.max(pixel, Math.round(radius));
    const cx = Math.round(x);
    const cy = Math.round(y);
    ctx.fillStyle = color;

    for (let yy = -r; yy <= r; yy += pixel) {
      const span = Math.floor(Math.sqrt(Math.max(0, r * r - yy * yy)));
      const left = Math.floor(span / pixel) * pixel;
      ctx.fillRect(cx - left, cy + yy, left * 2 + pixel, pixel);
    }
  }

  drawLeg(ctx, index, debug) {
    const hip = this.hipFor(index);
    const leg = this.legs[index];
    const knee = leg.knee;
    const foot = leg.foot;
    const footRadius = 12;
    const visualFoot = { x:foot.x, y:foot.y - footRadius };

    // Build one chunky silhouette first. Joint and foot circles overlap the line
    // ends so the black outline reads as one continuous limb.
    this.drawPixelLine(ctx, hip, knee, 18, '#202020');
    this.drawPixelLine(ctx, knee, visualFoot, 17, '#202020');
    this.drawPixelCircle(ctx, knee.x, knee.y, 9, '#202020', 2);
    this.drawPixelCircle(ctx, visualFoot.x, visualFoot.y, footRadius + 5, '#202020', 2);

    this.drawPixelLine(ctx, hip, knee, 10, this.appearance[`legUpper${index}`]);
    this.drawPixelLine(ctx, knee, visualFoot, 9, this.appearance[`legLower${index}`]);
    this.drawPixelCircle(ctx, knee.x, knee.y, 5, this.appearance[`legLower${index}`], 2);
    this.drawPixelCircle(ctx, visualFoot.x, visualFoot.y, footRadius, this.appearance[`foot${index}`], 2);

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
    ctx.save();
    ctx.globalAlpha *= this.visualOpacity();

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
    ctx.translate(Math.round(this.x + sway), Math.round(this.y));
    const bodyAngleStep = Math.PI / 32;
    ctx.rotate(Math.round(this.bodyAngle / bodyAngleStep) * bodyAngleStep);
    ctx.imageSmoothingEnabled = false;
    if (!this.drawCharacterPart(
      ctx,
      this.characterSprites.body,
      this.appearance.body,
      0,
      0,
      this.cfg.bodyW * 1.22,
      this.cfg.bodyH * 1.22
    )) {
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

    if (this.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha *= MathEx.clamp(this.hitFlash / 0.11, 0, 1) * 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        this.x - this.cfg.bodyW * 0.5,
        this.y - this.cfg.bodyH * 0.5,
        this.cfg.bodyW,
        this.cfg.bodyH
      );
      ctx.restore();
    }

    ctx.restore();
  }

  debugText() {
    return `vx ${this.vx.toFixed(1)}  vy ${this.vy.toFixed(1)}  support ${this.activeBody.strength.toFixed(2)}  grounded ${this.onGround}  L:${this.legs[0].state.toUpperCase()} R:${this.legs[1].state.toUpperCase()}`;
  }
}
