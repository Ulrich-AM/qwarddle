'use strict';

class SakeGourdProjectile extends Projectile {
  constructor({ game, sprite, gravity = 900, ...options } = {}) {
    super({ ...options, width:30, height:30 });
    this.game = game;
    this.sprite = sprite;
    this.gravity = gravity;
    this.handlesTerrain = true;
    this.hitRadius = 15;
    this.spin = 0;
  }

  update(dt, context = {}) {
    this.vy += this.gravity * dt;
    super.update(dt);
    this.spin += dt * 7.5;

    if (this.dead) return;
    if (context.terrain?.circleIntersectsSolid?.(this.x, this.y, this.hitRadius)) {
      this.shatter();
    }
  }

  shatter() {
    if (this.dead) return;
    this.dead = true;
    this.game?.addHazard?.(new SakeShardField({
      x:this.x,
      y:this.y,
      terrain:this.game.terrain
    }));
  }

  render(ctx) {
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.rotate(this.angle + this.spin);
    ctx.imageSmoothingEnabled = false;

    if (this.sprite?.complete && this.sprite.naturalWidth > 0) {
      const desired = 42;
      const scale = desired / Math.max(this.sprite.naturalWidth, this.sprite.naturalHeight);
      const w = Math.max(1, Math.round(this.sprite.naturalWidth * scale));
      const h = Math.max(1, Math.round(this.sprite.naturalHeight * scale));
      ctx.drawImage(this.sprite, -Math.round(w / 2), -Math.round(h / 2), w, h);
    } else {
      ctx.fillStyle = '#bf7950';
      ctx.fillRect(-13, -17, 26, 34);
    }

    ctx.restore();
  }
}

class SakePuddle {
  constructor({
    x,
    y,
    owner = null,
    strong = false,
    duration = 8,
    width = 132,
    damage = 7,
    stun = 0.85,
    color = '#e2a417'
  } = {}) {
    Object.assign(this, { x, y, owner, strong, duration, width, damage, stun, color });
    this.age = 0;
    this.dead = false;
    this.inside = new Set();
  }

  update(dt, game) {
    this.age += dt;
    if (this.age >= this.duration) {
      this.dead = true;
      return;
    }

    const actors = game.getHazardActors();
    const left = this.x - this.width * 0.5;
    const right = this.x + this.width * 0.5;

    for (const actor of actors) {
      if (!actor || actor === this.owner) continue;
      const box = actor.collisionBox();
      const touching = box.right >= left && box.left <= right && Math.abs(box.bottom - this.y) <= 30;

      if (touching && !this.inside.has(actor)) {
        actor.takeDamage(this.damage);
        if (actor.health <= 0 && 'dead' in actor) actor.dead = true;
        else game.knockDownActor(actor, this.stun);
        this.inside.add(actor);
      } else if (!touching) {
        this.inside.delete(actor);
      }
    }
  }

  render(ctx) {
    const alpha = MathEx.clamp(1 - this.age / this.duration, 0, 1);
    ctx.save();
    ctx.globalAlpha *= alpha;

    if (this.strong) {
      const count = 9;
      for (let i = 0; i < count; i++) {
        const t = i / Math.max(1, count - 1);
        const px = this.x - this.width * 0.5 + t * this.width;
        const py = this.y - 4 - Math.sin(t * Math.PI * 3) * 3;
        ctx.beginPath();
        ctx.arc(px, py, 9 + (i % 3) * 2, 0, Math.PI * 2);
        ctx.fillStyle = '#00f822';
        ctx.fill();
        ctx.strokeStyle = '#202020';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#202020';
      ctx.fillRect(this.x - this.width * 0.5 - 3, this.y - 8, this.width + 6, 11);
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x - this.width * 0.5, this.y - 6, this.width, 7);
    }

    ctx.restore();
  }
}

class SakeShardField {
  constructor({ x, y, terrain, duration = 7 } = {}) {
    this.x = x;
    this.y = terrain?.surfaceYAt?.(x, y) ?? y;
    this.duration = duration;
    this.age = 0;
    this.dead = false;
    this.width = 132;
    this.cooldowns = new Map();

    this.shards = Array.from({ length:9 }, (_, index) => ({
      x:(index / 8 - 0.5) * this.width + (Math.random() - 0.5) * 10,
      y:-4 - Math.random() * 5,
      w:8 + Math.random() * 9,
      h:3 + Math.random() * 4,
      angle:(Math.random() - 0.5) * 1.2
    }));
  }

