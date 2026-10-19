'use strict';

class MapSelectionScreen {
  constructor({ root, items, onContinue }) {
    this.root = root;
    this.items = items;
    this.onContinue = onContinue;
    this.selectedMapId = MapRegistry.list[0]?.id || null;

    this.render();
    document.getElementById('mapContinueBtn').addEventListener('click', () => {
      this.onContinue?.(this.selectedMapId);
    });
  }

  render() {
    this.items.innerHTML = '';

    for (const map of MapRegistry.list) {
      const button = document.createElement('button');
      button.className = `mapCard ${this.selectedMapId === map.id ? 'selected' : ''}`;
      button.type = 'button';

      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 140;
      canvas.className = 'mapThumb';
      this.drawThumbnail(canvas, map);

      const name = document.createElement('div');
      name.className = 'mapName';
      name.textContent = map.name;

      button.append(canvas, name);
      button.addEventListener('click', () => {
        this.selectedMapId = map.id;
        this.render();
      });

      this.items.appendChild(button);
    }
  }

  drawThumbnail(canvas, map) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = map.background || '#242a30';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sx = canvas.width / map.width;
    const sy = canvas.height / map.height;
    const scale = Math.min(sx, sy);
    const ox = (canvas.width - map.width * scale) * 0.5;
    const oy = (canvas.height - map.height * scale) * 0.5;

    if (Number.isFinite(map.waterY)) {
      ctx.fillStyle = '#526d7a';
      ctx.fillRect(0, Math.round(oy + map.waterY * scale), canvas.width, canvas.height);
    }

    const outline = Math.max(2, Math.round((map.outlineSize || 8) * scale));
    ctx.fillStyle = map.outlineColor || '#202020';
    for (const rect of map.rectangles) {
      ctx.fillRect(
        Math.round(ox + rect.x * scale) - outline,
        Math.round(oy + rect.y * scale) - outline,
        Math.round(rect.w * scale) + outline * 2,
        Math.round(rect.h * scale) + outline * 2
      );
    }

    for (const rect of map.rectangles) {
      ctx.fillStyle = rect.color || map.groundColor || '#596057';
      ctx.fillRect(
        Math.round(ox + rect.x * scale),
        Math.round(oy + rect.y * scale),
        Math.max(1, Math.round(rect.w * scale)),
        Math.max(1, Math.round(rect.h * scale))
      );
    }
  }
}
