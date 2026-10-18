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

// Session 1 placeholder. This is deliberately a controller, not a special
// fighter type. Session 2 can replace it with GamepadController.
class IdleController extends FighterController {
  aimWorld(game, slot) {
    const opponent = game.getOpponentSlot(slot);
    const target = opponent?.activeBody?.() || opponent?.actor;
    return target
      ? { x:target.x, y:target.y - 6 }
      : super.aimWorld(game, slot);
  }
}
