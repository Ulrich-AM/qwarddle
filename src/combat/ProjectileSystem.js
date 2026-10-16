'use strict';

class ProjectileSystem {
  constructor({ terrain }) {
    this.terrain = terrain;
    this.items = [];
  }

  clear() { this.items.length = 0; }
  spawn(projectile) { this.items.push(projectile); return projectile; }

  hitRect(projectile, rect) {
    const r = projectile.hitRadius ?? Math.max(projectile.width || 0, projectile.height || 0) * 0.5;
    return projectile.x + r >= rect.x - rect.w * 0.5 &&
      projectile.x - r <= rect.x + rect.w * 0.5 &&
      projectile.y + r >= rect.y - rect.h * 0.5 &&
      projectile.y - r <= rect.y + rect.h * 0.5;
  }

  update(dt, { width, height, targets = [] }) {
    for (const projectile of this.items) {
      projectile.update(dt);
      if (projectile.dead) continue;

      if (projectile.x < -40 || projectile.x > width + 40 || projectile.y < -40 || projectile.y > height + 40) {
        projectile.dead = true;
        continue;
      }

      const ground = this.terrain.groundYAt ? this.terrain.groundYAt(projectile.x) : this.terrain.yAt(projectile.x);
      if (ground != null && projectile.y >= ground) {
        projectile.dead = true;
        continue;
      }

      for (const target of targets) {
        if (!target || target.dead || !target.hitbox || !target.takeHit) continue;
        if (this.hitRect(projectile, target.hitbox())) {
          target.takeHit(projectile);
          projectile.dead = true;
          break;
        }
      }
    }

    this.items = this.items.filter((projectile) => !projectile.dead);
  }

  render(ctx) {
    for (const projectile of this.items) projectile.render(ctx);
  }
}
