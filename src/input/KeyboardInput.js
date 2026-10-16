'use strict';

class KeyboardInput {
  constructor(bindings = KeyboardInput.defaultBindings()) {
    this.bindings = bindings;
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();

    window.addEventListener('keydown', (event) => {
      if (!this.keys.has(event.code)) this.pressed.add(event.code);
      this.keys.add(event.code);
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code)) {
        event.preventDefault();
      }
    });

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
      this.released.add(event.code);
    });
  }

  static defaultBindings() {
    return {
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      jump: ['KeyW', 'ArrowUp', 'Space'],
      run: ['ShiftLeft', 'ShiftRight'],
      reload: ['KeyQ'],
      special: ['KeyE']
    };
  }

  codes(action) { return this.bindings[action] || []; }
  down(action) { return this.codes(action).some((code) => this.keys.has(code)); }
  axis(negativeAction, positiveAction) {
    return (this.down(positiveAction) ? 1 : 0) - (this.down(negativeAction) ? 1 : 0);
  }
  consumePressed(action) {
    for (const code of this.codes(action)) {
      if (this.pressed.has(code)) {
        this.pressed.delete(code);
        return true;
      }
    }
    return false;
  }
  consumeReleased(action) {
    for (const code of this.codes(action)) {
      if (this.released.has(code)) {
        this.released.delete(code);
        return true;
      }
    }
    return false;
  }
}
