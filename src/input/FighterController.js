'use strict';

// Controller contract used by Player and Game. Movement methods mirror the old
// KeyboardInput API so Player does not care where its commands come from.
class FighterController {
  axis() { return 0; }
  down() { return false; }
  consumePressed() { return false; }
  consumePrimary() { return false; }
  consumeAttack2() { return false; }
  consumeAttack3() { return false; }
  poll() {}
  connected() { return true; }

  aimWorld(game, slot) {
    const opponent = game.getOpponentSlot(slot);
    const target = opponent?.activeBody?.() || opponent?.actor;
    return target
      ? { x:target.x, y:target.y }
      : { x:slot.actor.x + slot.actor.facing * 160, y:slot.actor.y };
  }
}

class KeyboardMouseController extends FighterController {
  constructor({ keyboard, pointer }) {
    super();
    this.keyboard = keyboard;
    this.pointer = pointer;
  }

  axis(negativeAction, positiveAction) {
    return this.keyboard.axis(negativeAction, positiveAction);
  }

  down(action) {
    return this.keyboard.down(action);
  }

  consumePressed(action) {
    return this.keyboard.consumePressed(action);
  }

  consumePrimary() {
    return this.pointer.consumePressed(0);
  }

  consumeAttack2() {
    return this.keyboard.consumePressed('reload');
  }

  consumeAttack3() {
    return this.keyboard.consumePressed('special');
  }

  aimWorld(game) {
    return game.camera.screenToWorld(this.pointer.x, this.pointer.y);
  }

  resetAim(game, actor) {
    const screen = game.camera.worldToScreen(actor.x + actor.facing * 180, actor.y - 20);
    this.pointer.resetTo(screen.x, screen.y);
  }
}

class GamepadController extends FighterController {
  constructor(index = 0) {
    super();
    this.index = index;
    this.pad = null;
    this.buttons = [];
    this.previousButtons = [];
    this.pressed = new Set();
    this.moveX = 0;
    this.aimX = -1;
    this.aimY = 0;
    this.deadzone = 0.18;
  }

  resolvePad() {
    const pads = navigator.getGamepads?.() || [];
    const preferred = pads[this.index];
    if (preferred?.connected) return preferred;

    // P1 is keyboard/mouse, so using the first connected pad is a useful
    // fallback for local play and Parsec virtual controllers.
    for (const pad of pads) {
      if (pad?.connected) return pad;
    }
    return null;
  }

  buttonDown(index, threshold = 0.5) {
    const button = this.buttons[index];
    if (!button) return false;
    return button.pressed || button.value > threshold;
  }

  consumeButton(indices) {
    for (const index of indices) {
      if (this.pressed.has(index)) {
        this.pressed.delete(index);
        return true;
      }
    }
    return false;
  }

  applyDeadzone(value) {
    if (Math.abs(value) < this.deadzone) return 0;
    const sign = Math.sign(value);
    return sign * MathEx.clamp(
      (Math.abs(value) - this.deadzone) / (1 - this.deadzone),
      0,
      1
    );
  }

  poll() {
    this.pad = this.resolvePad();
    this.pressed.clear();

    if (!this.pad) {
      this.buttons = [];
      this.previousButtons = [];
      this.moveX = 0;
      return;
    }

    this.buttons = Array.from(this.pad.buttons || []);
    for (let i = 0; i < this.buttons.length; i++) {
      const down = this.buttons[i]?.pressed || (this.buttons[i]?.value || 0) > 0.5;
      const wasDown = !!this.previousButtons[i];
      if (down && !wasDown) this.pressed.add(i);
    }
    this.previousButtons = this.buttons.map((button) => {
      return !!button?.pressed || (button?.value || 0) > 0.5;
    });

    this.moveX = this.applyDeadzone(this.pad.axes?.[0] || 0);

    const rawAimX = this.applyDeadzone(this.pad.axes?.[2] || 0);
    const rawAimY = this.applyDeadzone(this.pad.axes?.[3] || 0);
    const aimLength = MathEx.hypot(rawAimX, rawAimY);

    if (aimLength > 0.05) {
      this.aimX = rawAimX / aimLength;
      this.aimY = rawAimY / aimLength;
    }
  }

