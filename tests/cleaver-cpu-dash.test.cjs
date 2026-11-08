'use strict';

// Offline test: node tests/cleaver-cpu-dash.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const math={
  hypot:Math.hypot,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  lerp:(a,b,t)=>a+(b-a)*t,
  expLerp:(a,b,k,dt)=>b+(a-b)*Math.exp(-k*dt)
};
class FakeImage {constructor(){this.complete=true;this.naturalWidth=24;this.naturalHeight=24}}
const context=vm.createContext({Math,MathEx:math,Image:FakeImage,console});
const load=(file)=>vm.runInContext(
  fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file}
);
for(const file of [
  'src/combat/Balance.js','src/combat/Projectile.js','src/combat/ProjectileSystem.js',
  'src/combat/Weapon.js','src/combat/Cleaver.js','src/input/FighterController.js',
  'src/input/CPUController.js'
])load(file);
const {Cleaver,CombatBalance,ProjectileSystem,CPUController}=
  vm.runInContext('({Cleaver,CombatBalance,ProjectileSystem,CPUController})',context);
vm.runInContext(
  'class ProceduralLeg{} class ActiveBodySupport{} class FloatingHand{} '+
  'class ProceduralArm{} class WeaponMount{}',
  context
);
load('src/player/Player.js');
const Player=vm.runInContext('Player',context);
const victim=Object.create(Player.prototype);
Object.assign(victim,{
  x:85,y:0,health:100,maxHealth:100,dead:false,
  hitFlash:0,tempHealth:0,hemorrhageTime:0,defensiveTuck:false,
  cfg:{defensiveTuckDamageMultiplier:.6,bodyW:58,bodyH:58},
  buffs:new Map(),isInvulnerable(){return false},
  stunTime:0,purpleSporesTime:0,dizzyTime:0,dizzyInvertTime:0,
  dizzyInvertCountdown:0,bleedTime:0,bleedDps:0
});
victim.applyHemorrhage(5);
victim.takeDamage(10);
assert.equal(victim.health,88);
victim.applyHemorrhage(5);
victim.takeDamage(10);
assert.equal(victim.health,76,'20% vulnerability does not stack');
victim.updateStatusEffects(1);
assert.equal(victim.health,75,'Hemorrhage removes 1 HP per second');
victim.updateStatusEffects(5);
assert.equal(victim.health,71,'Hemorrhage expires after five seconds');
victim.takeDamage(10);
assert.equal(victim.health,61,'normal damage returns after expiry');

const owner={x:0,y:0,health:100,dead:false,buffMultiplier(){return 1},
  hand:{setPoseOverride(){}},input:{specialHeld:()=>true}};
const weapon=new Cleaver();owner.weaponMount={weapon};
const mount={
  angle:0,dirX:1,dirY:0,
  position(){return {x:5,y:0}},
  muzzle(){return {x:5,y:0}},
  setAimOverride(){},applyRecoil(){}
};
const hazards=[],projectiles=[];
let ragdollOptions=null;
const terrain={
  worldWidth:7200,worldHeight:1700,waterY:1270,
  groundYAt(){return 1050},
  clampGroundX(x){return Math.max(500,Math.min(6700,x))},
  circleIntersectsSolid(){return false}
};
const game={
  terrain,getTargetableActors(){return [victim]},
  addHazard(h){hazards.push(h);return h},
  startPlayerAttackRagdoll(args){ragdollOptions=args;return true},
  gainCharge(){}
};
const tick=(seconds)=>{for(let i=0;i<Math.ceil(seconds*100);i++){
  weapon.update(1/100,{mount,player:owner});
}};

