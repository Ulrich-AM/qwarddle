'use strict';

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.active = false;

    this.config = createGameConfig();
    this.keyboard = new KeyboardInput();
    this.pointer = new PointerInput(canvas);
    this.terrain = new Terrain(MapRegistry.get(MapRegistry.list[0]?.id));
    this.camera = new CameraEffects();
    this.rounds = new RoundManager();
    this.projectiles = new ProjectileSystem({ terrain:this.terrain });
    this.selectedMapId = MapRegistry.list[0]?.id || null;
    this.mode = 'solo';

    const p1Controller = new KeyboardMouseController({
      keyboard:this.keyboard,
      pointer:this.pointer
    });
    const p2Controller = new IdleController();

    const p1Loadout = {
      weapon:'revolver',
      appearance:Player.defaultAppearance()
    };
    const p2Loadout = {
      weapon:'revolver',
      appearance:{
        body:'#8c6f78',
        legUpper0:'#b87b59', legLower0:'#b87b59', foot0:'#b87b59',
        legUpper1:'#b87b59', legLower1:'#b87b59', foot1:'#b87b59',
        armUpper:'#6d8f98', armLower:'#6d8f98', hand:'#6d8f98'
      }
    };

    this.fighters = [
      new FighterSlot({
        id:'p1',
        index:0,
        actor:new Player({
          input:p1Controller,
          terrain:this.terrain,
          config:this.config,
          appearance:p1Loadout.appearance
        }),
        controller:p1Controller,
        loadout:p1Loadout
      }).bindGame(this),
      new FighterSlot({
        id:'p2',
        index:1,
        actor:new Player({
          input:p2Controller,
          terrain:this.terrain,
          config:this.config,
          appearance:p2Loadout.appearance
        }),
        controller:p2Controller,
        loadout:p2Loadout
      }).bindGame(this)
    ];
    this.fighters[0].nickname = 'P1';
    this.fighters[1].nickname = 'P2';

    this.ragdollLifetime = 4.2;
    this.hazards = [];
    this.statusEmitters = [];
    this.statusParticles = [];

    this.lastTime = performance.now();
    this.accumulator = 0;
    this.fixedStep = 1 / 120;

    this.resize();
    this.reset();
    this.bindEvents();
  }

  get primarySlot() {
    return this.fighters[0];
  }

  getOpponentSlot(slot) {
    return this.fighters.find((candidate) => candidate !== slot) || null;
  }

  slotForActor(actor) {
    return this.fighters.find((slot) => slot.actor === actor) || null;
  }

  setFighterController(index, controller) {
    const slot = this.fighters[index];
    if (!slot || !controller) return;
    slot.controller = controller;
    slot.actor.input = controller;
  }

  setMode(mode = 'solo') {
    this.mode = ['couch','lan-host'].includes(mode) ? mode : 'solo';

    if (this.mode === 'couch') {
      this.setFighterController(1, new GamepadController(0));
    } else if (this.mode === 'lan-host') {
      this.setFighterController(1, new NetworkController());
    } else {
      this.setFighterController(1, new IdleController());
    }
  }

  setNickname(index, nickname) {
    const slot = this.fighters[index];
    if (!slot) return;
    const clean = String(nickname || '').trim().slice(0, 16);
    slot.nickname = clean || (index === 0 ? 'P1' : 'P2');
  }

  getNetworkController() {
    const controller = this.fighters[1]?.controller;
    return controller instanceof NetworkController ? controller : null;
  }

  applyMap(mapId) {
    this.selectedMapId = MapRegistry.get(mapId).id;
    this.terrain.setMap(MapRegistry.get(this.selectedMapId));

    for (const slot of this.fighters) {
      slot.actor.resize(this.terrain.worldWidth);
      slot.clearTransientState();
    }

    this.projectiles.clear();
    this.hazards.length = 0;
    this.statusEmitters.length = 0;
    this.statusParticles.length = 0;
  }

  applyLoadout(loadout) {
    this.applyFighterLoadout(0, loadout);
  }

  applyFighterLoadout(index, loadout) {
    const slot = this.fighters[index];
    if (!slot) return;

    slot.loadout = {
      weapon:loadout?.weapon || slot.loadout?.weapon || 'revolver',
      appearance:{
        ...Player.defaultAppearance(),
        ...(slot.loadout?.appearance || {}),
        ...(loadout?.appearance || {})
      }
    };

    slot.actor.setAppearance(slot.loadout.appearance);
    slot.actor.weaponMount.equip(WeaponRegistry.create(slot.loadout.weapon));
  }

  setActive(active) {
    this.active = !!active;
    this.canvas.classList.toggle('inactive', !this.active);
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (event) => {
      if (!this.active || event.repeat) return;
      if (event.code === 'KeyR' && !this.primarySlot.ragdoll) {
        this.killFighter(this.primarySlot, true);
      }
    });
  }

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.width = innerWidth;
    this.height = innerHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;

    this.terrain.resize(this.width, this.height);
    this.camera.resize(this.width, this.height);

    for (const slot of this.fighters) {
      slot.actor.resize(this.terrain.worldWidth);
    }
  }

  spawnFighter(slot) {
    const actor = slot.actor;
    actor.reset(this.terrain.worldWidth);
    actor.facing = slot.index === 0 ? 1 : -1;

    const spawn = this.terrain.spawn(slot.index);
    actor.placeAt(spawn.x, spawn.y);
    actor.facing = slot.index === 0 ? 1 : -1;
    actor.setAppearance(slot.loadout.appearance);
    actor.weaponMount.equip(WeaponRegistry.create(slot.loadout.weapon));
    actor.health = actor.maxHealth;
    actor.dead = false;
    actor.hitFlash = 0;

    slot.charge = 0;
    slot.clearTransientState();
  }

  reset() {
    this.projectiles.clear();
    this.hazards.length = 0;
    this.statusEmitters.length = 0;
    this.statusParticles.length = 0;

    for (const slot of this.fighters) this.spawnFighter(slot);

    this.camera.resetGroup(this.fighters.map((slot) => slot.activeBody()));
    this.primarySlot.controller.resetAim?.(this, this.primarySlot.actor);
  }

  respawnFighter(slot) {
    this.spawnFighter(slot);
    if (slot === this.primarySlot) {
      this.camera.resetGroup(this.fighters.map((candidate) => candidate.activeBody()));
      slot.controller.resetAim?.(this, slot.actor);
    }
  }

  killFighter(slot, testDeath = false) {
    if (!slot || slot.ragdoll) return;

    const actor = slot.actor;
    slot.knockdown = null;
    slot.knockdownRemaining = 0;
    slot.attackRagdoll = null;
    slot.attackRemaining = 0;
    slot.attackData = null;

    const ragdoll = new Ragdoll({
      actor,
      terrain:this.terrain,
      lifetime:this.ragdollLifetime
    });

    if (testDeath) {
      ragdoll.body.vy -= 180;
      ragdoll.body.vx += actor.facing * 80;
      ragdoll.body.av += actor.facing * 2.4;
    }

    actor.health = 0;
    actor.dead = true;
    this.statusEmitters = this.statusEmitters.filter((emitter) => emitter.actor !== actor);
    slot.ragdoll = ragdoll;
    slot.respawnRemaining = this.ragdollLifetime;
    slot.charge = 0;
    actor.weaponMount.unequip();
  }

  getTargetableActors(ownerSlot = null) {
    const actors = [];
    for (const slot of this.fighters) {
      if (slot === ownerSlot || slot.ragdoll || slot.actor.dead || slot.actor.health <= 0) continue;
      actors.push(slot.actor);
    }
    return actors;
  }

  getHazardActors() {
    const actors = [];
    for (const slot of this.fighters) {
      if (slot.ragdoll || slot.knockdown || slot.attackRagdoll || slot.actor.dead || slot.actor.health <= 0) continue;
      actors.push(slot.actor);
    }
    return actors;
  }

  addHazard(hazard) {
    if (hazard) this.hazards.push(hazard);
    return hazard;
  }

  addStatusVisual(actor, spritePath, duration, key = '', options = {}) {
    if (!actor || !spritePath || duration <= 0) return;

    this.statusEmitters = this.statusEmitters.filter((emitter) => {
      return !(emitter.actor === actor && emitter.key === key);
    });

    const image = new Image();
    image.src = spritePath;
    this.statusEmitters.push({
      actor,
      key,
      image,
      time:duration,
      spawnTimer:0,
      rate:options.rate ?? 0.12,
      size:options.size ?? 22,
      drift:options.drift ?? 18,
      opacity:options.opacity ?? 1
    });
  }

  removeStatusVisual(actor, key) {
    this.statusEmitters = this.statusEmitters.filter((emitter) => {
      return !(emitter.actor === actor && emitter.key === key);
    });
  }

  updateStatusVisuals(dt) {
    for (const emitter of this.statusEmitters) {
      emitter.time -= dt;
      emitter.spawnTimer -= dt;
      if (emitter.time <= 0) continue;

      const slot = this.slotForActor(emitter.actor);
      if (slot?.ragdoll) continue;

      if (emitter.spawnTimer <= 0) {
        emitter.spawnTimer += emitter.rate;
        const body = slot?.activeBody?.() || emitter.actor;
        const life = 0.72 + Math.random() * 0.45;

        this.statusParticles.push({
          image:emitter.image,
          x:body.x + (Math.random() - 0.5) * this.config.bodyW * 1.6,
          y:body.y + (Math.random() - 0.5) * this.config.bodyH * 1.1,
          vx:(Math.random() - 0.5) * emitter.drift,
          vy:-22 - Math.random() * 28,
          life,
          maxLife:life,
          size:emitter.size * (0.75 + Math.random() * 0.45),
          opacity:emitter.opacity
        });
      }
    }

    this.statusEmitters = this.statusEmitters.filter((emitter) => emitter.time > 0);

    for (const particle of this.statusParticles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy -= 7 * dt;
    }
    this.statusParticles = this.statusParticles.filter((particle) => particle.life > 0);
  }

  renderStatusVisuals(ctx) {
    for (const particle of this.statusParticles) {
      const alpha = MathEx.clamp(particle.life / particle.maxLife, 0, 1);

      ctx.save();
      ctx.globalAlpha *= alpha * (particle.opacity ?? 1);
      ctx.translate(Math.round(particle.x), Math.round(particle.y));
      ctx.imageSmoothingEnabled = false;

      if (particle.image?.complete && particle.image.naturalWidth > 0) {
        const scale = particle.size / Math.max(
          particle.image.naturalWidth,
          particle.image.naturalHeight
        );
        const w = Math.max(1, Math.round(particle.image.naturalWidth * scale));
        const h = Math.max(1, Math.round(particle.image.naturalHeight * scale));
        ctx.drawImage(particle.image, -Math.round(w / 2), -Math.round(h / 2), w, h);
      } else {
        ctx.fillStyle = '#f2f2f2';
        ctx.fillRect(-3, -3, 6, 6);
      }

      ctx.restore();
    }
  }

  knockDownActor(actor, duration = 0.8) {
    // SLIP is control loss only. The move/hazard must deal any damage itself.
    const slot = this.slotForActor(actor);
    if (!slot || actor.health <= 0 || slot.ragdoll || slot.knockdown || slot.attackRagdoll) return false;

    slot.knockdown = new Ragdoll({
      actor,
      terrain:this.terrain,
      lifetime:Math.max(1.2, duration + 0.4),
      dropWeapon:false,
      fadeOut:false
    });
    slot.knockdownRemaining = duration;
    return true;
  }

  recoverKnockdown(slot) {
    if (!slot?.knockdown) return;

    const actor = slot.actor;
    const ragdoll = slot.knockdown;
    const health = actor.health;

    actor.recoverPhysicalBodyFromRagdoll?.(ragdoll, 0.30);
    actor.health = health;
    actor.dead = health <= 0;

    slot.knockdown = null;
    slot.knockdownRemaining = 0;
  }

  gainCharge(slot, amount) {
    if (!slot) return;
    slot.charge = MathEx.clamp(
      slot.charge + Math.max(0, amount || 0),
      0,
      slot.maxCharge
    );
  }

  hasFullCharge(slot) {
    return !!slot && slot.charge >= slot.maxCharge - 0.001;
  }

  consumeFullCharge(slot) {
    if (!this.hasFullCharge(slot)) return false;
    slot.charge = 0;
    return true;
  }

  actorTouchesWater(actor) {
    if (!actor || actor.dead) return false;
    const contactY = actor.footReferenceY?.() ?? actor.collisionBox().bottom;
    return contactY >= this.terrain.waterY + 8;
  }

  startAttackRagdoll(slot, {
    weapon,
    duration = 0.38,
    dirX = 1,
    dirY = 0,
    speed = 790,
    damage = 15,
    knockback = 320
  } = {}) {
    if (!slot || !weapon || !slot.canControl()) return false;

    const actor = slot.actor;
    const length = MathEx.hypot(dirX, dirY) || 1;
    dirX /= length;
    dirY /= length;

    const ragdoll = new Ragdoll({
      actor,
      terrain:this.terrain,
      lifetime:Math.max(1.0, duration + 0.5),
      dropWeapon:false,
      fadeOut:false
    });

    ragdoll.body.vx = dirX * speed;
    ragdoll.body.vy = dirY * speed;
    ragdoll.body.av += (Math.random() - 0.5) * 4.5;

    slot.attackRagdoll = ragdoll;
    slot.attackRemaining = duration;
    slot.attackData = {
      weapon,
      speed,
      damage,
      knockback,
      aimDirX:dirX,
      aimDirY:dirY,
      hitTargets:new Set(),
      trailTimer:0
    };

    ragdoll.aimArmAt(
      ragdoll.body.x + dirX * 180,
      ragdoll.body.y + dirY * 180
    );

    return true;
  }

  finishAttackRagdoll(slot) {
    if (!slot?.attackRagdoll) return;

    const actor = slot.actor;
    const ragdoll = slot.attackRagdoll;

    actor.recoverPhysicalBodyFromRagdoll?.(ragdoll, 0.48);

    slot.attackRagdoll = null;
    slot.attackRemaining = 0;
    slot.attackData = null;
  }

  hitAttackRagdollTarget(slot, target, tipX, tipY, data) {
    if (!target?.hitbox || target.dead || data.hitTargets.has(target) || target.isInvulnerable?.()) return false;

    const box = target.hitbox();
    const left = box.x - box.w * 0.5;
    const right = box.x + box.w * 0.5;
    const top = box.y - box.h * 0.5;
    const bottom = box.y + box.h * 0.5;
    const nearestX = MathEx.clamp(tipX, left, right);
    const nearestY = MathEx.clamp(tipY, top, bottom);

    if (MathEx.hypot(tipX - nearestX, tipY - nearestY) > 24) return false;

    const actor = slot.actor;
    target.takeDamage(data.damage * actor.buffMultiplier('damage'));
    target.vx += data.aimDirX * data.knockback;
    target.vy += data.aimDirY * data.knockback * 0.22 - 45;
    target.hitFlash = 0.11;
    data.hitTargets.add(target);

    if (target.health <= 0) target.dead = true;
    return true;
  }

  updateAttackRagdoll(slot, dt, aimWorld) {
    const ragdoll = slot.attackRagdoll;
    const data = slot.attackData;
    if (!ragdoll || !data) return;

    const actor = slot.actor;
    actor.updateStatusEffects?.(dt);
    data.weapon.update?.(dt, { player:actor });

    const previousX = ragdoll.body.x;
    const previousY = ragdoll.body.y;
    ragdoll.update(dt);

    let aimX = aimWorld.x - ragdoll.body.x;
    let aimY = aimWorld.y - ragdoll.body.y;
    const aimLength = MathEx.hypot(aimX, aimY) || 1;
    aimX /= aimLength;
    aimY /= aimLength;

    data.aimDirX = aimX;
    data.aimDirY = aimY;

    ragdoll.body.vx = MathEx.expLerp(ragdoll.body.vx, aimX * data.speed, 6.5, dt);
    ragdoll.body.vy = MathEx.expLerp(ragdoll.body.vy, aimY * data.speed, 6.5, dt);

    ragdoll.aimArmAt(
      ragdoll.body.x + aimX * 180,
      ragdoll.body.y + aimY * 180
    );

    actor.x = ragdoll.body.x;
    actor.y = ragdoll.body.y;
    actor.hand.x = ragdoll.hand.x;
    actor.hand.y = ragdoll.hand.y;

    data.trailTimer -= dt;
    if (data.trailTimer <= 0) {
      data.weapon.spawnRushTrail?.(
        slot.gameView,
        previousX,
        previousY,
        ragdoll.body.x,
        ragdoll.body.y,
        actor
      );
      data.trailTimer += 0.055;
    }

    const tipDistance = 66;
    const tipX = ragdoll.hand.x + aimX * tipDistance;
    const tipY = ragdoll.hand.y + aimY * tipDistance;

    for (const target of this.getTargetableActors(slot)) {
      this.hitAttackRagdollTarget(slot, target, tipX, tipY, data);
    }

    slot.attackRemaining -= dt;
    if (slot.attackRemaining <= 0 || ragdoll.dead) {
      this.finishAttackRagdoll(slot);
    }
  }

  updateKnockdown(slot, dt) {
    if (!slot.knockdown) return;

    const actor = slot.actor;
    actor.updateStatusEffects?.(dt);
    actor.weaponMount.weapon?.update?.(dt, { player:actor });

    slot.knockdown.update(dt);
    slot.knockdownRemaining -= dt;

    actor.x = slot.knockdown.body.x;
    actor.y = slot.knockdown.body.y;

    if (actor.health <= 0) {
      actor.dead = true;
      this.killFighter(slot);
      return;
    }

    if (slot.knockdownRemaining <= 0) this.recoverKnockdown(slot);
  }

  updateDeathRagdoll(slot, dt) {
    if (!slot.ragdoll) return;

    slot.ragdoll.update(dt);
    slot.respawnRemaining -= dt;
    if (slot.respawnRemaining <= 0) this.respawnFighter(slot);
  }

  updateHazards(dt) {
    for (const hazard of this.hazards) hazard.update?.(dt, this);
    this.hazards = this.hazards.filter((hazard) => !hazard.dead);
  }

  aimForSlot(slot) {
    return slot.controller.aimWorld(this, slot);
  }

  updateControlledFighter(slot, dt, aimWorld) {
    if (slot.ragdoll || slot.knockdown) return;

    if (slot.attackRagdoll) {
      this.updateAttackRagdoll(slot, dt, aimWorld);
      return;
    }

    const actor = slot.actor;
    actor.update(dt, aimWorld);
    if (actor.dead || actor.health <= 0) return;

    const weapon = actor.weaponMount.weapon;
    if (weapon?.chargeRate > 0) this.gainCharge(slot, weapon.chargeRate * dt);

    const weaponContext = {
      projectiles:this.projectiles,
      player:actor,
      game:slot.gameView
    };

    if (slot.controller.consumePrimary()) actor.weaponMount.primary(weaponContext);
    if (slot.controller.consumeAttack2()) actor.weaponMount.reload(weaponContext);
    if (slot.controller.consumeAttack3()) actor.weaponMount.special(weaponContext);
  }

  update(dt) {
    for (const slot of this.fighters) {
      slot.controller.poll?.();
    }

    this.camera.updateFighters(
      dt,
      this.fighters.map((slot) => slot.activeBody())
    );

    const aims = new Map();
    for (const slot of this.fighters) {
      aims.set(slot, this.aimForSlot(slot));
    }

    for (const slot of this.fighters) {
      this.updateControlledFighter(slot, dt, aims.get(slot));
    }

    this.projectiles.update(dt, {
      width:this.terrain.worldWidth,
      height:this.terrain.worldHeight,
      targets:this.getTargetableActors()
    });

    this.updateHazards(dt);
    this.updateStatusVisuals(dt);

    for (const slot of this.fighters) {
      if (slot.ragdoll) continue;

      const actor = slot.actor;
      const transientBody = slot.knockdown?.body || slot.attackRagdoll?.body || null;

      if (actor.dead || actor.health <= 0) {
        this.killFighter(slot);
        continue;
      }

      if (transientBody) {
        if (transientBody.y >= this.terrain.waterY + 20) {
          this.killFighter(slot);
          continue;
        }
      } else if (this.actorTouchesWater(actor)) {
        this.killFighter(slot);
      }
    }

    for (const slot of this.fighters) {
      if (slot.knockdown) this.updateKnockdown(slot, dt);
      if (slot.ragdoll) this.updateDeathRagdoll(slot, dt);
    }
  }

  drawBar(ctx, x, y, width, height, ratio, fill, label) {
    ratio = MathEx.clamp(ratio, 0, 1);

    ctx.fillStyle = '#111111';
    ctx.fillRect(x - 2, y - 2, width + 4, height + 4);
    ctx.fillStyle = '#343434';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, Math.round(width * ratio), height);

    ctx.font = '10px monospace';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x, y - 4);
  }

  renderFighterHud(ctx, slot) {
    const attackW = 132;
    const attackH = 7;
    const attackGap = 24;
    const statW = 132;
    const statH = 12;
    const statGap = 10;
    const totalStatW = statW * 2 + statGap;

    const leftAligned = slot.index === 0;
    const attackX = leftAligned ? 22 : this.width - 22 - attackW;
    const statsX = leftAligned ? 22 : this.width - 22 - totalStatW;

    const bottomY = this.height - 22;
    const statY = bottomY - statH;
    const attack3Y = statY - 34;
    const attack2Y = attack3Y - attackGap;
    const attack1Y = attack2Y - attackGap;

    const blocked = !!(slot.ragdoll || slot.knockdown || slot.attackRagdoll);
    const weapon = blocked ? null : slot.actor.weaponMount.weapon;
    const readiness = blocked
      ? [0, 0, 0]
      : (weapon?.attackReadiness?.(slot.gameView) || [1, 1, 1]);

    const label = slot.nickname || slot.id.toUpperCase();
    this.drawBar(ctx, attackX, attack1Y, attackW, attackH, readiness[0] ?? 0, '#f2f2f2', `${label} attack1`);
    this.drawBar(ctx, attackX, attack2Y, attackW, attackH, readiness[1] ?? 0, '#f2f2f2', `${label} attack2`);
    this.drawBar(ctx, attackX, attack3Y, attackW, attackH, readiness[2] ?? 0, '#f2f2f2', `${label} attack3`);

    const healthRatio = slot.actor.maxHealth > 0
      ? slot.actor.health / slot.actor.maxHealth
      : 0;
    const chargeRatio = slot.maxCharge > 0
      ? slot.charge / slot.maxCharge
      : 0;

    if (leftAligned) {
      this.drawBar(ctx, statsX, statY, statW, statH, healthRatio, '#d94a4a', `${label} health`);
      this.drawBar(ctx, statsX + statW + statGap, statY, statW, statH, chargeRatio, '#e5c83b', `${label} charge`);
    } else {
      this.drawBar(ctx, statsX, statY, statW, statH, chargeRatio, '#e5c83b', `${label} charge`);
      this.drawBar(ctx, statsX + statW + statGap, statY, statW, statH, healthRatio, '#d94a4a', `${label} health`);
    }
  }

  renderFighter(ctx, slot) {
    if (slot.ragdoll) {
      slot.ragdoll.render(ctx);
      return;
    }

    if (slot.knockdown) {
      slot.knockdown.render(ctx);
      return;
    }

    if (slot.attackRagdoll) {
      slot.attackRagdoll.render(ctx);
      slot.attackData?.weapon?.renderRagdoll?.(
        ctx,
        slot.attackRagdoll,
        slot.attackData
      );
      return;
    }

    slot.actor.render(ctx, false, {
      showAimPointer:slot.index === 0 || (this.mode === 'lan-host' && slot.index === 1)
    });
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#242a30';
    ctx.fillRect(0, 0, this.width, this.height);

    this.camera.begin(ctx);
    this.terrain.draw(ctx);

    for (const hazard of this.hazards) hazard.render?.(ctx);
    for (const slot of this.fighters) this.renderFighter(ctx, slot);

    this.projectiles.render(ctx);
    this.renderStatusVisuals(ctx);
    this.camera.end(ctx);

    for (const slot of this.fighters) {
      if (!slot.canControl()) continue;

      if (slot.index === 0) {
        slot.actor.weaponMount.weapon?.renderHud?.(ctx, 22, 22, { align:'left' });
      } else {
        slot.actor.weaponMount.weapon?.renderHud?.(
          ctx,
          this.width - 22,
          22,
          { align:'right' }
        );
      }
    }

    if (this.mode === 'couch' && !this.fighters[1].controller.connected?.()) {
      ctx.save();
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#f2f2f2';
      ctx.fillText('P2: CONNECT A CONTROLLER', this.width * 0.5, 18);
      ctx.restore();
    }

    for (const slot of this.fighters) this.renderFighterHud(ctx, slot);
  }

  frame(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (this.active) {
      this.accumulator += dt;
      while (this.accumulator >= this.fixedStep) {
        this.update(this.fixedStep);
        this.accumulator -= this.fixedStep;
      }
      this.render();
    }

    requestAnimationFrame((time) => this.frame(time));
  }

  start() {
    requestAnimationFrame((time) => this.frame(time));
  }
}
