'use strict';

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.active = false;
    this.maxCharge = 100;
    this.charge = 0;

    this.config = createGameConfig();
    this.input = new KeyboardInput();
    this.pointer = new PointerInput(canvas);
    this.selectedMapId = MapRegistry.list[0]?.id || null;
    this.terrain = new Terrain(MapRegistry.get(this.selectedMapId));
    this.camera = new CameraEffects();
    this.rounds = new RoundManager();
    this.player = new Player({ input:this.input, terrain:this.terrain, config:this.config });
    this.projectiles = new ProjectileSystem({ terrain:this.terrain });
    this.dummy = new TargetFighter({ terrain:this.terrain, config:this.config });
    this.loadout = { weapon:'revolver', appearance:Player.defaultAppearance() };
    this.player.setAppearance(this.loadout.appearance);
    this.player.weaponMount.equip(WeaponRegistry.create(this.loadout.weapon));

    this.ragdollLifetime = 4.2;
    this.playerRagdoll = null;
    this.dummyRagdoll = null;
    this.playerRespawnRemaining = 0;
    this.dummyRespawnRemaining = 0;
    this.playerKnockdown = null;
    this.playerKnockdownRemaining = 0;
    this.dummyKnockdown = null;
    this.dummyKnockdownRemaining = 0;

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

  applyMap(mapId) {
    this.selectedMapId = MapRegistry.get(mapId).id;
    this.terrain.setMap(MapRegistry.get(this.selectedMapId));
    this.player.resize(this.terrain.worldWidth);
    this.dummy.worldWidth = this.terrain.worldWidth;
    this.projectiles.clear();
    this.playerRagdoll = null;
    this.dummyRagdoll = null;
    this.playerKnockdown = null;
    this.playerKnockdownRemaining = 0;
    this.dummyKnockdown = null;
    this.hazards.length = 0;
    this.statusEmitters.length = 0;
    this.statusParticles.length = 0;
  }

  applyLoadout(loadout) {
    this.loadout = {
      weapon:loadout?.weapon || 'revolver',
      appearance:{ ...Player.defaultAppearance(), ...(loadout?.appearance || {}) }
    };
    this.player.setAppearance(this.loadout.appearance);
    this.player.weaponMount.equip(WeaponRegistry.create(this.loadout.weapon));
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
      if (event.code === 'KeyR' && !this.playerRagdoll) {
        this.killPlayer(true);
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
    this.player.resize(this.terrain.worldWidth);
    this.dummy.worldWidth = this.terrain.worldWidth;
  }

  spawnPlayer() {
    this.player.reset(this.terrain.worldWidth);
    const spawn = this.terrain.spawn(0);
    this.player.placeAt(spawn.x, spawn.y);
    this.player.setAppearance(this.loadout.appearance);
    this.player.weaponMount.equip(WeaponRegistry.create(this.loadout.weapon));
    this.player.health = this.player.maxHealth;
    this.camera.reset(this.player);

    const startScreen = this.camera.worldToScreen(this.player.x + 180, this.player.y - 20);
    this.pointer.resetTo(startScreen.x, startScreen.y);
  }

  reset() {
    this.playerRagdoll = null;
    this.dummyRagdoll = null;
    this.playerRespawnRemaining = 0;
    this.dummyRespawnRemaining = 0;
    this.playerKnockdown = null;
    this.playerKnockdownRemaining = 0;
    this.dummyKnockdown = null;
    this.dummyKnockdownRemaining = 0;
    this.charge = 0;
    this.projectiles.clear();
    this.hazards.length = 0;
    this.statusEmitters.length = 0;
    this.statusParticles.length = 0;

    this.spawnPlayer();
    this.dummy.resetTarget(this.terrain.worldWidth);
  }

  respawnPlayer() {
    this.playerRagdoll = null;
    this.playerKnockdown = null;
    this.playerKnockdownRemaining = 0;
    this.playerRespawnRemaining = 0;
    this.charge = 0;
    this.projectiles.clear();
    this.spawnPlayer();
  }

  respawnDummy() {
    this.dummyRagdoll = null;
    this.dummyRespawnRemaining = 0;
    this.dummy.resetTarget(this.terrain.worldWidth);
  }

  killPlayer(testDeath = false) {
    if (this.playerRagdoll) return;

    this.playerKnockdown = null;
    this.playerKnockdownRemaining = 0;

    const ragdoll = new Ragdoll({
      actor:this.player,
      terrain:this.terrain,
      lifetime:this.ragdollLifetime
    });

    if (testDeath) {
      ragdoll.body.vy -= 180;
      ragdoll.body.vx += this.player.facing * 80;
      ragdoll.body.av += this.player.facing * 2.4;
    }

    this.player.health = 0;
    this.playerRagdoll = ragdoll;
    this.playerRespawnRemaining = this.ragdollLifetime;
    this.player.weaponMount.unequip();
    this.charge = 0;
  }

  killDummy() {
    if (this.dummyRagdoll) return;
    this.dummy.dead = true;
    this.dummyRagdoll = new Ragdoll({
      actor:this.dummy,
      terrain:this.terrain,
      lifetime:this.ragdollLifetime
    });
    this.dummyRespawnRemaining = this.ragdollLifetime;
    this.dummy.weaponMount.unequip();
  }

  getTargetableActors() {
    return this.dummy && !this.dummy.dead ? [this.dummy] : [];
  }

  getHazardActors() {
    const actors = [];
    if (!this.playerRagdoll && !this.playerKnockdown) actors.push(this.player);
    if (this.dummy && !this.dummy.dead && !this.dummyKnockdown) actors.push(this.dummy);
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

      if (emitter.spawnTimer <= 0) {
        emitter.spawnTimer += emitter.rate;
        const actor = emitter.actor;
        const life = 0.72 + Math.random() * 0.45;
        this.statusParticles.push({
          image:emitter.image,
          x:actor.x + (Math.random() - 0.5) * this.config.bodyW * 1.6,
          y:actor.y + (Math.random() - 0.5) * this.config.bodyH * 1.1,
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
        const scale = particle.size / Math.max(particle.image.naturalWidth, particle.image.naturalHeight);
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
    // SLIP RULE: knockdown itself never deals damage. The move/hazard must
    // explicitly damage the fighter before calling this method.
    if (!actor || actor.health <= 0) return false;

    if (actor === this.player && !this.playerKnockdown && !this.playerRagdoll) {
      this.playerKnockdown = new Ragdoll({
        actor:this.player,
        terrain:this.terrain,
        lifetime:Math.max(1.2, duration + 0.4),
        dropWeapon:false
      });
      this.playerKnockdownRemaining = duration;
      return true;
    }

    if (actor === this.dummy && !this.dummyKnockdown && !this.dummy.dead) {
      this.dummyKnockdown = new Ragdoll({
        actor:this.dummy,
        terrain:this.terrain,
        lifetime:Math.max(1.2, duration + 0.4),
        dropWeapon:false
      });
      this.dummyKnockdownRemaining = duration;
      return true;
    }

    return false;
  }

  recoverPlayerKnockdown() {
    if (!this.playerKnockdown) return;

    const body = this.playerKnockdown.body;
    const health = this.player.health;
    const x = MathEx.clamp(body.x, 40, this.terrain.worldWidth - 40);

    this.player.placeAt(x, body.y + this.config.bodyHeight + this.config.bodyH);
    this.player.health = health;
    this.player.vx = body.vx * 0.18;
    this.player.vy = 0;
    this.playerKnockdown = null;
    this.playerKnockdownRemaining = 0;
  }

  recoverDummyKnockdown() {
    if (!this.dummyKnockdown) return;

    const body = this.dummyKnockdown.body;
    const health = this.dummy.health;
    const x = MathEx.clamp(body.x, 40, this.terrain.worldWidth - 40);

    this.dummy.placeAt(x, body.y + this.config.bodyHeight + this.config.bodyH);
    this.dummy.health = health;
    this.dummy.vx = body.vx * 0.18;
    this.dummy.vy = 0;
    this.dummy.weaponMount.unequip();
    this.dummyKnockdown = null;
    this.dummyKnockdownRemaining = 0;
  }

  gainCharge(amount) {
    this.charge = MathEx.clamp(this.charge + Math.max(0, amount || 0), 0, this.maxCharge);
  }

  hasFullCharge() {
    return this.charge >= this.maxCharge - 0.001;
  }

  consumeFullCharge() {
    if (!this.hasFullCharge()) return false;
    this.charge = 0;
    return true;
  }

  actorTouchesWater(actor) {
    if (!actor || actor.dead) return false;
    return actor.collisionBox().bottom >= this.terrain.waterY + 8;
  }

  updateRagdolls(dt) {
    if (this.playerRagdoll) {
      this.playerRagdoll.update(dt);
      this.playerRespawnRemaining -= dt;
      if (this.playerRespawnRemaining <= 0) this.respawnPlayer();
    }

    if (this.dummyRagdoll) {
      this.dummyRagdoll.update(dt);
      this.dummyRespawnRemaining -= dt;
      if (this.dummyRespawnRemaining <= 0) this.respawnDummy();
    }

    if (this.playerKnockdown) {
      this.player.updateStatusEffects?.(dt);
      this.playerKnockdown.update(dt);
      this.playerKnockdownRemaining -= dt;
      this.player.x = this.playerKnockdown.body.x;
      this.player.y = this.playerKnockdown.body.y;
      if (this.playerKnockdownRemaining <= 0) this.recoverPlayerKnockdown();
    }

    if (this.dummyKnockdown) {
      this.dummy.updateStatusEffects?.(dt);
      if (this.dummy.health <= 0) {
        this.dummy.dead = true;
        return;
      }
      this.dummyKnockdown.update(dt);
      this.dummyKnockdownRemaining -= dt;
      this.dummy.x = this.dummyKnockdown.body.x;
      this.dummy.y = this.dummyKnockdown.body.y;
      if (this.dummyKnockdownRemaining <= 0) this.recoverDummyKnockdown();
    }
  }

  updateHazards(dt) {
    for (const hazard of this.hazards) hazard.update?.(dt, this);
    this.hazards = this.hazards.filter((hazard) => !hazard.dead);
  }

  update(dt) {
    let pointerWorld = this.camera.screenToWorld(this.pointer.x, this.pointer.y);
    const cameraSubject = this.playerRagdoll?.body || this.playerKnockdown?.body || this.player;
    this.camera.update(dt, cameraSubject, pointerWorld);
    pointerWorld = this.camera.screenToWorld(this.pointer.x, this.pointer.y);

    if (!this.playerRagdoll && !this.playerKnockdown) {
      this.player.update(dt, pointerWorld);

      const activeWeapon = this.player.weaponMount.weapon;
      if (activeWeapon?.chargeRate > 0) this.gainCharge(activeWeapon.chargeRate * dt);

      const weaponContext = {
        projectiles:this.projectiles,
        player:this.player,
        game:this
      };

      if (this.pointer.consumePressed(0)) this.player.weaponMount.primary(weaponContext);
      if (this.input.consumePressed('reload')) this.player.weaponMount.reload(weaponContext);
      if (this.input.consumePressed('special')) this.player.weaponMount.special(weaponContext);
    }

    if (!this.dummy.dead && !this.dummyKnockdown) {
      const lookAt = this.playerRagdoll?.body || this.playerKnockdown?.body || this.player;
      this.dummy.updateTarget(dt, { x:lookAt.x, y:lookAt.y });
    }

    this.projectiles.update(dt, {
      width:this.terrain.worldWidth,
      height:this.terrain.worldHeight,
      targets:this.getTargetableActors()
    });

    this.updateHazards(dt);
    this.updateStatusVisuals(dt);

    if (!this.dummyRagdoll && this.dummy.dead) {
      this.dummyKnockdown = null;
      this.dummyKnockdownRemaining = 0;
      this.killDummy();
    }

    if (!this.playerRagdoll && this.player.health <= 0) {
      this.killPlayer(false);
    } else if (!this.playerRagdoll && !this.playerKnockdown && this.actorTouchesWater(this.player)) {
      this.killPlayer(false);
    } else if (!this.playerRagdoll && this.playerKnockdown &&
               this.playerKnockdown.body.y >= this.terrain.waterY + 20) {
      this.killPlayer(false);
    }

    if (!this.dummyRagdoll && !this.dummyKnockdown && !this.dummy.dead && this.actorTouchesWater(this.dummy)) {
      this.killDummy();
    }

    this.updateRagdolls(dt);
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

  renderCombatHud(ctx) {
    const x = 22;
    const attackW = 132;
    const attackH = 7;
    const attackGap = 24;
    const statW = 132;
    const statH = 12;
    const statGap = 10;

    const bottomY = this.height - 22;
    const statY = bottomY - statH;
    const attack3Y = statY - 34;
    const attack2Y = attack3Y - attackGap;
    const attack1Y = attack2Y - attackGap;

    const weapon = (this.playerRagdoll || this.playerKnockdown) ? null : this.player.weaponMount.weapon;
    const readiness = (this.playerRagdoll || this.playerKnockdown)
      ? [0, 0, 0]
      : (weapon?.attackReadiness?.(this) || [1, 1, 1]);

    this.drawBar(ctx, x, attack1Y, attackW, attackH, readiness[0] ?? 0, '#f2f2f2', 'attack1');
    this.drawBar(ctx, x, attack2Y, attackW, attackH, readiness[1] ?? 0, '#f2f2f2', 'attack2');
    this.drawBar(ctx, x, attack3Y, attackW, attackH, readiness[2] ?? 0, '#f2f2f2', 'attack3');

    const healthRatio = this.player.maxHealth > 0 ? this.player.health / this.player.maxHealth : 0;
    const chargeRatio = this.maxCharge > 0 ? this.charge / this.maxCharge : 0;
    this.drawBar(ctx, x, statY, statW, statH, healthRatio, '#d94a4a', 'health');
    this.drawBar(ctx, x + statW + statGap, statY, statW, statH, chargeRatio, '#e5c83b', 'charge');
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#242a30';
    ctx.fillRect(0, 0, this.width, this.height);

    this.camera.begin(ctx);
    this.terrain.draw(ctx);

    for (const hazard of this.hazards) hazard.render?.(ctx);

    if (this.dummyRagdoll) this.dummyRagdoll.render(ctx);
    else if (this.dummyKnockdown) this.dummyKnockdown.render(ctx);
    else this.dummy.renderTarget(ctx);

    this.projectiles.render(ctx);

    if (this.playerRagdoll) this.playerRagdoll.render(ctx);
    else if (this.playerKnockdown) this.playerKnockdown.render(ctx);
    else this.player.render(ctx, false);

    this.renderStatusVisuals(ctx);

    this.camera.end(ctx);

    if (!this.playerRagdoll && !this.playerKnockdown) {
      this.player.weaponMount.weapon?.renderHud?.(ctx, 22, 22);
    }
    this.renderCombatHud(ctx);
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

  start() { requestAnimationFrame((time) => this.frame(time)); }
}
