'use strict';

class MenuDemoInput {
  constructor() { this.move = 1; this.run = false; this.jumpTimer = 0; }
  axis(negativeAction, positiveAction) { return negativeAction === 'left' && positiveAction === 'right' ? this.move : 0; }
  down(action) { if (action === 'run') return this.run; if (action === 'jump') return this.jumpTimer > 0; return false; }
}

class MenuDemoTerrain {
  constructor() { this.width = 440; this.height = 300; this.floor = 258; }
  resize(width, height) { this.width = width; this.height = height; this.floor = height - 34; }
  hasGroundAt() { return true; }
  clampGroundX(x, margin = 0) { return MathEx.clamp(x, margin, this.width - margin); }
  groundYAt() { return this.floor; }
  yAt() { return this.floor; }
  slopeAt() { return 0; }
}

// Reuses the real Player. It can be used for the main menu or customization.
class MenuDemo {
  constructor(canvas, { interactive = false, stationaryShowcase = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.interactive = interactive;
    this.stationaryShowcase = stationaryShowcase;
    this.active = true;
    this.last = performance.now();
    this.time = 0;
    this.nextDecision = 0;
    this.input = new MenuDemoInput();
    this.terrain = new MenuDemoTerrain();
    this.config = createGameConfig();
    this.player = new Player({ input:this.input, terrain:this.terrain, config:this.config });
    this.aim = { x:340, y:130 };
    this.hovered = false;
    this.mouseLogical = { x:220, y:120 };
    this.logicalWidth = 440;
    this.logicalHeight = 300;
    this.weaponId = stationaryShowcase ? 'revolver' : 'none';

    if (interactive) {
      const updateMouse = (event) => {
        const rect = canvas.getBoundingClientRect();
        const sx = (event.clientX - rect.left) / Math.max(1, rect.width);
        const sy = (event.clientY - rect.top) / Math.max(1, rect.height);
        this.mouseLogical.x = sx * this.logicalWidth;
        this.mouseLogical.y = sy * this.logicalHeight;
      };
      canvas.addEventListener('mouseenter', (e) => { this.hovered = true; updateMouse(e); });
      canvas.addEventListener('mousemove', updateMouse);
      canvas.addEventListener('mouseleave', () => { this.hovered = false; });
    }

    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  setAppearance(appearance) { this.player.setAppearance(appearance); }
  setWeapon(id) {
    this.weaponId = id;
    this.player.weaponMount.equip(WeaponRegistry.create(id));
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    // The customization preview uses a tighter virtual stage so the real
    // character can be shown large without clipping out of the canvas.
    this.logicalWidth = this.stationaryShowcase ? 300 : 410;
    this.logicalHeight = this.stationaryShowcase ? 230 : 270;
    this.terrain.resize(this.logicalWidth, this.logicalHeight);
    this.player.reset(this.logicalWidth);
    this.player.x = this.logicalWidth * 0.5;
    this.player.y = this.player.supportBaseY();
    this.player.hand.reset(this.player);
    this.player.arm.reset(this.player, this.player.hand);
    this.player.weaponMount.equip(WeaponRegistry.create(this.weaponId));
  }

  decide() {
    this.input.move = Math.random() < 0.5 ? -1 : 1;
    this.input.run = Math.random() < 0.30;
    if (Math.random() < 0.56) this.input.jumpTimer = 0.11;
    this.nextDecision = this.time + 0.72 + Math.random() * 1.10;
  }

  update(dt) {
    if (!this.active) return;
    this.time += dt;
    this.input.jumpTimer = Math.max(0, this.input.jumpTimer - dt);

    if (this.stationaryShowcase) {
      // Customization is a mannequin, not a roaming demo. Keep the body
      // centered so colors/weapons are easy to inspect. A rare idle hop
      // still shows the procedural legs doing something goofy.
      this.input.move = 0;
      this.input.run = false;
      if (this.player.onGround && this.input.jumpTimer <= 0 && Math.random() < dt * 0.085) {
        this.input.jumpTimer = 0.10;
      }
      this.aim.x = this.player.x + 112;
      this.aim.y = this.player.y - 10 + Math.sin(this.time * 1.7) * 18;
      this.player.update(dt, this.aim);
      this.player.x = this.logicalWidth * 0.5;
      this.player.vx = 0;
      return;
    }

    if (this.hovered && this.interactive) {
      const dx = this.mouseLogical.x - this.player.x;
      this.input.move = Math.abs(dx) > 42 ? Math.sign(dx) : 0;
      this.input.run = Math.abs(dx) > 145;
      this.aim.x = this.mouseLogical.x;
      this.aim.y = this.mouseLogical.y;
      if (this.player.onGround && this.mouseLogical.y < this.player.y - 70 && Math.random() < dt * 0.75) this.input.jumpTimer = 0.10;
    } else {
      if (this.time >= this.nextDecision) this.decide();
      if (this.player.x < 88) this.input.move = 1;
      if (this.player.x > this.logicalWidth - 88) this.input.move = -1;
      const lookDistance = 125;
      this.aim.x = this.player.x + (this.input.move || this.player.facing) * lookDistance;
      this.aim.y = this.player.y - 12 + Math.sin(this.time * 2.5) * 42;
    }
    this.player.update(dt, this.aim);
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#474747';
    ctx.fillRect(0, 0, this.width, this.height);

    const fitScale = Math.min(this.width / this.logicalWidth, this.height / this.logicalHeight);
    // The customizer is intentionally a close-up, but never larger than the
    // panel can actually contain. This avoids the old bottom clipping.
    const scale = fitScale * (this.stationaryShowcase ? 0.96 : 1.20);
    const ox = this.width * 0.5 - this.logicalWidth * scale * 0.5;
    const oy = this.height * (this.stationaryShowcase ? 0.50 : 0.52) - this.logicalHeight * scale * 0.5;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#3d3d3d';
    ctx.fillRect(0, this.terrain.floor, this.logicalWidth, this.logicalHeight - this.terrain.floor);
    this.player.render(ctx, false, { showAimPointer:false });
    ctx.restore();
  }

  frame = (now) => {
    const dt = Math.min(0.035, (now - this.last) / 1000 || 0);
    this.last = now;
    this.update(dt);
    this.render();
    requestAnimationFrame(this.frame);
  };
  start() { requestAnimationFrame(this.frame); }
}
