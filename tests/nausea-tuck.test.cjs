'use strict';

// Run with: node tests/nausea-tuck.test.cjs
// Uses mocks because the full game is browser based.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const math = { hypot:Math.hypot, clamp:(n, min, max) => Math.max(min, Math.min(max, n)) };

const ctx = vm.createContext({
  Math, MathEx:math, console, requestAnimationFrame:() => {},
  Ragdoll:class {
    constructor({actor,bodyOnly}) {
      this.bodyOnly = bodyOnly;
      this.body = { x:actor.x, y:actor.y, vx:actor.vx, vy:actor.vy, av:0 };
    }
  }
});
vm.runInContext(read('src/config.js'), ctx);
vm.runInContext(read('src/game/Game.js'), ctx);
const { Game, DEFAULT_GAME_CONFIG } = vm.runInContext(
  '({ Game, DEFAULT_GAME_CONFIG })', ctx
);

const game = Object.create(Game.prototype);
game.config = DEFAULT_GAME_CONFIG;
game.terrain = {};
const actor = {
  x:100,y:200,vx:130,vy:-40,facing:1,dead:false,onGround:true,
  activeBody:{release() {this.released=true}},
  recoverPhysicalBodyFromRagdoll(ragdoll, scale) {
    this.recovered = { ragdoll, scale };
  }
};
const slot = {
  actor,ragdoll:null,knockdown:null,attackRagdoll:null,
  defensiveRagdoll:null,defensiveDashCooldownRemaining:0
};

const right = game.tuckDashVelocity(actor,{x:500,y:200});
assert.ok(right.vx > 900 && right.vy < 0);
const upward = game.tuckDashVelocity(actor,{x:100,y:-200});
assert.ok(upward.vy < -900);
const fallback = game.tuckDashVelocity(actor,{x:100,y:200});
assert.ok(Number.isFinite(fallback.vx) && fallback.vx > 0);
const fast = game.tuckDashVelocity(actor,{x:900,y:100},2000,-1800);
assert.ok(Math.hypot(fast.vx,fast.vy) <= game.config.defensiveTuckDashMaxSpeed + .001);

assert.equal(game.startDefensiveTuck(slot,{x:100,y:-200}),true);
const first = slot.defensiveRagdoll;
assert.equal(first.bodyOnly,true);
assert.ok(first.body.vy < -900);
assert.equal(actor.defensiveTuck,true);
assert.equal(actor.defensivePhysicsBody,first.body);
assert.equal(slot.defensiveDashCooldownRemaining,game.config.defensiveTuckDashCooldown);
game.finishDefensiveTuck(slot);
assert.equal(slot.defensiveRagdoll,null);
assert.equal(actor.defensiveTuck,false);
assert.equal(actor.recovered.scale,game.config.defensiveTuckRecoveryVelocity);
assert.equal(game.config.defensiveTuckDamageMultiplier,.60);

assert.equal(game.startDefensiveTuck(slot,{x:100,y:-200}),true);
assert.equal(slot.defensiveRagdoll.body.vy,actor.vy,
  'Second RMB tuck may defend, but cannot dash during cooldown');