  update(dt, game) {
    this.age += dt;
    if (this.age >= this.duration) {
      this.dead = true;
      return;
    }

    for (const [actor, time] of this.cooldowns) {
      const next = time - dt;
      if (next <= 0) this.cooldowns.delete(actor);
      else this.cooldowns.set(actor, next);
    }

    const alpha = MathEx.clamp(1 - this.age / this.duration, 0, 1);
    if (alpha <= 0.5) return;

    const left = this.x - this.width * 0.5;
    const right = this.x + this.width * 0.5;
    for (const actor of game.getHazardActors()) {
      if (!actor || this.cooldowns.has(actor)) continue;
      const box = actor.collisionBox();
      const touching = box.right >= left && box.left <= right && Math.abs(box.bottom - this.y) <= 26;
      if (!touching) continue;

      actor.takeDamage(4);
      actor.applyBleed?.(3, 4);
      actor.applyStun?.(0.18);
      if (actor.health <= 0 && 'dead' in actor) actor.dead = true;
      this.cooldowns.set(actor, 0.65);
    }
  }

  render(ctx) {
    const alpha = MathEx.clamp(1 - this.age / this.duration, 0, 1);
    ctx.save();
    ctx.globalAlpha *= alpha;

    for (const shard of this.shards) {
      ctx.save();
      ctx.translate(Math.round(this.x + shard.x), Math.round(this.y + shard.y));
      ctx.rotate(shard.angle);
      ctx.fillStyle = '#202020';
      ctx.fillRect(-shard.w / 2 - 2, -shard.h / 2 - 2, shard.w + 4, shard.h + 4);
      ctx.fillStyle = '#bf7950';
      ctx.fillRect(-shard.w / 2, -shard.h / 2, shard.w, shard.h);
      ctx.restore();
    }

    ctx.restore();
  }
}

class Sake extends Weapon {
  constructor() {
    super({
      id:'sake',
      name:'SAKE',
      damage:0,
      cooldown:0,
      knockback:0,
      recoil:0,
      muzzleOffset:42
    });

    this.drinkCooldown = 5;
    this.skill2SpitCooldown = 4;
    this.skill2SpillCooldown = 5;
    this.chugCooldown = 25;
    this.gourdThrowCooldown = 3;

    this.drinkCooldownRemaining = 0;
    this.skill2CooldownRemaining = 0;
    this.skill2CooldownTotal = this.skill2SpillCooldown;
    this.chugCooldownRemaining = 0;
    this.gourdCooldownRemaining = 0;

    this.mouthful = false;
    this.drunkRemaining = 0;
    this.drunkDuration = 15;
    this.drunkMoveTimer = 0;
    this.pose = 'normal';
    this.poseTime = 0;
    this.throwHideTime = 0;
    this.game = null;

    this.spriteRoot = 'assets/sprites/sake/';
    this.sprites = {
      gourd:this.loadSprite('sake.png'),
      droplet:this.loadSprite('sake-droplet.png'),
      drunk:this.loadSprite('drunken-swirls.png')
    };
  }

  loadSprite(file) {
    const image = new Image();
    image.src = this.spriteRoot + file;
    return image;
  }

  imageReady(image) {
    return !!image && image.complete && image.naturalWidth > 0;
  }

  beginPose(name, time) {
    this.pose = name;
    this.poseTime = Math.max(this.poseTime, time);
  }

  update(dt, { player } = {}) {
    super.update(dt);
    this.drinkCooldownRemaining = Math.max(0, this.drinkCooldownRemaining - dt);
    this.skill2CooldownRemaining = Math.max(0, this.skill2CooldownRemaining - dt);
    this.chugCooldownRemaining = Math.max(0, this.chugCooldownRemaining - dt);
    this.gourdCooldownRemaining = Math.max(0, this.gourdCooldownRemaining - dt);
    this.poseTime = Math.max(0, this.poseTime - dt);
    this.throwHideTime = Math.max(0, this.throwHideTime - dt);
    if (this.poseTime <= 0) this.pose = 'normal';

    if (this.drunkRemaining > 0) {
      const previous = this.drunkRemaining;
      this.drunkRemaining = Math.max(0, this.drunkRemaining - dt);
      this.drunkMoveTimer -= dt;

      if (player && this.drunkMoveTimer <= 0) {
        player.vx += (Math.random() < 0.5 ? -1 : 1) * (32 + Math.random() * 42);
        this.drunkMoveTimer = 0.24 + Math.random() * 0.46;
      }

      if (previous > 0 && this.drunkRemaining <= 0 && player) {
        player.removeBuff?.('sake-drunk');
        this.spawnVomit(player);
      }
    }
  }

