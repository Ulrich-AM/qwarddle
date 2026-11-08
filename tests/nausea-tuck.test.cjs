'use strict';

// Offline regression: node tests/nausea-tuck.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
const math = {clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),hypot:Math.hypot};
const fakeRagdoll = class {
  constructor({actor,bodyOnly}) {
    this.bodyOnly = bodyOnly;
    this.body = {x:actor.x,y:actor.y,vx:actor.vx,vy:actor.vy,av:0};
  }
};
const gameContext = vm.createContext({Math,MathEx:math,Ragdoll:fakeRagdoll});
for (const source of ['src/config.js','src/game/Game.js']) {
  vm.runInContext(read(source),gameContext,{filename:source});
}
const Game = vm.runInContext('Game',gameContext);
const cfg = vm.runInContext('DEFAULT_GAME_CONFIG',gameContext);
const game=Object.create(Game.prototype);
game.config=cfg;
game.terrain={};
const actor={
  x:100,y:200,vx:100,vy:0,facing:1,dead:false,onGround:true,
  activeBody:{release(){}},
  recoverPhysicalBodyFromRagdoll(body,scale){this.recoveryScale=scale}
};
const slot={
  actor,ragdoll:null,knockdown:null,attackRagdoll:null,
  defensiveRagdoll:null,defensiveDashCooldownRemaining:0
};
const right=game.tuckDashVelocity(actor,{x:500,y:200});
assert.ok(right.vx>cfg.defensiveTuckDashImpulse);
const up=game.tuckDashVelocity(actor,{x:100,y:-200});
assert.ok(up.vy < -850);
const capped=game.tuckDashVelocity(actor,{x:1000,y:-500},2000,-2000);
assert.ok(Math.hypot(capped.vx,capped.vy)<=cfg.defensiveTuckDashMaxSpeed+.01);
assert.equal(game.startDefensiveTuck(slot,{x:100,y:-200}),true);
assert.ok(slot.defensiveRagdoll.body.vy < -850);
game.finishDefensiveTuck(slot);
assert.equal(actor.recoveryScale,cfg.defensiveTuckRecoveryVelocity);
assert.equal(game.startDefensiveTuck(slot,{x:100,y:-200}),true);
assert.equal(slot.defensiveRagdoll.body.vy,actor.vy);
assert.equal(cfg.defensiveTuckDamageMultiplier,.60);

// Verify actual image deformation, no WebGL dependency.
let frameCalls=[];
const rendering = {
  save(){},restore(){},clearRect(){},translate(){},scale(){},
  rotate(rad){this.angle=rad},
  drawImage(...args){frameCalls.push(args)},
  set imageSmoothingEnabled(value){}
};
let raf=[];
const canvas={
  width:0,height:0,style:{display:'none'},
  getContext(type){assert.equal(type,'2d');return rendering}
};
const source={
  width:1280,height:720,
  getBoundingClientRect(){return {width:1280,height:720}}
};
const warpContext=vm.createContext({
  Math,MathEx:math,window:{devicePixelRatio:1},
  requestAnimationFrame(fn){raf.push(fn)},
  HTMLVideoElement:class {}
});
vm.runInContext(read('src/game/NauseaWarp.js'),warpContext);
const NauseaWarp=vm.runInContext('NauseaWarp',warpContext);
const warp=new NauseaWarp(source,canvas);
warp.setIntensity(.37,0);
assert.equal(raf.length,1);
raf.shift()(1350);
assert.equal(canvas.style.display,'block');
assert.ok(frameCalls.length > 60, 'full game image is resampled into bands');
assert.ok(frameCalls.some(args => args.length === 9 && args[5] !== -14),
  'the sample bands move the scene rather than drawing CSS lines');
assert.ok(Math.abs(rendering.angle)>0.001,'scene rotates subtly');
warp.setIntensity(0,0);
assert.equal(canvas.style.display,'none');
raf.shift()(1375);
assert.equal(warp.running,false);

// In a browser without Canvas2D support, existing color tint remains visible.
const missing=new NauseaWarp(source,{
  width:0,height:0,style:{},
  getContext(){return null}
});
assert.equal(missing.renderFrame(2),false);
assert.equal(missing.disabled,true);

// Check the LAN video is correctly aligned inside its letterbox.
class MockVideo {}
const video=new MockVideo();
Object.assign(video,{readyState:4,videoWidth:1280,videoHeight:720});
const lanScope=vm.createContext({
  Math,MathEx:math,window:{devicePixelRatio:1},
  requestAnimationFrame(){},
  HTMLVideoElement:MockVideo
});
vm.runInContext(read('src/game/NauseaWarp.js'),lanScope);
const LANWarp=vm.runInContext('NauseaWarp',lanScope);
const lanCanvas={
  width:0,height:0,style:{},
  parentElement:{getBoundingClientRect(){return {width:1000,height:500}}},
  getContext(){return rendering}
};
const bounds=new LANWarp(video,lanCanvas).sourceSize();
assert.ok(Math.abs(bounds.width - 888.8888889)<.01);
assert.ok(Math.abs(parseFloat(lanCanvas.style.left)-55.5555555)<.01);

// CPU-3: a new match uses test charge; ordinary respawn does not.
const cpuGame=Object.create(Game.prototype);
cpuGame.mode='cpu';
cpuGame.cpuScores=[0,0];
cpuGame.cpuStartCharge=0;
cpuGame.fighters=[0,1].map(index=>({
  index, actor:{x:100+index*200,y:900},
  controller:{resetAim(){}},
  activeBody(){return this.actor}
}));
cpuGame.terrain={worldWidth:7200};
cpuGame.projectiles={clear(){}};
cpuGame.hazards=[];
cpuGame.statusEmitters=[];
cpuGame.statusParticles=[];
cpuGame.camera={resetGroup(){}};
cpuGame.spawnFighter=function(slot) {slot.charge=0;slot.ragdoll=null};
cpuGame.setCpuStartCharge(100);
cpuGame.reset();
assert.equal(cpuGame.fighters[1].charge,100);
cpuGame.cpuScores[0]=2;
cpuGame.respawnFighter(cpuGame.fighters[1]);
assert.equal(cpuGame.fighters[1].charge,0);
assert.equal(cpuGame.cpuScores[0],2);
cpuGame.reset();
assert.equal(cpuGame.fighters[1].charge,100);
assert.equal(cpuGame.cpuScores[0],0);

console.log('Nausea scene wobble, RMB tuck and CPU-3 tests passed.');