// Separate GPU renderer tests use a WebGL mock, without native dependencies.
const events = {};
const gl = {
  VERTEX_SHADER:1, FRAGMENT_SHADER:2, COMPILE_STATUS:3, LINK_STATUS:4,
  ARRAY_BUFFER:5, STATIC_DRAW:6, FLOAT:7, TEXTURE0:8, TEXTURE_2D:9,
  TEXTURE_WRAP_S:10, TEXTURE_WRAP_T:11, CLAMP_TO_EDGE:12,
  TEXTURE_MIN_FILTER:13, TEXTURE_MAG_FILTER:14, NEAREST:15,
  UNPACK_FLIP_Y_WEBGL:16, RGBA:17, UNSIGNED_BYTE:18, TRIANGLES:19,
  createShader() {return {}},
  shaderSource(shader,source) {this.shaders.push(source)},
  shaders:[],
  compileShader() {},
  getShaderParameter() {return true},
  createProgram() {return {}},
  attachShader() {},
  linkProgram() {},
  deleteShader() {},
  getProgramParameter() {return true},
  createBuffer() {return {}},
  bindBuffer() {},
  bufferData() {},
  useProgram() {},
  getAttribLocation() {return 0},
  enableVertexAttribArray() {},
  vertexAttribPointer() {},
  createTexture() {return {}},
  activeTexture() {},
  bindTexture() {},
  texParameteri() {},
  pixelStorei() {},
  getUniformLocation(program,name) {return name},
  uniform1i() {},
  uniform2f() {},
  uniform1f() {},
  viewport() {},
  texImage2D(type,level,internal,format,pixelType,source) {
    this.upload = source;
  },
  drawArrays() {this.draws=(this.draws || 0) + 1}
};
const canvas = {
  width:0,height:0,style:{display:'none'},
  addEventListener(name,callback) {events[name] = callback},
  getContext() {return gl}
};
const source = {
  width:1200,height:720,
  getBoundingClientRect() {return {width:1200,height:720}}
};
const raf=[];
class HTMLVideoElement {}
let copies = 0;
const fakeDocument = {
  createElement(type) {
    assert.equal(type,'canvas');
    return {
      width:0,height:0,
      getContext() {
        return {drawImage() {copies++},imageSmoothingEnabled:false};
      }
    };
  }
};
const shaderScope=vm.createContext({
  Math, MathEx:math, console, window:{devicePixelRatio:1},
  document:fakeDocument, HTMLVideoElement,
  requestAnimationFrame(fn){raf.push(fn)}
});
vm.runInContext(read('src/game/NauseaWarp.js'),shaderScope);
const NauseaWarp=vm.runInContext('NauseaWarp',shaderScope);
const warp=new NauseaWarp(source,canvas);
warp.setIntensity(.32,0);
assert.equal(raf.length,1);
raf.shift()(1000);
assert.equal(gl.draws,1);
assert.equal(gl.upload,source);
assert.equal(canvas.style.display,'block');
assert.ok(gl.shaders.some(fragment => fragment.includes('sin(warped.y * 17.0') &&
  fragment.includes('sin(warped.x * 13.0')));
warp.setIntensity(0,0);
assert.equal(canvas.style.display,'none');
raf.shift()(1016);
assert.equal(warp.running,false);

// The same shader supports purple and falls back if WebGL is unavailable.
warp.setIntensity(.2,.38);
raf.shift()(1032);
assert.equal(gl.draws,2);
const brokenCanvas={
  style:{display:'none'},addEventListener() {},
  getContext(){return null}
};
const broken=new NauseaWarp(source,brokenCanvas);
assert.equal(broken.renderFrame(0),false);
assert.equal(broken.disabled,true);
assert.equal(brokenCanvas.style.display,'none');

// A high-DPI Canvas source is downsampled before WebGL upload.
const bigSource={
  width:3200,height:1800,
  getBoundingClientRect(){return {width:1280,height:720}}
};
const large=new NauseaWarp(bigSource,{
  ...canvas,width:0,height:0,style:{display:'none'}
});
large.setIntensity(.37,0);
raf.shift()(1100); // previous active loop; may also schedule the new one
assert.ok(large.renderFrame(2));
assert.ok(copies>0);
assert.notEqual(gl.upload,bigSource,'GPU upload uses the smaller canvas buffer');

// LAN object-fit:contain respects letterboxing.
const video=new HTMLVideoElement();
Object.assign(video,{
  readyState:4,videoWidth:1280,videoHeight:720
});
const lanCanvas={
  width:0,height:0,style:{},addEventListener(){},
  parentElement:{getBoundingClientRect(){return {width:1000,height:500}}}
};
const lan=new NauseaWarp(video,lanCanvas);
const bounds=lan.sourceSize();
assert.ok(Math.abs(bounds.height - 500)<.01);
assert.ok(Math.abs(bounds.width - 888.8888889)<.01);
assert.ok(Math.abs(parseFloat(lanCanvas.style.left) - 55.55555)<.01);

console.log('Nausea shader and tuck dash tests passed.');