  primary({ mount, projectiles, player, game }) {
    this.game = game || this.game;
    if (!player || !game) return false;

    if (this.drunkRemaining > 0) {
      return this.throwGourd({ mount, projectiles, player, game });
    }

    if (this.drinkCooldownRemaining > 0 || this.mouthful) return false;

    this.drinkCooldownRemaining = this.drinkCooldown;
    this.mouthful = true;
    this.beginPose('drink', 0.72);

    const outcome = Math.floor(Math.random() * 3);
    if (outcome === 0) {
      player.addBuff('sake-melee', 5, { melee:1.25 });
    } else if (outcome === 1) {
      player.addBuff('sake-defense', 5, { defense:0.8 });
    } else {
      player.heal(8);
    }

    game.addStatusVisual(
      player,
      'assets/sprites/characters/enlightned-particle.png',
      outcome === 2 ? 2.4 : 5,
      'sake-drink'
    );
    return true;
  }

  reload({ mount, projectiles, player, game }) {
    this.game = game || this.game;
    if (!player || !game || this.drunkRemaining > 0 || this.skill2CooldownRemaining > 0) return false;

    if (this.mouthful) {
      this.mouthful = false;
      this.skill2CooldownTotal = this.skill2SpitCooldown;
      this.skill2CooldownRemaining = this.skill2SpitCooldown;
      this.beginPose('spit', 0.35);
      this.spitCone({ mount, projectiles, player, game });
      return true;
    }

    this.skill2CooldownTotal = this.skill2SpillCooldown;
    this.skill2CooldownRemaining = this.skill2SpillCooldown;
    this.beginPose('spill', 0.62);
    this.spill({ player, game });
    return true;
  }

  special({ player, game }) {
    this.game = game || this.game;
    if (!player || !game || this.drunkRemaining > 0 || this.chugCooldownRemaining > 0) return false;

    this.mouthful = false;
    this.chugCooldownRemaining = this.chugCooldown;
    this.drunkRemaining = this.drunkDuration;
    this.drunkMoveTimer = 0.15;
    this.beginPose('chug', 1.05);

    player.addBuff('sake-drunk', this.drunkDuration, {
      defense:2 / 3,
      damage:1.5,
      melee:1.5,
      move:1.5,
      jump:1.5
    });

    game.addStatusVisual(
      player,
      'assets/sprites/sake/drunken-swirls.png',
      this.drunkDuration,
      'sake-drunk',
      { rate:0.10, size:34, drift:12 }
    );
    return true;
  }

  spitCone({ mount, projectiles, player, game }) {
    const hand = mount.position();
    const base = Math.atan2(mount.dirY, mount.dirX);
    const count = 9;
    const spread = 0.48;
    const damage = 3.2 * player.buffMultiplier('damage');

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const angle = base + MathEx.lerp(-spread, spread, t);
      const speed = 530 + Math.sin(t * Math.PI) * 130;
      projectiles.spawn(new Projectile({
        x:hand.x + mount.dirX * 30,
        y:hand.y + mount.dirY * 30,
        vx:Math.cos(angle) * speed,
        vy:Math.sin(angle) * speed,
        damage,
        knockback:190,
        life:0.75,
        width:14,
        height:14,
        color:'#00f822',
        shape:'circle',
        outlineColor:'#202020',
        outlineWidth:3
      }));
    }

