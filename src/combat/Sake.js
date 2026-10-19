'use strict';

class SakeDropletProjectile extends Projectile {
  constructor({
    sprite = null,
    gravity = 0,
    nonCombat = false,
    ...options
  } = {}) {
    super({ ...options });
    this.sprite = sprite;
    this.gravity = gravity;
    this.nonCombat = nonCombat;
    this.initialLife = this.life;
    this.spin = (Math.random() - 0.5) * 1.4;
  }

  update(dt) {
    this.vy += this.gravity * dt;
    super.update(dt);
  }

  render(ctx) {
    const alpha = MathEx.clamp(this.life / Math.max(0.001, this.initialLife), 0, 1);

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.rotate(this.angle + this.spin);
    ctx.imageSmoothingEnabled = false;

    if (this.sprite?.complete && this.sprite.naturalWidth > 0) {
      const desired = Math.max(this.width, this.height);
      const scale = desired / Math.max(this.sprite.naturalWidth, this.sprite.naturalHeight);
      const w = Math.max(1, Math.round(this.sprite.naturalWidth * scale));
      const h = Math.max(1, Math.round(this.sprite.naturalHeight * scale));
      ctx.drawImage(this.sprite, -Math.round(w / 2), -Math.round(h / 2), w, h);
    } else {
      const radius = Math.max(3, this.hitRadius);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color || '#00f822';
      ctx.fill();
      ctx.strokeStyle = this.outlineColor || '#202020';
      ctx.lineWidth = this.outlineWidth || 3;
      ctx.stroke();
    }

    ctx.restore();
  }
}

class SakeGourdProjectile extends Projectile {
  constructor({ game, sprite, gravity = 900, ...options } = {}) {
    super({ ...options, width:48, height:48 });
    this.game = game;
    this.sprite = sprite;
    this.gravity = gravity;
    this.handlesTerrain = true;
    this.hitRadius = 24;
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
      owner:this.owner,
      terrain:this.game.terrain,
      impactVx:this.vx,
      impactVy:this.vy
    }));
  }

  render(ctx) {
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.rotate(this.angle + this.spin);
    ctx.imageSmoothingEnabled = false;

    if (this.sprite?.complete && this.sprite.naturalWidth > 0) {
      const desired = 82;
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
    duration = 8,
    width = 132,
    damage = CombatBalance.sake.puddleDamage,
    stun = 0.85,
    color = '#e2a417'
  } = {}) {
    Object.assign(this, { x, y, owner, duration, width, damage, stun, color });
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

    const left = this.x - this.width * 0.5;
    const right = this.x + this.width * 0.5;

    for (const actor of game.getHazardActors()) {
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
    ctx.fillStyle = '#202020';
    ctx.fillRect(this.x - this.width * 0.5 - 3, this.y - 8, this.width + 6, 11);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.width * 0.5, this.y - 6, this.width, 7);
    ctx.restore();
  }
}

