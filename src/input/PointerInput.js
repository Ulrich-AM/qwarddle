'use strict';

class PointerInput {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.initialized = false;
    this.buttons = new Set();
    this.pressed = new Set();
    this.released = new Set();

    const update = (event) => {
      const rect = canvas.getBoundingClientRect();
      this.x = event.clientX - rect.left;
      this.y = event.clientY - rect.top;
      this.initialized = true;
    };

    canvas.addEventListener('mousemove', update);
    canvas.addEventListener('mouseenter', update);
    canvas.addEventListener('mousedown', (event) => {
      update(event);
      if (!this.buttons.has(event.button)) this.pressed.add(event.button);
      this.buttons.add(event.button);
    });
    window.addEventListener('mouseup', (event) => {
      this.buttons.delete(event.button);
      this.released.add(event.button);
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  down(button = 0) { return this.buttons.has(button); }
  consumePressed(button = 0) {
    const value = this.pressed.has(button);
    this.pressed.delete(button);
    return value;
  }
  consumeReleased(button = 0) {
    const value = this.released.has(button);
    this.released.delete(button);
    return value;
  }

  resetTo(x, y) {
    if (!this.initialized) {
      this.x = x;
      this.y = y;
    }
  }
}
