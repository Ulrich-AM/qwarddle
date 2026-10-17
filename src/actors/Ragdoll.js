'use strict';

class Ragdoll {
  constructor({ actor, terrain, lifetime = 4.2 } = {}) {
    this.actor = actor;
    this.terrain = terrain;
    this.cfg = actor.cfg;
    this.appearance = { ...actor.appearance };
    this.age = 0;
    this.lifetime = lifetime;
    this.fadeStart = Math.max(0, lifetime - 1.35);
    this.dead = false;

    const baseVx = actor.vx || 0;
    const baseVy = actor.vy || 0;
    this.body = {
      x:actor.x,
      y:actor.y,
      vx:baseVx,
      vy:baseVy,
      angle:actor.bodyAngle || 0,
      av:MathEx.clamp(baseVx * 0.004 + (Math.random() - 0.5) * 2.2, -4, 4),
      radius:Math.max(this.cfg.bodyW, this.cfg.bodyH) * 0.48
    };

    const leg0 = actor.legs?.[0];
    const leg1 = actor.legs?.[1];
    const elbow = actor.arm?.elbow || { x:actor.x + 24, y:actor.y };
    const hand = actor.hand || { x:actor.x + 54, y:actor.y };

    this.elbow = this.makePoint(elbow.x, elbow.y, baseVx, baseVy, 8);
    this.hand = this.makePoint(hand.x, hand.y, hand.vx ?? baseVx, hand.vy ?? baseVy, 11);
    this.knee0 = this.makePoint(leg0?.knee?.x ?? actor.x - 10, leg0?.knee?.y ?? actor.y + 38, baseVx, baseVy, 8);
    this.foot0 = this.makePoint(leg0?.foot?.x ?? actor.x - 12, leg0?.foot?.y ?? actor.y + 70, leg0?.foot?.vx ?? baseVx, leg0?.foot?.vy ?? baseVy, 12);
    this.knee1 = this.makePoint(leg1?.knee?.x ?? actor.x + 10, leg1?.knee?.y ?? actor.y + 38, baseVx, baseVy, 8);
    this.foot1 = this.makePoint(leg1?.foot?.x ?? actor.x + 12, leg1?.foot?.y ?? actor.y + 70, leg1?.foot?.vx ?? baseVx, leg1?.foot?.vy ?? baseVy, 12);

    this.weapon = this.createDroppedWeapon(actor);
  }

  makePoint(x, y, vx, vy, radius) {
    return { x, y, vx:vx || 0, vy:vy || 0, radius };
  }

  createDroppedWeapon(actor) {
    const weapon = actor.weaponMount?.weapon;
    if (!weapon) return null;

    const entry = WeaponRegistry.list.find((candidate) => candidate.id === weapon.id);
    const image = entry?.sprite ? new Image() : null;
    if (image) image.src = entry.sprite;

    return {
      id:weapon.id,
      image,
      x:actor.hand?.x ?? actor.x,
      y:actor.hand?.y ?? actor.y,
      vx:(actor.hand?.vx ?? actor.vx ?? 0) + (actor.weaponMount?.dirX ?? actor.facing ?? 1) * 90,
      vy:(actor.hand?.vy ?? actor.vy ?? 0) - 90,
      angle:actor.weaponMount?.angle ?? 0,
      av:(Math.random() < 0.5 ? -1 : 1) * (3.5 + Math.random() * 3.5),
      radius:18
    };
  }

  opacity() {
    if (this.age <= this.fadeStart) return 1;
    return MathEx.clamp(1 - (this.age - this.fadeStart) / Math.max(0.001, this.lifetime - this.fadeStart), 0, 1);
  }

  bodyAnchor(localX, localY) {
    const c = Math.cos(this.body.angle);
    const s = Math.sin(this.body.angle);
    return {
      x:this.body.x + localX * c - localY * s,
      y:this.body.y + localX * s + localY * c
    };
  }

