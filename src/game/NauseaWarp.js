'use strict';

// Canvas2D whole-scene nausea effect. Unlike a tint or a CSS pattern this
// resamples the rendered frame, so the actual fighter, arena and UI wobble.
// Works offline and without WebGL. Input and collision coordinates stay fixed.
class NauseaWarp {
  constructor(source, canvas) {
    this.source = source;
    this.canvas = canvas;
    this.context = null;
    this.disabled = !source || !canvas;
    this.running = false;
    this.dizzy = 0;
    this.purple = 0;
    this.lastFrame = -Infinity;
    this.frameInterval = 1000 / 40;
    this.tick = (now) => {
      if (this.dizzy <= 0 && this.purple <= 0) {
        this.running = false;
        if (this.canvas) this.canvas.style.display = 'none';
        return;
      }
      if (now - this.lastFrame >= this.frameInterval) {
        this.lastFrame = now;
        this.renderFrame(now * 0.001);
      }
      requestAnimationFrame(this.tick);
    };
  }

  setIntensity(dizzy = 0, purple = 0) {
    this.dizzy = MathEx.clamp(Number(dizzy) || 0, 0, 0.5);
    this.purple = MathEx.clamp(Number(purple) || 0, 0, 0.5);
    if (!this.dizzy && !this.purple && this.canvas) {
      this.canvas.style.display = 'none';
    }
    if (!this.disabled && !this.running && (this.dizzy > 0 || this.purple > 0)) {
      this.running = true;
      this.lastFrame = -Infinity;
      requestAnimationFrame(this.tick);
    }
  }

  sourceSize() {
    // Respect object-fit:contain for the remote LAN video.
    if (typeof HTMLVideoElement !== 'undefined' &&
        this.source instanceof HTMLVideoElement) {
      if (this.source.readyState < 2 ||
          !this.source.videoWidth || !this.source.videoHeight) return null;
      const parent = this.canvas.parentElement?.getBoundingClientRect?.();
      if (!parent || parent.width <= 0 || parent.height <= 0) return null;
      const scale = Math.min(parent.width / this.source.videoWidth,
        parent.height / this.source.videoHeight);
      const width = this.source.videoWidth * scale;
      const height = this.source.videoHeight * scale;
      this.canvas.style.left = (parent.width - width) * 0.5 + 'px';
      this.canvas.style.top = (parent.height - height) * 0.5 + 'px';
      this.canvas.style.width = width + 'px';
      this.canvas.style.height = height + 'px';
      return {
        width, height,
        sourceWidth:this.source.videoWidth,
        sourceHeight:this.source.videoHeight
      };
    }

    if (!this.source.width || !this.source.height) return null;
    const rect = this.source.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      width:rect.width, height:rect.height,
      sourceWidth:this.source.width,
      sourceHeight:this.source.height
    };
  }

  renderFrame(t) {
    if (this.disabled) return false;
    const bounds = this.sourceSize();
    if (!bounds) return false;
    if (!this.context) {
      try {
        this.context = this.canvas.getContext('2d', {alpha:false});
      } catch (_) { this.context = null; }
      if (!this.context) {
        this.disabled = true;
        this.canvas.style.display = 'none';
        return false;
      }
    }

    // Texture-size cap keeps this affordable on ordinary integrated GPUs.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const resolution = Math.min(1, 1440 / (Math.max(bounds.width, bounds.height) * dpr));
    const w = Math.max(1, Math.round(bounds.width * dpr * resolution));
    const h = Math.max(1, Math.round(bounds.height * dpr * resolution));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const ctx = this.context;
    const strength = MathEx.clamp(
      Math.max(this.dizzy / 0.37, this.purple / 0.38 * 0.9), 0, 1
    );
    if (strength <= 0) {
      this.canvas.style.display = 'none';
      return false;
    }

    const sw = bounds.sourceWidth;
    const sh = bounds.sourceHeight;
    // A slowly breathing zoom and gentle rotation make the whole world sway.
    // Moving horizontal sample bands introduce a smooth liquid warping motion.
    const zoom = 1.035 + (0.022 + this.purple * 0.025) *
      Math.sin(t * 2.25 + 0.4) * strength;
    const angle = (0.012 * Math.sin(t * 1.6) +
      0.006 * Math.sin(t * 2.75)) * strength;
    const swayX = Math.sin(t * 2.0) * 9 * strength;
    const swayY = Math.cos(t * 1.7) * 7 * strength;

    ctx.save();
    try {
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, w, h);
      ctx.translate(w * 0.5 + swayX, h * 0.5 + swayY);
      ctx.rotate(angle);
      ctx.scale(zoom, zoom);
      ctx.translate(-w * 0.5, -h * 0.5);

      // Base frame fills every pixel even when the bands shift.
      ctx.drawImage(this.source, 0, 0, sw, sh, -14, -14, w + 28, h + 28);

      // Re-sample into broad smooth strips instead of drawing decorative
      // lines. Each strip overlaps its neighbour by a pixel to hide seams.
      const band = 10;
      const wavePixels = (10 + this.purple * 11) * strength;
      const sourceStep = sh / h;
      for (let y = 0; y < h; y += band) {
        const dh = Math.min(band + 1, h - y);
        const mid = (y + dh * 0.5) / h;
        const offset = (
          Math.sin(mid * 12.0 + t * 2.6) +
          0.38 * Math.sin(mid * 19.0 - t * 1.9)
        ) * wavePixels;
        const sourceY = Math.max(0, Math.min(sh - 1,
          y * sourceStep + Math.sin(mid * 11.0 + t * 2.2) * 2.4 * strength
        ));
        const sourceH = Math.min(sh - sourceY, dh * sourceStep + 1);
        if (sourceH <= 0) continue;
        ctx.drawImage(
          this.source, 0, sourceY, sw, sourceH,
          -14 + offset, y, w + 28, dh
        );
      }
      this.canvas.style.display = 'block';
      return true;
    } catch (error) {
      console.warn('Nausea frame copy failed, using color tint instead:', error);
      this.disabled = true;
      this.canvas.style.display = 'none';
      return false;
    } finally {
      ctx.restore();
    }
  }
}
