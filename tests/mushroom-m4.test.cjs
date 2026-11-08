'use strict';

// Run from the repository root: node tests/mushroom-m4.test.cjs
// No browser, third-party packages or network connection required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({
  Math,
  MathEx:{
    clamp:(value, min, max) => Math.max(min, Math.min(max, value)),
    hypot:Math.hypot
  },
  Image:class {
    constructor() {
      this.complete = true;
      this.naturalWidth = 16;
      this.naturalHeight = 16;
    }
  }
});

for (const file of [
  'src/combat/Projectile.js',
  'src/combat/Weapon.js',
  'src/combat/Mushroom.js'
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {
    filename:file
  });
}
const { Mushroom, PurpleMushroom } = vm.runInContext(
  '({ Mushroom, PurpleMushroom })', context
);

function actor(x, y) {
  return {
    x, y, health:100, dead:false, hitFlash:0,
    dizziness:0, purple:0, isInvulnerable:() => false,
    buffMultiplier:() => 1,
    hitbox() { return { x:this.x, y:this.y, w:58, h:58 }; },
    takeDamage(n) { this.health -= n; },
    applyDizziness(n) { this.dizziness = Math.max(this.dizziness, n); },
    applyPurpleSpores(n) { this.purple = Math.max(this.purple, n); }
  };
}

const owner = actor(-600, 110);
const enemy = actor(900, 110);
const projectiles = { items:[], spawn(item) { this.items.push(item); } };
const game = {
  hazards:[],
  projectiles,
  getHazardActors:() => [owner, enemy]
};
let charge = 99;
const weaponView = {
  game,
  hasFullCharge:() => charge >= 100,
  consumeFullCharge() {
    if (charge < 100) return false;
    charge = 0;
    return true;
  },
  addHazard(hazard) { game.hazards.push(hazard); }
};
const mount = {
  dirX:1, dirY:0, angle:0,
  muzzle:() => ({ x:0, y:0 }),
  applyRecoil() {}
};
const weapon = new Mushroom();
const params = { mount, player:owner, projectiles, game:weaponView };

assert.equal(weapon.special(params), false, 'E requires full charge');
charge = 100;
assert.equal(weapon.special(params), true, 'E fires at full charge');
assert.equal(charge, 0, 'E consumes full charge');
assert.equal(projectiles.items.length, 4, 'E launches four seeds');
assert.equal(weapon.special(params), false, 'E cannot be used twice');

const terrain = {
  rectangles:[{ x:-2000, y:170, w:4000, h:1000 }],
  circleIntersectsSolid:(x, y, radius) => y + radius >= 170
};
for (let step = 0; step < 600; step++) {
  for (const spore of projectiles.items.slice()) {
    if (!spore.dead) spore.update(1 / 120, { terrain });
  }
}
assert.equal(game.hazards.length, 4, 'all seeds plant');
assert.ok(game.hazards.every(h => h instanceof PurpleMushroom));

for (const h of game.hazards) {
  h.update(.39, { getHazardActors:() => [owner] });
}
enemy.x = game.hazards[0].x;
enemy.y = game.hazards[0].y - 54;

const nearby = game.hazards.filter(
  h => h.inArea(enemy, h.burstWidth, h.burstHeight)
).length;
const expected = Math.min(34, 18 + (nearby - 1) * 5);
game.hazards[0].update(.02, game);

assert.ok(game.hazards.every(h => h.dead), 'all purple mushrooms burst together');
assert.equal(enemy.health, 100 - expected, 'damage applies only once');
assert.equal(enemy.dizziness, .72, 'brief dizziness applied');
assert.equal(enemy.purple, 1.4, 'purple vignette applied');
assert.equal(owner.health, 100, 'owner is immune');
assert.equal(projectiles.items.filter(p => p.nonCombat && !p.dead).length, 56,
  'all four mushrooms emit visual spores');
for (const hazard of game.hazards) hazard.update(.1, game);
assert.equal(enemy.health, 100 - expected, 'expired mines cannot damage again');

const invulnerable = actor(40, 110);
invulnerable.isInvulnerable = () => true;
const protectedMine = new PurpleMushroom({
  x:40, y:170, owner, sprite:null
});
protectedMine.update(.5, {
  hazards:[protectedMine],
  projectiles,
  getHazardActors:() => [invulnerable]
});
assert.equal(protectedMine.dead, false, 'protected target does not trigger');

console.log('Mushroom M4 tests passed.');
