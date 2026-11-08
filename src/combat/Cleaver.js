'use strict';

// Short-lived dark red body trail for the wind-up cleave.
class CleaverRushTrail {
  constructor({x0,y0,x1,y1}={}) {
    Object.assign(this,{x0,y0,x1,y1});
    this.age=0;this.duration=0.30;this.dead=false;
  }
  update(dt) {this.age+=dt;if(this.age>=this.duration)this.dead=true;}
  render(ctx) {
    ctx.save();
    ctx.globalAlpha*=0.45*Math.max(0,1-this.age/this.duration);
    ctx.strokeStyle='#4f1019';ctx.lineWidth=23;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(this.x0,this.y0);ctx.lineTo(this.x1,this.y1);ctx.stroke();
    ctx.strokeStyle='#a12a35';ctx.lineWidth=9;ctx.stroke();
    ctx.restore();
  }
}

// A stuck Cleaver follows a moving victim, or rests on the terrain. The
// owner must move close enough to recover it. Pulling it out wounds the victim.
class EmbeddedCleaver {
  constructor({owner,target=null,x,y,sprite,weapon,terrain}={}) {
    Object.assign(this,{owner,target,x,y,sprite,weapon,terrain});
    this.age=0;this.dead=false;this.tickTime=0;this.radius=72;
    this.offsetX=target ? -Math.sign(owner.x-target.x||1)*12 : 0;
    this.offsetY=target ? -9 : 0;
    this.angle=0.50;
  }
  update(dt,game) {
    if(this.dead)return;
    if(!this.owner || this.owner.dead ||
       this.owner.weaponMount?.weapon!==this.weapon) {
      this.dead=true;
      return;
    }
    this.age+=dt;
    if(this.target?.dead || this.target?.health<=0) {
      this.x=this.target.x+this.offsetX;
      this.y=this.target.y+this.offsetY;
      this.target=null;
    }
    if(this.target) {
      this.x=this.target.x+this.offsetX;
      this.y=this.target.y+this.offsetY;
      this.tickTime+=dt;
      while(this.tickTime>=1) {
        this.tickTime-=1;
        this.target.takeDamage?.(1);
        if(this.target.health<=0){this.target.dead=true;break;}
      }
    } else {
      // If the body that carried it dies, settle to the nearest floor.
      const floor=this.terrain?.groundYAt?.(this.x);
      if(Number.isFinite(floor)&&this.y>floor-20)this.y=floor-20;
    }

    if(!this.owner || this.owner.dead || !this.weapon)return;
    const dx=this.owner.x-this.x,dy=this.owner.y-this.y;
    if(MathEx.hypot(dx,dy)>this.radius)return;
    if(this.target && !this.target.dead) {
      this.target.applyHemorrhage?.(this.weapon.balance.hemorrhageDuration);
    }
    this.weapon.recoverThrown();
    this.dead=true;
  }
  render(ctx) {
    if(this.dead)return;
    ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.angle);
    ctx.imageSmoothingEnabled=false;
    if(this.sprite?.complete&&this.sprite.naturalWidth>0){
      const scale=73/Math.max(this.sprite.naturalWidth,this.sprite.naturalHeight);
      const w=this.sprite.naturalWidth*scale,h=this.sprite.naturalHeight*scale;
      ctx.drawImage(this.sprite,-w*.5,-h*.5,w,h);
    }else{
      ctx.fillStyle='#171719';ctx.fillRect(-25,-8,50,16);
      ctx.fillStyle='#c4cbd1';ctx.fillRect(-20,-5,40,10);
    }
    ctx.restore();
  }
}