  connected() {
    return !!this.pad?.connected || !!this.resolvePad();
  }

  axis(negativeAction, positiveAction) {
    if (negativeAction === 'left' && positiveAction === 'right') return this.moveX;
    return 0;
  }

  down(action) {
    if (!this.pad) return false;

    if (action === 'jump') return this.buttonDown(0); // A
    if (action === 'run') {
      return Math.abs(this.moveX) > 0.72 || this.buttonDown(10); // stick click
    }
    return false;
  }

  consumePressed(action) {
    if (action === 'jump') return this.consumeButton([0]);
    return false;
  }

  consumePrimary() {
    return this.consumeButton([7]); // RT
  }

  consumeAttack2() {
    return this.consumeButton([4, 2]); // LB or X
  }

  consumeAttack3() {
    return this.consumeButton([5, 3]); // RB or Y
  }

  aimWorld(game, slot) {
    const distance = 620;
    const body = slot.activeBody?.() || slot.actor;
    return {
      x:body.x + this.aimX * distance,
      y:body.y + this.aimY * distance
    };
  }
}

class NetworkController extends FighterController {
  constructor() {
    super();
    this.moveX = 0;
    this.jump = false;
    this.run = false;
    this.attack1 = false;
    this.attack2 = false;
    this.attack3 = false;
    this.aimX = 0.5;
    this.aimY = 0.5;
    this.pressed = new Set();
    this.lastSequence = -1;
  }

  applyRemoteInput(state = {}) {
    const sequence = Number.isFinite(state.seq) ? state.seq : this.lastSequence + 1;
    if (sequence <= this.lastSequence) return;
    this.lastSequence = sequence;

    const next1 = !!state.attack1;
    const next2 = !!state.attack2;
    const next3 = !!state.attack3;

    if (next1 && !this.attack1) this.pressed.add('attack1');
    if (next2 && !this.attack2) this.pressed.add('attack2');
    if (next3 && !this.attack3) this.pressed.add('attack3');

    this.attack1 = next1;
    this.attack2 = next2;
    this.attack3 = next3;
    this.jump = !!state.jump;
    this.run = !!state.run;
    this.moveX = MathEx.clamp(Number(state.moveX) || 0, -1, 1);
    this.aimX = MathEx.clamp(Number(state.aimX) || 0.5, 0, 1);
    this.aimY = MathEx.clamp(Number(state.aimY) || 0.5, 0, 1);
  }

  axis(negativeAction, positiveAction) {
    if (negativeAction === 'left' && positiveAction === 'right') return this.moveX;
    return 0;
  }

  down(action) {
    if (action === 'jump') return this.jump;
    if (action === 'run') return this.run;
    return false;
  }

  consumePrimary() {
    const value = this.pressed.has('attack1');
    this.pressed.delete('attack1');
    return value;
  }

  consumeAttack2() {
    const value = this.pressed.has('attack2');
    this.pressed.delete('attack2');
    return value;
  }

  consumeAttack3() {
    const value = this.pressed.has('attack3');
    this.pressed.delete('attack3');
    return value;
  }

  aimWorld(game) {
    return game.camera.screenToWorld(
      this.aimX * game.width,
      this.aimY * game.height
    );
  }
}

// SOLO placeholder until the CPU session. It uses the exact same fighter slot
// interface as GamepadController, so adding AI will not create another actor path.
class IdleController extends FighterController {
  aimWorld(game, slot) {
    const opponent = game.getOpponentSlot(slot);
    const target = opponent?.activeBody?.() || opponent?.actor;
    return target
      ? { x:target.x, y:target.y - 6 }
      : super.aimWorld(game, slot);
  }
}
