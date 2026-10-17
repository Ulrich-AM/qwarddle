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
      if (!this.active) return;
      if (event.code === 'KeyR' && !event.repeat) this.reset();
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
    if (this.dummy) {
      this.dummy.worldWidth = this.terrain.worldWidth;
    }
  }

  reset() {
    this.player.reset(this.terrain.worldWidth);
    const spawn = this.terrain.spawn(0);
    this.player.placeAt(spawn.x, spawn.y);
    this.player.setAppearance(this.loadout.appearance);
    this.player.weaponMount.equip(WeaponRegistry.create(this.loadout.weapon));
    this.charge = 0;
    this.camera.reset(this.player);

    const startScreen = this.camera.worldToScreen(this.player.x + 180, this.player.y - 20);
    this.pointer.resetTo(startScreen.x, startScreen.y);
    this.projectiles.clear();
    this.dummy.resetTarget(this.terrain.worldWidth);
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

  update(dt) {
    let pointerWorld = this.camera.screenToWorld(this.pointer.x, this.pointer.y);
    this.camera.update(dt, this.player, pointerWorld);
    pointerWorld = this.camera.screenToWorld(this.pointer.x, this.pointer.y);
    this.player.update(dt, pointerWorld);

    const activeWeapon = this.player.weaponMount.weapon;
    if (activeWeapon?.chargeRate > 0) this.gainCharge(activeWeapon.chargeRate * dt);

    const weaponContext = {
      projectiles:this.projectiles,
      player:this.player,
      game:this
    };

    // Revolver is intentionally semi-auto: one LMB press = one chamber.
    if (this.pointer.consumePressed(0)) this.player.weaponMount.primary(weaponContext);
    if (this.input.consumePressed('reload')) this.player.weaponMount.reload(weaponContext);
    if (this.input.consumePressed('special')) this.player.weaponMount.special(weaponContext);

    this.dummy.updateTarget(dt, { x:this.player.x, y:this.player.y });
    this.projectiles.update(dt, {
      width:this.terrain.worldWidth,
      height:this.terrain.worldHeight,
      targets:this.getTargetableActors()
    });

    // Temporary water hazard until the proper death/round layer exists.
    if (this.player.y > this.terrain.waterY + 230) this.reset();
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

    const weapon = this.player.weaponMount.weapon;
    const readiness = weapon?.attackReadiness?.(this) || [1, 1, 1];

    this.drawBar(ctx, x, attack1Y, attackW, attackH, readiness[0] ?? 1, '#f2f2f2', 'attack1');
    this.drawBar(ctx, x, attack2Y, attackW, attackH, readiness[1] ?? 1, '#f2f2f2', 'attack2');
    this.drawBar(ctx, x, attack3Y, attackW, attackH, readiness[2] ?? 1, '#f2f2f2', 'attack3');

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
    this.dummy.renderTarget(ctx);
    this.projectiles.render(ctx);
    this.player.render(ctx, false);
    this.camera.end(ctx);

    // Weapon-specific queue/status stays top-left, shared bars stay bottom-left.
    this.player.weaponMount.weapon?.renderHud?.(ctx, 22, 22);
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
