'use strict';

class TargetFighterInput {
  axis() { return 0; }
  down() { return false; }
  consumePressed() { return false; }
}

// A target actor built from the exact same Player body/leg/arm implementation.
// It is intentionally dumb for now: it stands there, takes hits, and respawns.
class TargetFighter extends Player {
  constructor({ terrain, config }) {
    super({
      input:new TargetFighterInput(),
      terrain,
      config,
      appearance:{
        body:'#8c6f78',
        legUpper0:'#b87b59', legLower0:'#b87b59', foot0:'#b87b59',
        legUpper1:'#b87b59', legLower1:'#b87b59', foot1:'#b87b59',
        armUpper:'#6d8f98', armLower:'#6d8f98', hand:'#6d8f98'
      }
    });
    this.maxHealth = 100;
    this.dead = false;
    this.respawn = 0;
    this.hitFlash = 0;
    this.worldWidth = 1000;
    this.aim = { x:0, y:0 };
    this.weaponMount.unequip();
  }

  resetTarget(worldWidth) {
    this.worldWidth = worldWidth;
    super.reset(worldWidth);
    const spawn = this.terrain.spawn?.(1);
    if (spawn) this.placeAt(spawn.x, spawn.y);
    else {
      const left = this.terrain.islandLeft ?? 0;
      const right = this.terrain.islandRight ?? worldWidth;
      this.placeAt(left + (right - left) * 0.78);
    }
    this.health = this.maxHealth;
    this.tempHealth = 0;
    this.tempHealthTime = 0;
    this.dead = false;
    this.respawn = 0;
    this.hitFlash = 0;
    this.weaponMount.unequip();
    this.aim.x = this.x - 120;
    this.aim.y = this.y - 8;
  }

  hitbox() {
    return { x:this.x, y:this.y, w:this.cfg.bodyW, h:this.cfg.bodyH };
  }

  takeHit(projectile) {
    if (this.dead) return;
    this.takeDamage(projectile.damage);
    if (!projectile.noPhysicalHit) {
      const speed = MathEx.hypot(projectile.vx, projectile.vy) || 1;
      const dx = projectile.vx / speed;
      const dy = projectile.vy / speed;
      this.vx += dx * projectile.knockback;
      this.vy += dy * projectile.knockback * 0.16 - 55;
    }
    this.hitFlash = 0.11;
    if (this.health <= 0) {
      this.dead = true;
    }
  }

  updateTarget(dt, lookAt) {
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.dead) return;
    this.aim.x = lookAt?.x ?? this.x - 120;
    this.aim.y = lookAt?.y ?? this.y;
    super.update(dt, this.aim);
  }

  renderTarget(ctx) {
    if (this.dead) return;
    super.render(ctx, false, { showAimPointer:false });

    if (this.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = MathEx.clamp(this.hitFlash / 0.11, 0, 1) * 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x - this.cfg.bodyW / 2, this.y - this.cfg.bodyH / 2, this.cfg.bodyW, this.cfg.bodyH);
      ctx.restore();
    }

    const barW = 64;
    const ratio = MathEx.clamp(this.health / this.maxHealth, 0, 1);
    ctx.fillStyle = '#3b3b3b';
    ctx.fillRect(this.x - barW / 2, this.y - this.cfg.bodyH / 2 - 18, barW, 7);
    ctx.fillStyle = '#d1d1d1';
    ctx.fillRect(this.x - barW / 2, this.y - this.cfg.bodyH / 2 - 18, barW * ratio, 7);
  }
}