  applyFluidPhysics(point, dt, gravity = 1450) {
    let ay = gravity;
    const waterY = this.terrain.waterY;
    const radius = point.radius || 0;
    const submerged = MathEx.clamp((point.y + radius - waterY) / Math.max(16, radius * 2 + 24), 0, 1);

    if (submerged > 0) {
      // Buoyancy becomes stronger with depth, creating a damped bob around the surface.
      ay -= gravity * 2.15 * submerged;
      const drag = Math.exp(-3.4 * submerged * dt);
      point.vx *= drag;
      point.vy *= drag;
    }

    point.vy += ay * dt;
    point.x += point.vx * dt;
    point.y += point.vy * dt;
    return submerged;
  }

  resolveCircle(point, bounce = 0.16, friction = 0.72) {
    const radius = point.radius || 0;

    for (const rect of this.terrain.rectangles || []) {
      const left = rect.x - radius;
      const right = rect.x + rect.w + radius;
      const top = rect.y - radius;
      const bottom = rect.y + rect.h + radius;

      if (point.x <= left || point.x >= right || point.y <= top || point.y >= bottom) continue;

      const dl = point.x - left;
      const dr = right - point.x;
      const dt = point.y - top;
      const db = bottom - point.y;
      const minimum = Math.min(dl, dr, dt, db);

      if (minimum === dl) {
        point.x = left;
        if (point.vx > 0) point.vx *= -bounce;
        point.vy *= friction;
      } else if (minimum === dr) {
        point.x = right;
        if (point.vx < 0) point.vx *= -bounce;
        point.vy *= friction;
      } else if (minimum === dt) {
        point.y = top;
        if (point.vy > 0) point.vy *= -bounce;
        point.vx *= friction;
      } else {
        point.y = bottom;
        if (point.vy < 0) point.vy *= -bounce;
        point.vx *= friction;
      }
    }

    const minX = radius;
    const maxX = this.terrain.worldWidth - radius;
    if (point.x < minX) {
      point.x = minX;
      point.vx = Math.abs(point.vx) * bounce;
    } else if (point.x > maxX) {
      point.x = maxX;
      point.vx = -Math.abs(point.vx) * bounce;
    }
  }

  constrainPointToAnchor(point, anchor, length) {
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    const distance = MathEx.hypot(dx, dy) || 0.001;
    const error = distance - length;
    const nx = dx / distance;
    const ny = dy / distance;
    point.x -= nx * error;
    point.y -= ny * error;
  }