class FlyingCleaver extends Projectile {
  constructor({sprite,weapon,game,owner,terrain,charge=0,...opts}={}) {
    super({...opts,owner});
    this.sprite=sprite;this.weapon=weapon;this.game=game;this.terrain=terrain;
    this.charge=charge;
    this.gravity=weapon.balance.throwGravity;
    this.spin=0;this.handlesTerrain=true;this.noPhysicalHit=false;
    this.hitRadius=22;
    this.placed=false;
  }
  lodge(target=null,x=this.x,y=this.y) {
    if(this.placed)return;
    this.placed=true;this.dead=true;
    this.game.addHazard?.(new EmbeddedCleaver({
      owner:this.owner,target,x,y,sprite:this.sprite,weapon:this.weapon,
      terrain:this.terrain
    }));
  }
  update(dt,{terrain}={}) {
    if(!this.owner || this.owner.dead ||
       this.owner.weaponMount?.weapon!==this.weapon){
      this.dead=true;
      return;
    }
    this.vy+=this.gravity*dt;
    super.update(dt);
    this.spin+=dt*12;
    const t=terrain||this.terrain;
    // The projectile has its own terrain handling so a grounded blade stays
    // retrievable rather than being deleted by generic projectile collision.
    if(t?.circleIntersectsSolid?.(this.x,this.y,this.hitRadius)){
      const floor=t.groundYAt?.(this.x);
      this.lodge(null,this.x,Number.isFinite(floor)?floor-18:this.y);
      return;
    }
    if(this.life<=0 ||
       this.y>(t?.waterY??Infinity)+50 ||
       this.x < -45 || this.x > (t?.worldWidth??Infinity)+45 ||
       this.y < -80 || this.y > (t?.worldHeight??Infinity)+45){
      // Keep thrown weapons recoverable even if they miss the arena.
      const groundX=t?.clampGroundX?.(this.x,95)??this.owner.x;
      const floor=t?.groundYAt?.(groundX);
      this.lodge(null,Number.isFinite(groundX)?groundX:this.owner.x,
        Number.isFinite(floor)?floor-18:this.owner.y);
    }
  }
  render(ctx) {
    ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.spin);
    ctx.imageSmoothingEnabled=false;
    if(this.sprite?.complete&&this.sprite.naturalWidth>0){
      const scale=76/Math.max(this.sprite.naturalWidth,this.sprite.naturalHeight);
      const w=this.sprite.naturalWidth*scale,h=this.sprite.naturalHeight*scale;
      ctx.drawImage(this.sprite,-w*.5,-h*.5,w,h);
    }else{
      ctx.fillStyle='#191919';ctx.fillRect(-30,-8,60,16);
      ctx.fillStyle='#b4bcc4';ctx.fillRect(-26,-5,52,10);
    }
    ctx.restore();
  }
}

