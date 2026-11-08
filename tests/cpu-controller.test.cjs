'use strict';

// Execute from the repository root: node tests/cpu-controller.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

const ctx = vm.createContext({
  Math,
  MathEx:{
    clamp:(n, a, b) => Math.max(a, Math.min(b, n)),
    hypot:Math.hypot
  },
  Image:class {constructor() {this.complete=true;this.naturalWidth=16;this.naturalHeight=16}}
});
function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, {filename:file});
}
load('src/input/FighterController.js');
load('src/input/CPUController.js');
load('src/combat/Projectile.js');
load('src/combat/Weapon.js');
load('src/combat/Mushroom.js');
load('src/game/Game.js');

const { CPUController, Mushroom, Game } = vm.runInContext(
  '({ CPUController, Mushroom, Game })', ctx
);

function setup({
  x=4300, targetX=3100, weapon='mushroom',
  charge=0, difficulty='normal', seed=900, controllable=true
} = {}) {
  const ai = new CPUController({difficulty, seed});
  const actor = {
    x, y:980, vx:0, vy:0, onGround:true, facing:-1,
    weaponMount:{weapon:{
      id:weapon, drunkMeter:6, attackReadiness:() => [1, 1, 1]
    }}
  };
  const slot = {
    actor, charge, maxCharge:100,
    gameView:{},
    canControl:() => controllable
  };
  const opponent = {
    actor:{x:targetX, y:980, vx:0, vy:0},
    activeBody() { return this.actor; },
    isDead() { return false; }
  };
  const terrain = {
    groundIntervals:[[500,6700]],
    hasGroundAt(x) {return x >= 500 && x <= 6700},
    clampGroundX(x, margin=0) {
      return Math.max(500+margin, Math.min(6700-margin,x));
    }
  };
  const game = {
    fighters:[slot,{actor:opponent.actor}],
    terrain, hazards:[], projectiles:{items:[]},
    getOpponentSlot() {return opponent}
  };
  ai.bind(game,slot);
  return {
    ai,actor,slot,opponent,game,
    tick(seconds=.75) {
      const actions=[];
      const frames=Math.ceil(seconds*120);
      for(let n=0;n<frames;n++) {
        ai.poll(1/120);
        for (const key of ['primary','attack2','attack3']) {
          if (ai.takeAction(key)) actions.push(key);
        }
      }
      return actions;
    }
  };
}

// CPU-0: contract, repeatability, reset and difficulty.
assert.ok(CPUController.profiles.hard.think < CPUController.profiles.easy.think);
const seededA=setup({seed:25});
const seededB=setup({seed:25});
seededA.tick();seededB.tick();
assert.deepEqual(seededA.ai.aimPoint,seededB.ai.aimPoint);
seededA.ai.reset();
assert.equal(seededA.ai.moveX,0);
assert.equal(seededA.ai.jumpTimer,0);

// CPU-1: pursuit, ledge safety, interrupted movement.
const chase=setup();
chase.tick();
assert.equal(chase.ai.state,'approach');
assert.equal(chase.ai.axis('left','right'),-1);
assert.ok(chase.ai.aimWorld().x < chase.actor.x);
chase.actor.x=6630;
chase.actor.vx=650;
assert.equal(chase.ai.safeMovement(1),-1);
chase.actor.x=470;
assert.equal(chase.ai.safeMovement(-1),1);
assert.equal(chase.ai.safeMovement(0),1); // Recover even after input stops.
const disabled=setup({controllable:false});
disabled.tick();
assert.equal(disabled.ai.moveX,0);
assert.equal(disabled.ai.consumePrimary(),false);

// CPU-2: awareness, cooldowns, Mushroom charge and actual spore effects.
const mushroom=setup({x:3500,targetX:3660,seed:8});
assert.ok(mushroom.tick(3).includes('primary'));
const charged=setup({x:3500,targetX:3800,seed:8,charge:100});
assert.ok(charged.tick(4).includes('attack3'));
const threatened=setup({x:3100,targetX:3900});
threatened.game.hazards.push({
  x:3140,y:1040,owner:threatened.opponent.actor,dead:false
});
threatened.tick();
assert.equal(threatened.ai.state,'evade');

const weapon=new Mushroom();
const projectiles={items:[],spawn(p) {this.items.push(p)}};
const player={
  x:0,y:0,facing:1,
  buffMultiplier() {return 1}
};
const mount={
  dirX:1,dirY:0,
  muzzle(){return {x:0,y:0}},
  position(){return {x:0,y:0}},
  applyRecoil(){}
};
weapon.primary({mount,projectiles,player,game:{gainCharge(){}}});
assert.equal(projectiles.items.length,4);
const recipient={
  dizzy:0,isInvulnerable(){return false},
  applyDizziness(n){this.dizzy=Math.max(this.dizzy,n)}
};
projectiles.items[0].onHit(recipient);
assert.equal(recipient.dizzy,1.2,
  'CPU with Mushroom can trigger the existing dizziness effect on a human');

// Game uses CPU only in the new mode. Existing solo/couch/LAN stay separate.
const fake={
  fighters:[
    {controller:null,actor:{input:null}},
    {controller:null,actor:{input:null}}
  ],
  cpuDifficulty:'normal',
  setFighterController:Game.prototype.setFighterController
};
Game.prototype.setMode.call(fake,'cpu');
assert.equal(fake.mode,'cpu');
assert.equal(fake.fighters[1].controller.constructor.name,'CPUController');
assert.equal(fake.fighters[1].actor.input,fake.fighters[1].controller);
Game.prototype.setMode.call(fake,'solo');
assert.equal(fake.fighters[1].controller.constructor.name,'IdleController');
console.log('CPU-0 to CPU-2 tests passed.');