  constrainPair(a, b, length) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = MathEx.hypot(dx, dy) || 0.001;
    const correction = (distance - length) * 0.5;
    const nx = dx / distance;
    const ny = dy / distance;
    a.x += nx * correction;
    a.y += ny * correction;
    b.x -= nx * correction;
    b.y -= ny * correction;
  }

  solveConstraints() {
    const hip0 = this.bodyAnchor(-this.cfg.hipInset, this.cfg.bodyH * 0.38);
    const hip1 = this.bodyAnchor(this.cfg.hipInset, this.cfg.bodyH * 0.38);
    const shoulder = this.bodyAnchor(0, 0);
    const upperArm = 48;
    const lowerArm = 48;

    for (let i = 0; i < 5; i++) {
      this.constrainPointToAnchor(this.elbow, shoulder, upperArm);
      this.constrainPair(this.elbow, this.hand, lowerArm);
      this.constrainPointToAnchor(this.knee0, hip0, this.cfg.upperLeg);
      this.constrainPair(this.knee0, this.foot0, this.cfg.lowerLeg);
      this.constrainPointToAnchor(this.knee1, hip1, this.cfg.upperLeg);
      this.constrainPair(this.knee1, this.foot1, this.cfg.lowerLeg);
    }
  }

  update(dt) {
    if (this.dead) return;
    this.age += dt;
    if (this.age >= this.lifetime) {
      this.dead = true;
      return;
    }

    const bodySubmerged = this.applyFluidPhysics(this.body, dt);
    this.body.angle += this.body.av * dt;
    this.body.av *= Math.exp(-(bodySubmerged > 0 ? 2.6 : 0.38) * dt);
    this.resolveCircle(this.body, 0.10, 0.68);

    const points = [this.elbow, this.hand, this.knee0, this.foot0, this.knee1, this.foot1];
    for (const point of points) {
      this.applyFluidPhysics(point, dt);
      this.resolveCircle(point, 0.12, 0.72);
    }

    this.solveConstraints();

    // Constraint solving can push points slightly into terrain, so finish with
    // one collision cleanup pass.
    for (const point of points) this.resolveCircle(point, 0.08, 0.78);

    if (this.weapon) {
      const submerged = this.applyFluidPhysics(this.weapon, dt);
      this.weapon.angle += this.weapon.av * dt;
      this.weapon.av *= Math.exp(-(submerged > 0 ? 2.8 : 0.32) * dt);
      this.resolveCircle(this.weapon, 0.18, 0.70);
    }
  }

  renderWeapon(ctx) {
    if (!this.weapon) return;
    const weapon = this.weapon;

    ctx.save();
    ctx.translate(Math.round(weapon.x), Math.round(weapon.y));
    ctx.rotate(weapon.angle);
    ctx.imageSmoothingEnabled = false;

    if (weapon.image?.complete && weapon.image.naturalWidth > 0) {
      const desired = weapon.id === 'wand' ? 72 : 78;
      const scale = desired / Math.max(1, weapon.image.naturalWidth);
      const width = Math.max(1, Math.round(weapon.image.naturalWidth * scale));
      const height = Math.max(1, Math.round(weapon.image.naturalHeight * scale));
      ctx.drawImage(weapon.image, -Math.round(width * 0.5), -Math.round(height * 0.5), width, height);
    } else {
      ctx.fillStyle = '#202020';
      ctx.fillRect(-22, -5, 44, 10);
    }

    ctx.restore();
  }

  render(ctx) {
    if (this.dead) return;
    const alpha = this.opacity();
    if (alpha <= 0) return;

    const hip0 = this.bodyAnchor(-this.cfg.hipInset, this.cfg.bodyH * 0.38);
    const hip1 = this.bodyAnchor(this.cfg.hipInset, this.cfg.bodyH * 0.38);
    const shoulder = this.bodyAnchor(0, 0);
    const actor = this.actor;

    ctx.save();
    ctx.globalAlpha *= alpha;

    actor.drawPixelLine(ctx, hip0, this.knee0, 18, '#202020');
    actor.drawPixelLine(ctx, this.knee0, this.foot0, 17, '#202020');
    actor.drawPixelLine(ctx, hip1, this.knee1, 18, '#202020');
    actor.drawPixelLine(ctx, this.knee1, this.foot1, 17, '#202020');
    actor.drawPixelLine(ctx, shoulder, this.elbow, this.cfg.armWidthUpper + 8, '#202020');
    actor.drawPixelLine(ctx, this.elbow, this.hand, this.cfg.armWidthLower + 8, '#202020');

    actor.drawPixelLine(ctx, hip0, this.knee0, 10, this.appearance.legUpper0);
    actor.drawPixelLine(ctx, this.knee0, this.foot0, 9, this.appearance.legLower0);
    actor.drawPixelLine(ctx, hip1, this.knee1, 10, this.appearance.legUpper1);
    actor.drawPixelLine(ctx, this.knee1, this.foot1, 9, this.appearance.legLower1);
    actor.drawPixelLine(ctx, shoulder, this.elbow, this.cfg.armWidthUpper, this.appearance.armUpper);
    actor.drawPixelLine(ctx, this.elbow, this.hand, this.cfg.armWidthLower, this.appearance.armLower);

    actor.drawPixelCircle(ctx, this.foot0.x, this.foot0.y, 12, this.appearance.foot0, 2);
    actor.drawPixelCircle(ctx, this.foot1.x, this.foot1.y, 12, this.appearance.foot1, 2);
    actor.drawPixelCircle(ctx, this.hand.x, this.hand.y, this.cfg.handSize * 0.56, this.appearance.hand, 2);

    ctx.save();
    ctx.translate(Math.round(this.body.x), Math.round(this.body.y));
    const angleStep = Math.PI / 32;
    ctx.rotate(Math.round(this.body.angle / angleStep) * angleStep);
    ctx.imageSmoothingEnabled = false;

    if (!actor.drawCharacterPart(
      ctx,
      actor.characterSprites.body,
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

    this.renderWeapon(ctx);
    ctx.restore();
  }
}
