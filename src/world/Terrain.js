'use strict';

class Terrain {
  constructor(map = MapRegistry.list[0]) {
    this.viewWidth = 1280;
    this.viewHeight = 720;
    this.map = null;
    this.worldWidth = 2200;
    this.worldHeight = 980;
    this.height = this.worldHeight;
    this.waterY = 760;
    this.islandLeft = 0;
    this.islandRight = this.worldWidth;
    this.groundIntervals = [];
    this.raster = null;
    this.setMap(map);
  }

  setMap(map) {
    this.map = map || MapRegistry.list[0];
    this.worldWidth = Math.max(320, Math.round(this.map.width || 2200));
    this.worldHeight = Math.max(240, Math.round(this.map.height || 980));
    this.height = this.worldHeight;
    this.waterY = Number.isFinite(this.map.waterY) ? this.map.waterY : this.worldHeight + 200;
    this.rectangles = (this.map.rectangles || []).map((rect) => ({
      x:Math.round(rect.x || 0),
      y:Math.round(rect.y || 0),
      w:Math.max(1, Math.round(rect.w || 1)),
      h:Math.max(1, Math.round(rect.h || 1)),
      material:String(rect.material || 'default'),
      color:typeof rect.color === 'string' ? rect.color : null
    }));

    if (this.rectangles.length) {
      this.islandLeft = Math.min(...this.rectangles.map((rect) => rect.x));
      this.islandRight = Math.max(...this.rectangles.map((rect) => rect.x + rect.w));
    } else {
      this.islandLeft = 0;
      this.islandRight = this.worldWidth;
    }

    this.rebuildGroundIntervals();
    this.rebuildRaster();
  }

  resize(width, height) {
    this.viewWidth = width;
    this.viewHeight = height;
  }

  spawn(index = 0) {
    const spawn = this.map?.spawns?.[index] || this.map?.spawns?.[0];
    if (spawn) return { x:spawn.x, y:spawn.y };
    return { x:this.worldWidth * (index ? 0.7 : 0.3), y:this.worldHeight * 0.5 };
  }

  rebuildGroundIntervals() {
    const intervals = this.rectangles
      .map((rect) => [rect.x, rect.x + rect.w])
      .sort((a,b) => a[0] - b[0]);

    this.groundIntervals = [];
    for (const interval of intervals) {
      const previous = this.groundIntervals[this.groundIntervals.length - 1];
      if (!previous || interval[0] > previous[1]) {
        this.groundIntervals.push(interval.slice());
      } else {
        previous[1] = Math.max(previous[1], interval[1]);
      }
    }
  }

  rebuildRaster() {
    // Rectangle maps are tiny in primitive count. Drawing them directly avoids
    // allocating a huge offscreen canvas now that arenas are roughly 2x larger.
    this.raster = null;
  }

  hasGroundAt(x) {
    return this.groundYAt(x) != null;
  }

  clampGroundX(x, margin = 0) {
    if (!this.groundIntervals.length) return MathEx.clamp(x, margin, this.worldWidth - margin);
    if (this.hasGroundAt(x)) return x;

    let best = this.groundIntervals[0][0] + margin;
    let bestDistance = Infinity;

    for (const [left,right] of this.groundIntervals) {
      const a = left + margin;
      const b = right - margin;
      for (const candidate of [a,b]) {
        const distance = Math.abs(candidate - x);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = candidate;
        }
      }
    }
    return best;
  }

  // Rectangle maps currently expose flat top surfaces. If rectangles overlap,
  // the highest top surface wins.
  groundYAt(x) {
    let ground = null;
    for (const rect of this.rectangles) {
      if (x < rect.x || x > rect.x + rect.w) continue;
      if (ground == null || rect.y < ground) ground = rect.y;
    }
    return ground;
  }

  // Finds the top surface closest to a reference Y instead of always taking
  // the highest platform. Procedural feet use this so walking beside/under an
  // elevated platform does not make them snap upward onto it.
  surfaceYAt(x, referenceY) {
    let best = null;
    let bestDistance = Infinity;
    for (const rect of this.rectangles) {
      if (x < rect.x || x > rect.x + rect.w) continue;
      const distance = Math.abs(rect.y - referenceY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = rect.y;
      }
    }
    return best;
  }

  yAt(x) {
    const ground = this.groundYAt(x);
    return ground == null ? this.waterY + 360 : ground;
  }

  slopeAt() {
    return 0;
  }

  surfaceResponseAt(x, referenceY = null) {
    const ref = referenceY ?? this.groundYAt(x);
    let best = null;
    let bestDistance = Infinity;

    for (const rect of this.rectangles || []) {
      if (x < rect.x || x > rect.x + rect.w) continue;
      const distance = ref == null ? 0 : Math.abs(rect.y - ref);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = rect;
      }
    }

    const definitions = this.map?.surfaceMaterials || {};
    const material = best?.material || this.map?.defaultMaterial || 'default';
    const response = definitions[material] || definitions.default || {};

    return {
      material,
      acceleration:Number.isFinite(response.acceleration) ? response.acceleration : 1,
      deceleration:Number.isFinite(response.deceleration) ? response.deceleration : 1,
      reverse:Number.isFinite(response.reverse) ? response.reverse : 1,
      footGrip:Number.isFinite(response.footGrip) ? response.footGrip : 1
    };
  }

  circleIntersectsSolid(x, y, radius = 0) {
    for (const rect of this.rectangles) {
      const closestX = MathEx.clamp(x, rect.x, rect.x + rect.w);
      const closestY = MathEx.clamp(y, rect.y, rect.y + rect.h);
      const dx = x - closestX;
      const dy = y - closestY;
      if (dx * dx + dy * dy <= radius * radius) return true;
    }
    return false;
  }

  draw(ctx) {
    const huge = 16000;
    const outline = Math.max(0, Math.round(this.map?.outlineSize ?? 10));
    const outlineColor = this.map?.outlineColor || '#202020';
    const fillColor = this.map?.groundColor || '#596057';

    ctx.fillStyle = '#526d7a';
    ctx.fillRect(-huge, this.waterY, huge * 2, huge);

    ctx.fillStyle = '#607e8c';
    ctx.fillRect(-huge, this.waterY, huge * 2, 12);

    // Expanded shells first, fills second. This keeps touching rectangles
    // visually merged without needing a world-sized cached bitmap.
    ctx.fillStyle = outlineColor;
    for (const rect of this.rectangles) {
      ctx.fillRect(
        rect.x - outline,
        rect.y - outline,
        rect.w + outline * 2,
        rect.h + outline * 2
      );
    }

    for (const rect of this.rectangles) {
      ctx.fillStyle = rect.color || fillColor;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  }
}