class Cleaver extends Weapon {
  constructor(){
    super({id:'cleaver',name:'CLEAVER',damage:0,cooldown:0,knockback:0});
    this.balance=CombatBalance.cleaver;
    this.swingCooldown=0;this.swingRemaining=0;this.swingDuration=0.30;
    this.swingConnected=false;this.swingDirection=1;this.swingNumber=0;
    this.dashCooldown=0;this.windup=0;this.windupContext=null;
    this.throwCharging=false;this.throwCharge=0;this.throwContext=null;
    this.throwCooldown=0;this.disarmed=false;
    this.chargeRate=3.5;this.chargeOnHit=2;
    this.sprite=new Image();this.sprite.src='assets/sprites/cleaver/cleaver.png';
  }
  update(dt,{mount,player}={}){
    super.update(dt);
    this.swingCooldown=Math.max(0,this.swingCooldown-dt);
    this.dashCooldown=Math.max(0,this.dashCooldown-dt);
    this.throwCooldown=Math.max(0,this.throwCooldown-dt);
    if(this.swingRemaining>0){
      const old=this.swingRemaining;
      this.swingRemaining=Math.max(0,this.swingRemaining-dt);
      // The blade contacts once in the middle of a swing, not repeatedly
      // whenever the two fighters overlap.
      if(!this.swingConnected && old>=0.14 && this.swingRemaining<0.14){
        this.swingConnected=true;
        this.resolveSwing();
      }
    }
    if(this.windup>0){
      this.windup=Math.max(0,this.windup-dt);
      if(!this.windup)this.launchCleave();
    }
    if(this.throwCharging){
      this.throwCharge=Math.min(this.balance.throwMaxCharge,this.throwCharge+dt);
      const held=player?.input?.specialHeld?.()??false;
      if(!held)this.releaseThrow();
    }
  }
  primary({mount,player,game}){
    if(this.disarmed||this.windup>0||this.throwCharging||this.swingRemaining>0||
       this.swingCooldown>0||!player||!game)return false;
    this.swingDirection=this.swingNumber%2===0?1:-1;
    this.swingNumber++;
    this.swingRemaining=this.swingDuration;
    this.swingConnected=false;
    this.swingContext={mount,player,game};
    this.swingCooldown=this.balance.slashCooldown;
    mount.setAimOverride?.(mount.dirX,mount.dirY,0.13);
    return true;
  }
  resolveSwing(){
    const {mount,player,game}=this.swingContext||{};
    if(!mount||!player||!game)return;
    const reach=this.balance.slashRange;
    const origin=mount.position();
    let dx=mount.dirX,dy=mount.dirY;
    const length=MathEx.hypot(dx,dy)||1;dx/=length;dy/=length;
    const centerX=origin.x+dx*reach*.58;
    const centerY=origin.y+dy*reach*.58+this.swingDirection*11;
    for(const target of game.getTargetableActors?.()||[]){
      if(!target || target===player || target.dead || target.isInvulnerable?.())continue;
      const box=target.hitbox?.();
      if(!box)continue;
      const deltaX=box.x-centerX,deltaY=box.y-centerY;
      const hitDistance=MathEx.hypot(deltaX,deltaY);
      const side=deltaX*dx+deltaY*dy;
      if(hitDistance>reach*.76+Math.max(box.w,box.h)*.35 || side < -box.w*.4)continue;
      target.takeDamage(this.balance.slashDamage*player.buffMultiplier('damage'));
      if(Math.random()<this.balance.slashHemorrhageChance){
        target.applyHemorrhage?.(this.balance.hemorrhageDuration);
      }
      target.hitFlash=Math.max(target.hitFlash||0,0.13);
      if(target.health<=0)target.dead=true;
      game.gainCharge?.(this.chargeOnHit);
    }
  }
  reload({mount,player,game}){
    if(!player||!game||this.disarmed||this.windup>0||this.dashCooldown>0||
       this.throwCharging||this.swingRemaining>0)return false;
    this.windup=this.balance.dashWindup;
    this.windupContext={mount,player,game,dirX:mount.dirX,dirY:mount.dirY};
    mount.setAimOverride?.(mount.dirX,mount.dirY,this.windup);
    player.hand?.setPoseOverride?.(14,-30,this.windup);
    return true;
  }
  launchCleave(){
    const args=this.windupContext;
    this.windupContext=null;
    if(!args||args.player.dead||this.disarmed)return;
    const {mount,player,game,dirX,dirY}=args;
    const succeeded=game.startPlayerAttackRagdoll?.({
      weapon:this,dirX,dirY,
      duration:this.balance.dashDuration,
      speed:this.balance.dashSpeed,
      damage:this.balance.dashDamage,
      knockback:this.balance.dashKnockback,
      onHit:(target)=>target.applyHemorrhage?.(this.balance.hemorrhageDuration)
    });
    if(succeeded)this.dashCooldown=this.balance.dashCooldown;
  }
  spawnRushTrail(game,x0,y0,x1,y1){
    game.addHazard?.(new CleaverRushTrail({x0,y0,x1,y1}));
  }
  special({mount,player,game,projectiles}){
    if(!player||!game||!projectiles||this.disarmed||this.throwCharging||
       this.throwCooldown>0||this.windup>0||this.swingRemaining>0)return false;
    this.throwCharging=true;
    this.throwCharge=0;
    this.throwContext={mount,player,game,projectiles};
    return true;
  }
  releaseThrow(){
    if(!this.throwCharging)return false;
    this.throwCharging=false;
    const c=this.throwContext;this.throwContext=null;
    if(!c||c.player.dead)return false;
    const {mount,player,game,projectiles}=c;
    const t=MathEx.clamp(this.throwCharge/this.balance.throwMaxCharge,0,1);
    const speed=this.balance.throwBaseSpeed+t*this.balance.throwBonusSpeed;
    const damage=(this.balance.throwBaseDamage+t*this.balance.throwBonusDamage)*
      player.buffMultiplier('damage');
    const point=mount.muzzle(38);
    const blade=new FlyingCleaver({
      owner:player,weapon:this,game,terrain:game.terrain,
      sprite:this.sprite,charge:t,
      x:point.x,y:point.y,vx:mount.dirX*speed,vy:mount.dirY*speed-60,
      damage,knockback:165,life:4.6,
      width:52,height:24,outlineColor:'#242424',
      onHit:(target)=>blade.lodge(target)
    });
    projectiles.spawn(blade);
    this.disarmed=true;
    this.throwCooldown=0.45;
    this.throwCharge=0;
    return true;
  }
  recoverThrown(){
    this.disarmed=false;
    this.throwCharging=false;this.throwCharge=0;this.throwContext=null;
  }
  attackReadiness(){
    const b=this.balance;
    return [
      this.disarmed||this.windup||this.throwCharging?0:
        MathEx.clamp(1-this.swingCooldown/b.slashCooldown,0,1),
      this.disarmed||this.windup||this.throwCharging?0:
        MathEx.clamp(1-this.dashCooldown/b.dashCooldown,0,1),
      this.disarmed?0:this.throwCharging?
        MathEx.clamp(this.throwCharge/b.throwMaxCharge,0,1):
        MathEx.clamp(1-this.throwCooldown/.45,0,1)
    ];
  }
  render(ctx,{mount}){
    if(this.disarmed)return;
    const p=mount.position();
    const progress=this.swingRemaining>0?1-this.swingRemaining/this.swingDuration:0;
    const swingAngle=this.swingRemaining>0?
      this.swingDirection*Math.sin(progress*Math.PI)*1.35:0;
    const winding=this.windup>0? -0.55*Math.sin((1-this.windup/this.balance.dashWindup)*Math.PI):0;
    ctx.save();ctx.translate(p.x,p.y);
    // Cleaver sprite points to the right, with its brown handle near the
    // left edge. Pivot around that handle instead of rotating it like a dagger.
    ctx.rotate(mount.angle+swingAngle+winding);
    ctx.imageSmoothingEnabled=false;
    if(this.sprite.complete&&this.sprite.naturalWidth>0){
      const scale=82/Math.max(this.sprite.naturalWidth,this.sprite.naturalHeight);
      const w=this.sprite.naturalWidth*scale,h=this.sprite.naturalHeight*scale;
      ctx.drawImage(this.sprite,-w*.20,-h*.74,w,h);
    }else{
      ctx.fillStyle='#171717';ctx.fillRect(-8,-70,16,70);
      ctx.fillStyle='#cbd0d4';ctx.fillRect(-11,-67,22,48);
    }
    ctx.restore();
  }
  renderRagdoll(ctx,ragdoll,data){
    if(!ragdoll||!data)return;
    ctx.save();ctx.translate(ragdoll.hand.x,ragdoll.hand.y);
    ctx.rotate(Math.atan2(data.aimDirY,data.aimDirX));
    ctx.imageSmoothingEnabled=false;
    if(this.sprite.complete&&this.sprite.naturalWidth>0){
      const scale=82/Math.max(this.sprite.naturalWidth,this.sprite.naturalHeight);
      const w=this.sprite.naturalWidth*scale,h=this.sprite.naturalHeight*scale;
      ctx.drawImage(this.sprite,-w*.20,-h*.74,w,h);
    }
    ctx.restore();
  }
}
