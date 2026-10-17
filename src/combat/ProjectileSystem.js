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
    // Snapshot the list so burst projectiles begin updating on the next fixed step.
    const active = this.items.slice();

    for (const projectile of active) {
      projectile.update(dt, {
        targets,
        terrain:this.terrain,
        system:this,
        width,
        height
      });
      if (projectile.dead) continue;

      if (projectile.x < -60 || projectile.x > width + 60 || projectile.y < -60 || projectile.y > height + 60) {
        projectile.dead = true;
        continue;
      }

      if (!projectile.ignoresTerrain && !projectile.handlesTerrain) {
        const radius = projectile.hitRadius ?? Math.max(projectile.width || 0, projectile.height || 0) * 0.5;
        if (this.terrain.circleIntersectsSolid?.(projectile.x, projectile.y, radius)) {
          projectile.dead = true;
          continue;
        }
      }

      if (projectile.nonCombat) continue;

      for (const target of targets) {
        if (!target || target.dead || !target.hitbox || !target.takeHit) continue;
        if (projectile.hitTargets?.has(target)) continue;
        if (!this.hitRect(projectile, target.hitbox())) continue;

        target.takeHit(projectile);
        projectile.hitTargets?.add(target);
        projectile.onHit?.(target, projectile);

        if (!projectile.pierceTargets) {
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