    game.addStatusVisual(
      player,
      'assets/sprites/sake/sake-droplet.png',
      0.42,
      'sake-spit',
      { rate:0.035, size:14, drift:24 }
    );
  }

  spill({ player, game }) {
    const x = player.x + player.facing * 34;
    const reference = player.collisionBox().bottom;
    const y = game.terrain.surfaceYAt?.(x, reference) ?? reference;

    game.addHazard(new SakePuddle({
      x,
      y,
      owner:player,
      strong:false,
      duration:8,
      width:138,
      damage:7,
      stun:0.85,
      color:'#e2a417'
    }));

    game.addStatusVisual(
      player,
      'assets/sprites/sake/sake-droplet.png',
      0.55,
      'sake-spill',
      { rate:0.05, size:12, drift:10 }
    );
  }

  spawnVomit(player) {
    const game = this.game;
    if (!game) return;

    const x = player.x + player.facing * 30;
    const reference = player.collisionBox().bottom;
    const y = game.terrain.surfaceYAt?.(x, reference) ?? reference;

    game.addHazard(new SakePuddle({
      x,
      y,
      owner:player,
      strong:true,
      duration:10,
      width:168,
      damage:14,
      stun:1.45,
      color:'#00f822'
    }));

    game.addStatusVisual(
      player,
      'assets/sprites/sake/sake-droplet.png',
      0.9,
      'sake-vomit',
      { rate:0.04, size:15, drift:26 }
    );
  }

  throwGourd({ mount, projectiles, player, game }) {
    if (!projectiles || this.gourdCooldownRemaining > 0) return false;

    const hand = mount.position();
    const targetX = mount.hand.targetX;
    const targetY = mount.hand.targetY;
    const dx = targetX - hand.x;
    const dy = targetY - hand.y;
    const distance = MathEx.hypot(dx, dy);
    const flightTime = MathEx.clamp(distance / 760, 0.38, 1.05);
    const gravity = 900;
    const vx = dx / flightTime;
    const vy = (dy - 0.5 * gravity * flightTime * flightTime) / flightTime;
    const damage = 18 * player.buffMultiplier('damage');

    projectiles.spawn(new SakeGourdProjectile({
      game,
      sprite:this.sprites.gourd,
      gravity,
      x:hand.x,
      y:hand.y,
      vx,
      vy,
      damage,
      knockback:320,
      life:3.2,
      onHit:(target) => target.applyBleed?.(3, 4)
    }));

    this.gourdCooldownRemaining = this.gourdThrowCooldown;
    this.throwHideTime = 0.34;
    return true;
  }

  attackReadiness() {
    if (this.drunkRemaining > 0) {
      return [
        MathEx.clamp(1 - this.gourdCooldownRemaining / this.gourdThrowCooldown, 0, 1),
        0,
        0
      ];
    }

    const attack1 = this.mouthful
      ? 0
      : MathEx.clamp(1 - this.drinkCooldownRemaining / this.drinkCooldown, 0, 1);
    const attack2 = MathEx.clamp(
      1 - this.skill2CooldownRemaining / Math.max(0.001, this.skill2CooldownTotal),
      0,
      1
    );
    const attack3 = MathEx.clamp(1 - this.chugCooldownRemaining / this.chugCooldown, 0, 1);
    return [attack1, attack2, attack3];
  }

  render(ctx, { mount }) {
    if (this.throwHideTime > 0) return;

    const p = mount.position();
    let angle = mount.angle;
    if (this.pose === 'drink' || this.pose === 'chug') {
      angle += mount.dirX >= 0 ? -1.08 : 1.08;
    } else if (this.pose === 'spill') {
      angle += mount.dirX >= 0 ? 1.25 : -1.25;
    }

    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    const step = Math.PI / 24;
    ctx.rotate(Math.round(angle / step) * step);
    if (mount.dirX < 0) ctx.scale(1, -1);
    ctx.imageSmoothingEnabled = false;

    if (this.imageReady(this.sprites.gourd)) {
      const desired = 66;
      const scale = desired / Math.max(this.sprites.gourd.naturalWidth, this.sprites.gourd.naturalHeight);
      const w = Math.max(1, Math.round(this.sprites.gourd.naturalWidth * scale));
      const h = Math.max(1, Math.round(this.sprites.gourd.naturalHeight * scale));
      ctx.drawImage(this.sprites.gourd, -Math.round(w * 0.34), -Math.round(h * 0.5), w, h);
    } else {
      ctx.fillStyle = '#bf7950';
      ctx.fillRect(-14, -20, 28, 40);
    }

    ctx.restore();
  }
}
