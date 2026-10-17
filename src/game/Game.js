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
    this.charge = 0;
    this.projectiles.clear();

    this.spawnPlayer();
    this.dummy.resetTarget(this.terrain.worldWidth);
  }

  respawnPlayer() {
    this.playerRagdoll = null;
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
  }

  update(dt) {
    let pointerWorld = this.camera.screenToWorld(this.pointer.x, this.pointer.y);
    const cameraSubject = this.playerRagdoll?.body || this.player;
    this.camera.update(dt, cameraSubject, pointerWorld);
    pointerWorld = this.camera.screenToWorld(this.pointer.x, this.pointer.y);

    if (!this.playerRagdoll) {
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

    if (!this.dummy.dead) {
      const lookAt = this.playerRagdoll?.body || this.player;
      this.dummy.updateTarget(dt, { x:lookAt.x, y:lookAt.y });
    }

    this.projectiles.update(dt, {
      width:this.terrain.worldWidth,
      height:this.terrain.worldHeight,
      targets:this.getTargetableActors()
    });

    if (!this.dummyRagdoll && this.dummy.dead) this.killDummy();

    if (!this.playerRagdoll && (this.player.health <= 0 || this.actorTouchesWater(this.player))) {
      this.killPlayer(false);
    }

    if (!this.dummyRagdoll && !this.dummy.dead && this.actorTouchesWater(this.dummy)) {
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

    const weapon = this.playerRagdoll ? null : this.player.weaponMount.weapon;
    const readiness = this.playerRagdoll
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

    if (this.dummyRagdoll) this.dummyRagdoll.render(ctx);
    else this.dummy.renderTarget(ctx);

    this.projectiles.render(ctx);

    if (this.playerRagdoll) this.playerRagdoll.render(ctx);
    else this.player.render(ctx, false);

    this.camera.end(ctx);

    if (!this.playerRagdoll) {
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