assert.equal(weapon.primary({mount,player:owner,game}),true);
tick(.31);
assert.equal(victim.health,48,'first swing hits once');
assert.equal(weapon.primary({mount,player:owner,game}),false);
tick(.27);
assert.equal(weapon.primary({mount,player:owner,game}),true);
assert.equal(weapon.swingDirection,-1);
tick(.31);
assert.equal(victim.health,35,'second swing alternates and hits');
tick(.30);
assert.equal(weapon.reload({mount,player:owner,game}),true);
tick(.71);
assert.ok(ragdollOptions && ragdollOptions.damage===CombatBalance.cleaver.dashDamage);
ragdollOptions.onHit(victim);
assert.equal(victim.hemorrhageTime,5,'Q has guaranteed Hemorrhage');

const projectilesSystem={spawn(p){projectiles.push(p);return p}};
assert.equal(weapon.special({mount,player:owner,game,projectiles:projectilesSystem}),true);
tick(1.2);
assert.equal(weapon.throwCharge,CombatBalance.cleaver.throwMaxCharge);
owner.input.specialHeld=()=>false;
tick(.01);
assert.equal(projectiles.length,1);
assert.equal(weapon.disarmed,true);
assert.equal(projectiles[0].damage,20);
assert.equal(weapon.primary({mount,player:owner,game}),false,'disarmed fighter cannot swing');
projectiles[0].onHit(victim);
assert.equal(hazards.length,1);
victim.x=115;
owner.x=-650;
const embedded=hazards[0];
embedded.update(2.1,game);
assert.equal(embedded.x,127,'embedded blade follows opponent');
assert.equal(victim.health,33,'lodged Cleaver causes 1 HP/s');
owner.x=embedded.x;
embedded.update(.01,game);
assert.equal(weapon.disarmed,false,'approaching the blade retrieves it');
assert.equal(embedded.dead,true,'recovered blade is removed');
assert.equal(victim.hemorrhageTime,5,'pulling it out inflicts hemorrhage');

const second=new Cleaver();
const outOfBounds={
  ...terrain,worldWidth:7200,worldHeight:1700,
  circleIntersectsSolid(){return false}
};
const terrainGame={
  terrain:outOfBounds,
  addHazard(h){this.last=h}
};
const projectile=vm.runInContext(
  'FlyingCleaver',context
);
const shot=new projectile({
  weapon:second,owner,game:terrainGame,terrain:outOfBounds,
  x:7240,y:50,vx:1000,vy:0,damage:10,life:2
});
shot.update(.04,{terrain:outOfBounds});
assert.equal(shot.dead,true,'world-edge throw creates retrievable pickup');
assert.ok(terrainGame.last,'out-of-bounds pickup is created');

const dashing=new CPUController({difficulty:'hard',seed:4});
const cpuActor={x:3500,y:980,vx:0,vy:0,onGround:true,facing:1,
  weaponMount:{weapon:{id:'cleaver',attackReadiness:()=>[1,1,1]}}};
const slot={actor:cpuActor,charge:0,maxCharge:100,
  defensiveDashCooldownRemaining:0,canControl(){return true}};
const enemy={actor:{x:3900,y:980,vx:0,vy:0},
  activeBody(){return this.actor},isDead(){return false}};
const cpuGame={
  terrain:{
    groundIntervals:[[500,6700]],
    hasGroundAt(x){return x>=500&&x<=6700},
    clampGroundX(x){return Math.max(500,Math.min(6700,x))}
  },
  hazards:[],
  projectiles:{items:[{x:3660,y:980,vx:-490,vy:0,owner:enemy.actor}]},
  getOpponentSlot(){return enemy}
};
dashing.bind(cpuGame,slot);
let dashed=false;
for(let i=0;i<240;i++){
  dashing.poll(1/120);
  if(dashing.defenseHeld()){dashed=true;break;}
}
assert.equal(dashed,true,'CPU chooses tactical tuck dash to evade projectile');
const edgeCPU=new CPUController({difficulty:'hard',seed:4});
cpuActor.x=6460;
edgeCPU.bind(cpuGame,slot);
assert.equal(edgeCPU.canDashToward(1),false,'CPU will not dash over shoreline');
console.log('Cleaver, Hemorrhage and CPU dash tests passed.');