class SakeShardField {
  constructor({
    x,
    y,
    owner = null,
    terrain,
    impactVx = 0,
    impactVy = 0,
    duration = 7
  } = {}) {
    this.terrain = terrain;
    this.owner = owner;
    this.duration = duration;
    this.age = 0;
    this.dead = false;
    this.cooldowns = new Map();

    this.shards = Array.from({ length:10 }, () => {
      const outward = (Math.random() - 0.5) * 440;
      return {
        x,
        y,
        vx:impactVx * 0.14 + outward,
        vy:Math.min(-90, impactVy * 0.06 - 120 - Math.random() * 230),
        w:18 + Math.random() * 16,
        h:7 + Math.random() * 7,
        angle:(Math.random() - 0.5) * 1.4,
        av:(Math.random() - 0.5) * 9,
        settled:false
      };
    });
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

    for (const shard of this.shards) {
      if (shard.settled) continue;

      shard.vy += 1050 * dt;
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.angle += shard.av * dt;

      const ground = this.terrain?.surfaceYAt?.(shard.x, shard.y + 16);
      if (ground != null && shard.vy > 0 && shard.y + shard.h * 0.5 >= ground) {
        shard.y = ground - shard.h * 0.5;
        shard.vy *= -0.18;
        shard.vx *= 0.62;
        shard.av *= 0.55;

        if (Math.abs(shard.vy) < 55) {
          shard.vy = 0;
          shard.vx = 0;
          shard.av = 0;
          shard.settled = true;
        }
      }
    }

    const alpha = MathEx.clamp(1 - this.age / this.duration, 0, 1);
    if (alpha <= 0.5) return;

    for (const actor of game.getHazardActors()) {
      if (!actor || actor === this.owner || this.cooldowns.has(actor)) continue;
      const box = actor.collisionBox();

      const touching = this.shards.some((shard) => {
        const halfW = shard.w * 0.5;
        const halfH = shard.h * 0.5;
        return box.right >= shard.x - halfW &&
          box.left <= shard.x + halfW &&
          box.bottom >= shard.y - halfH - 8 &&
          box.top <= shard.y + halfH + 8;
      });

      if (!touching) continue;

      actor.takeDamage(CombatBalance.sake.shardDamage);
      actor.applyBleed?.(
        CombatBalance.sake.shardBleedDuration,
        CombatBalance.sake.shardBleedDps
      );
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
      ctx.translate(Math.round(shard.x), Math.round(shard.y));
      ctx.rotate(shard.angle);
      ctx.fillStyle = '#202020';
      ctx.fillRect(
        -shard.w * 0.5 - 5,
        -shard.h * 0.5 - 5,
        shard.w + 10,
        shard.h + 10
      );
      ctx.fillStyle = '#bf7950';
      ctx.fillRect(
        -shard.w * 0.5,
        -shard.h * 0.5,
        shard.w,
        shard.h
      );
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
    this.mouthfulWindow = 5;
    this.skill2SpitCooldown = 4;
    this.skill2SpillCooldown = 5;
    this.spitDuration = 1.5;
    this.spitRemaining = 0;
    this.spitEmitTimer = 0;
    this.spitContext = null;
    this.chugCooldown = 25;
    this.gourdThrowCooldown = 3;
    this.drunkSwingCooldown = 1.25;
    this.chargeRate = 4;
    this.chargeOnHit = 3;

    this.drinkCooldownRemaining = 0;
    this.mouthful = false;
    this.mouthfulRemaining = 0;
    this.skill2CooldownRemaining = 0;
    this.skill2CooldownTotal = this.skill2SpillCooldown;
    this.chugCooldownRemaining = 0;
    this.gourdCooldownRemaining = 0;
    this.drunkSwingCooldownRemaining = 0;

    this.drunkMeter = 0;
    this.drunkMeterMax = 8;
    this.drunkRemaining = 0;
    this.drunkDuration = 15;
    this.drunkMoveTimer = 0;

    this.pose = 'normal';
    this.poseTime = 0;
    this.poseFacing = 1;

    this.gourdReturnDuration = 0.85;
    this.gourdReturnRemaining = 0;

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

  beginPose(name, time, facing = this.poseFacing) {
    this.pose = name;
    this.poseTime = Math.max(this.poseTime, time);
    this.poseFacing = facing || 1;
  }

  enterDrunkState(player, game) {
    if (!player || !game || this.drunkRemaining > 0) return false;

    this.mouthful = false;
    this.mouthfulRemaining = 0;
    this.drunkMeter = 0;
    this.drunkRemaining = this.drunkDuration;
    this.drunkMoveTimer = 0.15;
    this.beginPose('chug', 1.05, player.facing);

    player.removeBuff?.('sake-melee');
    player.removeBuff?.('sake-defense');
    player.removeBuff?.('sake-regen');
    game.removeStatusVisual?.(player, 'sake-drink');

    player.addBuff('sake-drunk', this.drunkDuration, {
      defense:CombatBalance.sake.drunkDefense,
      damage:CombatBalance.sake.drunkDamage,
      melee:CombatBalance.sake.drunkMelee,
      move:1.5,
      jump:1.5
    });

    player.hand?.setPoseOverride?.(18, -24, 1.05);
    player.weaponMount?.setAimOverride?.(player.facing * 0.22, -1, 1.05);

    game.addStatusVisual(
      player,
      'assets/sprites/sake/drunken-swirls.png',
      this.drunkDuration,
      'sake-drunk',
      { rate:0.10, size:34, drift:12 }
    );
    return true;
  }

  update(dt, { player } = {}) {
    super.update(dt);

    this.drinkCooldownRemaining = Math.max(0, this.drinkCooldownRemaining - dt);
    this.skill2CooldownRemaining = Math.max(0, this.skill2CooldownRemaining - dt);
    this.chugCooldownRemaining = Math.max(0, this.chugCooldownRemaining - dt);
    this.gourdCooldownRemaining = Math.max(0, this.gourdCooldownRemaining - dt);
    this.drunkSwingCooldownRemaining = Math.max(0, this.drunkSwingCooldownRemaining - dt);
    this.poseTime = Math.max(0, this.poseTime - dt);
    this.gourdReturnRemaining = Math.max(0, this.gourdReturnRemaining - dt);

    if (this.spitRemaining > 0 && this.spitContext) {
      this.spitRemaining = Math.max(0, this.spitRemaining - dt);
      this.spitEmitTimer -= dt;

      while (this.spitEmitTimer <= 0 && this.spitRemaining > 0) {
        this.emitSpitBurst(this.spitContext);
        this.spitEmitTimer += 0.10;
      }

      if (this.spitRemaining <= 0) {
        this.spitContext = null;
        this.spitEmitTimer = 0;
      }
    }

    if (this.poseTime <= 0) this.pose = 'normal';

    if (this.mouthfulRemaining > 0) {
      this.mouthfulRemaining = Math.max(0, this.mouthfulRemaining - dt);
      if (this.mouthfulRemaining <= 0) this.mouthful = false;
    }

    if (this.drunkRemaining > 0) {
      const previous = this.drunkRemaining;
      this.drunkRemaining = Math.max(0, this.drunkRemaining - dt);
      this.drunkMoveTimer -= dt;

      if (player && this.drunkMoveTimer <= 0) {
        player.vx += (Math.random() < 0.5 ? -1 : 1) * (95 + Math.random() * 135);
        this.drunkMoveTimer = 0.12 + Math.random() * 0.28;
      }

      if (previous > 0 && this.drunkRemaining <= 0 && player) {
        player.removeBuff?.('sake-drunk');
        this.game?.removeStatusVisual?.(player, 'sake-drunk');
      }
    }
  }

  primary({ mount, projectiles, player, game }) {
    this.game = game || this.game;
    if (!player || !game) return false;

    if (this.drunkRemaining > 0) {
      return this.throwGourd({ mount, projectiles, player, game });
    }

    if (this.drinkCooldownRemaining > 0) return false;

    this.drinkCooldownRemaining = this.drinkCooldown;
    this.mouthful = true;
    this.mouthfulRemaining = this.mouthfulWindow;
    this.drunkMeter = Math.min(this.drunkMeterMax, this.drunkMeter + 1);
    this.beginPose('drink', 0.78, player.facing);

    player.hand?.setPoseOverride?.(18, -24, 0.78);
    mount.setAimOverride?.(player.facing * 0.22, -1, 0.78);

    const outcome = Math.floor(Math.random() * 3);
    if (outcome === 0) {
      player.addBuff('sake-melee', 5, { melee:CombatBalance.sake.drinkMelee });
    } else if (outcome === 1) {
      player.addBuff('sake-defense', 5, { defense:CombatBalance.sake.drinkDefense });
    } else {
      player.addBuff('sake-regen', 5, { regen:CombatBalance.sake.drinkRegenTotal / 5 });
    }

    game.addStatusVisual(
      player,
      'assets/sprites/characters/enlightned-particle.png',
      5,
      'sake-drink',
      { opacity:0.45 }
    );

    if (this.drunkMeter >= this.drunkMeterMax) {
      this.enterDrunkState(player, game);
    }

    return true;
  }

  reload({ mount, projectiles, player, game }) {
    this.game = game || this.game;
    if (!player || !game) return false;

    if (this.drunkRemaining > 0) {
      return this.drunkSwing({ mount, player, game });
    }

    if (this.skill2CooldownRemaining > 0) return false;

    if (this.mouthful && this.mouthfulRemaining > 0) {
      this.mouthful = false;
      this.mouthfulRemaining = 0;
      this.skill2CooldownTotal = this.skill2SpitCooldown;
      this.skill2CooldownRemaining = this.skill2SpitCooldown;
      this.beginPose('spit', this.spitDuration, player.facing);
      this.spitRemaining = this.spitDuration;
      this.spitEmitTimer = 0;
      this.spitContext = { mount, projectiles, player, game };
      return true;
    }

    this.skill2CooldownTotal = this.skill2SpillCooldown;
    this.skill2CooldownRemaining = this.skill2SpillCooldown;
    this.beginPose('spill', 0.68, player.facing);
    player.hand?.setPoseOverride?.(30, 20, 0.68);
    mount.setAimOverride?.(player.facing * 0.18, 1, 0.68);
    this.spill({ mount, projectiles, player, game });
    return true;
  }

  special({ mount, player, game }) {
    this.game = game || this.game;
    if (!player || !game || this.drunkRemaining > 0 || this.chugCooldownRemaining > 0) return false;

    const enoughDrinks = this.drunkMeter >= 5;
    const usingCharge = !enoughDrinks && game.hasFullCharge();
    if (!enoughDrinks && !usingCharge) return false;

    if (usingCharge) game.consumeFullCharge();

    this.chugCooldownRemaining = this.chugCooldown;
    this.beginPose('chug', 1.05, player.facing);
    player.hand?.setPoseOverride?.(18, -24, 1.05);
    mount.setAimOverride?.(player.facing * 0.22, -1, 1.05);
    return this.enterDrunkState(player, game);
  }

  emitSpitBurst({ mount, projectiles, player }) {
    if (!projectiles || !player || !mount) return;

    const origin = {
      x:player.x + mount.dirX * 26,
      y:player.y - 10 + mount.dirY * 8
    };
    const base = Math.atan2(mount.dirY, mount.dirX);
    const spread = 0.58;
    const totalDamageScale = player.buffMultiplier('damage');

    // One gameplay droplet per pulse keeps total damage/knockback close to the
    // old single-burst move. Extra droplets are visual-only so the spit reads as
    // a sustained messy spray rather than a perfect projectile fan.
    const count = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const angle = base + (Math.random() - 0.5) * spread * 2;
      const speed = 390 + Math.random() * 330;
      const life = 0.42 + Math.random() * 0.48;
      const size = 10 + Math.random() * 8;
      const combatDroplet = i === 0;

      projectiles.spawn(new SakeDropletProjectile({
        owner:player,
        sprite:this.sprites.droplet,
        nonCombat:!combatDroplet,
        x:origin.x + mount.dirX * (6 + Math.random() * 8),
        y:origin.y + (Math.random() - 0.5) * 10,
        vx:Math.cos(angle) * speed,
        vy:Math.sin(angle) * speed + (Math.random() - 0.5) * 45,
        damage:combatDroplet ? CombatBalance.sake.spitDamage * totalDamageScale : 0,
        knockback:combatDroplet ? 22 : 0,
        life,
        width:size,
        height:size,
        color:'#00f822',
        outlineColor:'#202020',
        outlineWidth:3,
        onHit:combatDroplet ? (() => this.game?.gainCharge?.(this.chargeOnHit)) : null
      }));
    }
  }

  drunkSwing({ mount, player, game }) {
    if (this.drunkSwingCooldownRemaining > 0) return false;

    const targets = game.getTargetableActors();
    let target = null;
    let bestDistance = Infinity;
    for (const candidate of targets) {
      if (!candidate || candidate === player || candidate.dead) continue;
      const distance = MathEx.hypot(candidate.x - player.x, candidate.y - player.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        target = candidate;
      }
    }

    const dirX = target ? target.x - player.x : mount.dirX;
    const dirY = target ? target.y - player.y : mount.dirY;
    const length = MathEx.hypot(dirX, dirY) || 1;
    const nx = dirX / length;
    const ny = dirY / length;

    player.hand?.setPoseOverride?.(56, -4, 0.24);
    mount.setAimOverride?.(nx, ny, 0.24);
    this.beginPose('swing', 0.24, player.facing);

    if (target && bestDistance <= 155 && !target.isInvulnerable?.()) {
      const damage = CombatBalance.sake.swingDamage *
        player.buffMultiplier('damage') *
        player.buffMultiplier('melee');
      target.takeDamage(damage);
      target.vx += nx * 330;
      target.vy += ny * 100 - 55;
      game.gainCharge?.(this.chargeOnHit);
      if (target.health <= 0 && 'dead' in target) target.dead = true;
    }

    this.drunkSwingCooldownRemaining = this.drunkSwingCooldown;
    return true;
  }

  spill({ mount, projectiles, player, game }) {
    const x = player.x + player.facing * 34;
    const reference = player.collisionBox().bottom;
    const y = game.terrain.surfaceYAt?.(x, reference) ?? reference;

    game.addHazard(new SakePuddle({
      x,
      y,
      owner:player,
      duration:8,
      width:138,
      damage:CombatBalance.sake.puddleDamage,
      stun:0.85,
      color:'#e2a417'
    }));

    if (!projectiles) return;

    const hand = mount.position();
    const dropletCount = 7;
    for (let i = 0; i < dropletCount; i++) {
      projectiles.spawn(new SakeDropletProjectile({
        owner:player,
        sprite:this.sprites.droplet,
        nonCombat:true,
        ignoresTerrain:true,
        gravity:520,
        x:hand.x + player.facing * (8 + Math.random() * 10),
        y:hand.y + 8 + Math.random() * 8,
        vx:player.facing * (26 + Math.random() * 65) + (Math.random() - 0.5) * 24,
        vy:70 + Math.random() * 100,
        damage:0,
        knockback:0,
        life:0.38 + Math.random() * 0.35,
        width:9 + Math.random() * 5,
        height:9 + Math.random() * 5,
        color:'#e2a417',
        outlineColor:'#202020',
        outlineWidth:2
      }));
    }
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
    const damage = CombatBalance.sake.gourdDamage * player.buffMultiplier('damage');

    projectiles.spawn(new SakeGourdProjectile({
      owner:player,
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
      onHit:(target) => {
        target.applyBleed?.(
          CombatBalance.sake.gourdBleedDuration,
          CombatBalance.sake.gourdBleedDps
        );
        game.gainCharge?.(this.chargeOnHit);
      }
    }));

    this.gourdCooldownRemaining = this.gourdThrowCooldown;
    this.gourdReturnRemaining = this.gourdReturnDuration;
    return true;
  }

  attackReadiness(game) {
    if (this.drunkRemaining > 0) {
      return [
        MathEx.clamp(1 - this.gourdCooldownRemaining / this.gourdThrowCooldown, 0, 1),
        MathEx.clamp(1 - this.drunkSwingCooldownRemaining / this.drunkSwingCooldown, 0, 1),
        0
      ];
    }

    const attack1 = MathEx.clamp(1 - this.drinkCooldownRemaining / this.drinkCooldown, 0, 1);
    const attack2 = MathEx.clamp(
      1 - this.skill2CooldownRemaining / Math.max(0.001, this.skill2CooldownTotal),
      0,
      1
    );
    const chugReady = this.drunkMeter >= 5 || game?.hasFullCharge?.();
    const attack3 = chugReady
      ? MathEx.clamp(1 - this.chugCooldownRemaining / this.chugCooldown, 0, 1)
      : 0;
    return [attack1, attack2, attack3];
  }

  renderHud(ctx, x = 22, y = 22, options = {}) {
    const slotW = 22;
    const slotH = 28;
    const gap = 5;
    const pad = 7;
    const labelH = 15;
    const totalW = pad * 2 + this.drunkMeterMax * slotW + (this.drunkMeterMax - 1) * gap;
    const totalH = labelH + slotH + pad * 2;
    if (options.align === 'right') x -= totalW;
    const filled = this.drunkRemaining > 0 ? this.drunkMeterMax : this.drunkMeter;

    ctx.save();
    ctx.fillStyle = 'rgba(20,20,20,0.82)';
    ctx.fillRect(x, y, totalW, totalH);

    ctx.fillStyle = '#f2f2f2';
    ctx.font = '10px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('DRUNK', x + pad, y + 4);

    for (let i = 0; i < this.drunkMeterMax; i++) {
      const slotX = x + pad + i * (slotW + gap);
      const slotY = y + labelH + pad;

      ctx.strokeStyle = '#5f5f5f';
      ctx.lineWidth = 2;
      ctx.strokeRect(slotX, slotY, slotW, slotH);

      if (i >= filled) continue;

      if (this.imageReady(this.sprites.drunk)) {
        const maxW = slotW - 4;
        const maxH = slotH - 4;
        const scale = Math.min(
          maxW / this.sprites.drunk.naturalWidth,
          maxH / this.sprites.drunk.naturalHeight
        );
        const w = Math.max(1, Math.round(this.sprites.drunk.naturalWidth * scale));
        const h = Math.max(1, Math.round(this.sprites.drunk.naturalHeight * scale));
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          this.sprites.drunk,
          Math.round(slotX + (slotW - w) * 0.5),
          Math.round(slotY + (slotH - h) * 0.5),
          w,
          h
        );
      } else {
        ctx.fillStyle = '#f2f2f2';
        ctx.fillRect(slotX + 5, slotY + 6, slotW - 10, slotH - 12);
      }
    }

    ctx.restore();
  }

  render(ctx, { mount }) {
    const p = mount.position();
    let angle = mount.angle;

    if (this.pose === 'drink' || this.pose === 'chug') {
      angle += this.poseFacing >= 0 ? -0.82 : 0.82;
    } else if (this.pose === 'spill') {
      angle += this.poseFacing >= 0 ? 1.15 : -1.15;
    }

    const returnAlpha = this.gourdReturnRemaining > 0
      ? 1 - this.gourdReturnRemaining / this.gourdReturnDuration
      : 1;

    ctx.save();
    ctx.globalAlpha *= MathEx.clamp(returnAlpha, 0, 1);
    ctx.translate(Math.round(p.x), Math.round(p.y));

    const step = Math.PI / 24;
    ctx.rotate(Math.round(angle / step) * step);

    const facing = this.poseTime > 0 ? this.poseFacing : mount.dirX;
    if (facing < 0) ctx.scale(1, -1);

    ctx.imageSmoothingEnabled = false;

    if (this.imageReady(this.sprites.gourd)) {
      const desired = 82;
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
