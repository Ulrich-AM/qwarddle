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
    return {
      x:slot.actor.x + this.aimX * distance,
      y:slot.actor.y + this.aimY * distance
    };
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
