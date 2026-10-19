'use strict';

(() => {
  const cfg = typeof createGameConfig === 'function'
    ? createGameConfig()
    : {
        bodyW:58, bodyH:58, upperLeg:35, lowerLeg:37,
        hipInset:14, bodyHeight:48, stanceSpread:12,
        handRestX:78, handRestY:-8
      };

  const canvas = document.getElementById('editorCanvas');
  const ctx = canvas.getContext('2d');

  const ui = {
    tools:[...document.querySelectorAll('.tool')],
    gridSize:document.getElementById('gridSize'),
    showGrid:document.getElementById('showGrid'),
    showPlayers:document.getElementById('showPlayers'),
    showGhost:document.getElementById('showGhost'),
    showCollision:document.getElementById('showCollision'),
    brushColor:document.getElementById('brushColor'),
    brushMaterial:document.getElementById('brushMaterial'),
    palette:document.getElementById('palette'),
    mapId:document.getElementById('mapId'),
    mapName:document.getElementById('mapName'),
    mapWidth:document.getElementById('mapWidth'),
    mapHeight:document.getElementById('mapHeight'),
    backgroundColor:document.getElementById('backgroundColor'),
    groundColor:document.getElementById('groundColor'),
    outlineColor:document.getElementById('outlineColor'),
    outlineSize:document.getElementById('outlineSize'),
    waterY:document.getElementById('waterY'),
    coordText:document.getElementById('coordText'),
    zoomText:document.getElementById('zoomText'),
    statusText:document.getElementById('statusText'),
    emptySelection:document.getElementById('emptySelection'),
    selectionEditor:document.getElementById('selectionEditor'),
    selX:document.getElementById('selX'),
    selY:document.getElementById('selY'),
    selW:document.getElementById('selW'),
    selH:document.getElementById('selH'),
    selColor:document.getElementById('selColor'),
    selMaterial:document.getElementById('selMaterial'),
    duplicateBtn:document.getElementById('duplicateBtn'),
    deleteBtn:document.getElementById('deleteBtn'),
    playerScaleInfo:document.getElementById('playerScaleInfo'),
    jsonText:document.getElementById('jsonText'),
    newBtn:document.getElementById('newBtn'),
    importFileBtn:document.getElementById('importFileBtn'),
    fileInput:document.getElementById('fileInput'),
    copyBtn:document.getElementById('copyBtn'),
    downloadBtn:document.getElementById('downloadBtn'),
    fitBtn:document.getElementById('fitBtn'),
    refreshJsonBtn:document.getElementById('refreshJsonBtn'),
    applyJsonBtn:document.getElementById('applyJsonBtn')
  };

  const palette = [
    '#596057', '#72786d', '#4e6267', '#63717e',
    '#6f5d72', '#7a5d55', '#736d4d', '#565656',
    '#35444b', '#59484b', '#4d5846', '#777777'
  ];

  const makeDefaultMap = () => ({
    version:1,
    id:'my-map',
    name:'MY MAP',
    width:2750,
    height:1225,
    waterY:950,
    background:'#242a30',
    groundColor:'#596057',
    outlineColor:'#202020',
    outlineSize:10,
    spawns:[
      { x:700, y:625 },
      { x:2050, y:625 }
    ],
    rectangles:[
      { x:500, y:725, w:1750, h:200, color:'#596057', material:'default' }
    ]
  });

  const state = {
    map:makeDefaultMap(),
    tool:'select',
    grid:25,
    selected:-1,
    zoom:0.45,
    viewX:0,
    viewY:0,
    mouseWorld:{ x:0, y:0 },
    mouseScreen:{ x:0, y:0 },
    drawing:null,
    drag:null,
    panning:null,
    spaceDown:false,
    undo:[],
    redo:[],
    dpr:1
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function snapshot() {
    return JSON.stringify(state.map);
  }

  function remember(serialized = snapshot()) {
    state.undo.push(serialized);
    if (state.undo.length > 80) state.undo.shift();
    state.redo.length = 0;
  }

  function restore(serialized) {
    state.map = normalizeMap(JSON.parse(serialized));
    state.selected = -1;
    syncAll();
  }

  function undo() {
    if (!state.undo.length) return;
    state.redo.push(snapshot());
    restore(state.undo.pop());
  }

  function redo() {
    if (!state.redo.length) return;
    state.undo.push(snapshot());
    restore(state.redo.pop());
  }

  function mutate(fn) {
    const before = snapshot();
    fn();
    if (snapshot() !== before) {
      remember(before);
      syncAll();
    }
  }

  function normalizeColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ''))
      ? String(value).toLowerCase()
      : fallback;
  }

  function normalizeMap(source) {
    const fallback = makeDefaultMap();
    const width = Math.max(320, Math.round(Number(source?.width) || fallback.width));
    const height = Math.max(240, Math.round(Number(source?.height) || fallback.height));

    const map = {
      version:1,
      id:String(source?.id || fallback.id).trim().slice(0, 32) || fallback.id,
      name:String(source?.name || fallback.name).trim().slice(0, 40) || fallback.name,
      width,
      height,
      waterY:Number.isFinite(Number(source?.waterY))
        ? Math.round(Number(source.waterY))
        : fallback.waterY,
      background:normalizeColor(source?.background, fallback.background),
      groundColor:normalizeColor(source?.groundColor, fallback.groundColor),
      outlineColor:normalizeColor(source?.outlineColor, fallback.outlineColor),
      outlineSize:Math.max(
        0,
        Math.min(
          40,
          Number.isFinite(Number(source?.outlineSize))
            ? Math.round(Number(source.outlineSize))
            : fallback.outlineSize
        )
      ),
      spawns:[0,1].map((index) => {
        const spawn = source?.spawns?.[index] || fallback.spawns[index];
        return {
          x:Math.round(Number(spawn?.x) || 0),
          y:Math.round(Number(spawn?.y) || 0)
        };
      }),
      rectangles:(Array.isArray(source?.rectangles) ? source.rectangles : [])
        .map((rect) => ({
          x:Math.round(Number(rect?.x) || 0),
          y:Math.round(Number(rect?.y) || 0),
          w:Math.max(1, Math.round(Number(rect?.w) || 1)),
          h:Math.max(1, Math.round(Number(rect?.h) || 1)),
          color:normalizeColor(rect?.color, source?.groundColor || fallback.groundColor),
          material:String(rect?.material || 'default').trim().slice(0, 24) || 'default'
        }))
    };

    if (source?.surfaceMaterials && typeof source.surfaceMaterials === 'object') {
      map.surfaceMaterials = clone(source.surfaceMaterials);
    }
    if (source?.defaultMaterial) {
      map.defaultMaterial = String(source.defaultMaterial);
    }

    return map;
  }

  function exportMap() {
    const map = clone(state.map);
    map.rectangles = map.rectangles.map((rect) => ({
      x:Math.round(rect.x),
      y:Math.round(rect.y),
      w:Math.round(rect.w),
      h:Math.round(rect.h),
      color:rect.color || map.groundColor,
      material:rect.material || 'default'
    }));
    map.spawns = map.spawns.map((spawn) => ({
      x:Math.round(spawn.x),
      y:Math.round(spawn.y)
    }));
    return map;
  }

  function refreshJson() {
    ui.jsonText.value = JSON.stringify(exportMap(), null, 2);
  }

  function syncMapInputs() {
    const map = state.map;
    ui.mapId.value = map.id;
    ui.mapName.value = map.name;
    ui.mapWidth.value = map.width;
    ui.mapHeight.value = map.height;
    ui.backgroundColor.value = map.background;
    ui.groundColor.value = map.groundColor;
    ui.outlineColor.value = map.outlineColor;
    ui.outlineSize.value = map.outlineSize;
    ui.waterY.value = map.waterY;
  }

  function syncSelection() {
    const rect = state.map.rectangles[state.selected];
    const active = !!rect;
    ui.emptySelection.classList.toggle('hidden', active);
    ui.selectionEditor.classList.toggle('hidden', !active);
    if (!active) return;

    ui.selX.value = rect.x;
    ui.selY.value = rect.y;
    ui.selW.value = rect.w;
    ui.selH.value = rect.h;
    ui.selColor.value = rect.color || state.map.groundColor;
    ui.selMaterial.value = rect.material || 'default';
  }

  function syncScaleInfo() {
    const total = cfg.bodyH + cfg.bodyHeight;
    ui.playerScaleInfo.innerHTML = [
      ['BODY', `${cfg.bodyW} x ${cfg.bodyH}`],
      ['UPPER LEG', `${cfg.upperLeg} px`],
      ['LOWER LEG', `${cfg.lowerLeg} px`],
      ['LEG REACH', `${cfg.upperLeg + cfg.lowerLeg} px`],
      ['STANDING OFFSET', `${cfg.bodyH * 0.5 + cfg.bodyHeight} px`],
      ['STANDING HEIGHT', `~${Math.round(total)} px`]
    ].map(([a,b]) => `<b>${a}</b><span>${b}</span>`).join('');
  }

  function syncAll() {
    syncMapInputs();
    syncSelection();
    refreshJson();
  }

  function setTool(tool) {
    state.tool = tool;
    ui.tools.forEach((button) => {
      button.classList.toggle('active', button.dataset.tool === tool);
    });
    ui.statusText.textContent = tool.toUpperCase();
  }

  function snap(value) {
    return Math.round(value / state.grid) * state.grid;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function pointFromEvent(event) {
    const box = canvas.getBoundingClientRect();
    return {
      x:event.clientX - box.left,
      y:event.clientY - box.top
    };
  }

  function screenToWorld(screenX, screenY) {
    return {
      x:state.viewX + screenX / state.zoom,
      y:state.viewY + screenY / state.zoom
    };
  }

  function resizeCanvas() {
    const box = canvas.getBoundingClientRect();
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(box.width * state.dpr));
    canvas.height = Math.max(1, Math.round(box.height * state.dpr));
    render();
  }

  function fitMap() {
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const margin = 42;
    state.zoom = clamp(
      Math.min(
        (box.width - margin * 2) / state.map.width,
        (box.height - margin * 2) / state.map.height
      ),
      0.08,
      4
    );
    state.viewX = (state.map.width - box.width / state.zoom) * 0.5;
    state.viewY = (state.map.height - box.height / state.zoom) * 0.5;
    render();
  }

  function visibleWorldBounds() {
    const box = canvas.getBoundingClientRect();
    return {
      left:state.viewX,
      top:state.viewY,
      right:state.viewX + box.width / state.zoom,
      bottom:state.viewY + box.height / state.zoom
    };
  }

  function surfaceYAt(x, referenceY) {
    let best = null;
    let bestDistance = Infinity;
    for (const rect of state.map.rectangles) {
      if (x < rect.x || x > rect.x + rect.w) continue;
      const distance = Math.abs(rect.y - referenceY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = rect.y;
      }
    }
    return best;
  }

  function solveKnee(hx, hy, fx, fy, bend) {
    const L1 = cfg.upperLeg;
    const L2 = cfg.lowerLeg;
    let dx = fx - hx;
    let dy = fy - hy;
    let d = Math.max(0.001, Math.hypot(dx, dy));
    d = clamp(d, Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.01);
    const raw = Math.hypot(dx, dy) || 1;
    const ux = dx / raw;
    const uy = dy / raw;
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const px = hx + ux * a;
    const py = hy + uy * a;
    return {
      x:px - uy * h * bend,
      y:py + ux * h * bend
    };
  }

  function drawPlayerAt(x, referenceY, facing, label, color, alpha = 1) {
    const ground = surfaceYAt(x, referenceY);
    const hasGround = ground != null;
    const footY = hasGround ? ground : referenceY;
    const bodyY = footY - cfg.bodyH * 0.5 - cfg.bodyHeight;
    const stance = cfg.stanceSpread ?? 12;

    ctx.save();
    ctx.globalAlpha *= alpha;

    if (ui.showCollision.checked) {
      ctx.save();
      ctx.setLineDash([6 / state.zoom, 5 / state.zoom]);
      ctx.lineWidth = 1.5 / state.zoom;
      ctx.strokeStyle = '#ffffffcc';
      ctx.strokeRect(
        x - cfg.bodyW * 0.5,
        bodyY - cfg.bodyH * 0.5,
        cfg.bodyW,
        cfg.bodyH
      );
      ctx.restore();
    }

    for (let i = 0; i < 2; i++) {
      const hipX = x + (i ? cfg.hipInset : -cfg.hipInset);
      const hipY = bodyY + cfg.bodyH * 0.38;
      const footX = x + (i ? 1 : -1) * stance * 0.5;
      const knee = solveKnee(
        hipX, hipY,
        footX, footY,
        -facing
      );

      ctx.strokeStyle = i ? '#c5875e' : '#dd985f';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(knee.x, knee.y);
      ctx.lineTo(footX, footY - 12);
      ctx.stroke();

      ctx.fillStyle = '#d99160';
      ctx.beginPath();
      ctx.arc(footX, footY - 12, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    const shoulderX = x;
    const shoulderY = bodyY - 4;
    const handX = x + facing * Math.min(cfg.handRestX ?? 78, 82);
    const handY = bodyY + (cfg.handRestY ?? -8);
    const elbowX = (shoulderX + handX) * 0.5;
    const elbowY = (shoulderY + handY) * 0.5 + 13;

    ctx.strokeStyle = '#69a9b7';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    ctx.fillStyle = '#69a9b7';
    ctx.fillRect(handX - 8, handY - 8, 16, 16);

    ctx.fillStyle = '#202020';
    ctx.fillRect(
      x - cfg.bodyW * 0.5 - 2,
      bodyY - cfg.bodyH * 0.5 - 2,
      cfg.bodyW + 4,
      cfg.bodyH + 4
    );
    ctx.fillStyle = color;
    ctx.fillRect(
      x - cfg.bodyW * 0.5,
      bodyY - cfg.bodyH * 0.5,
      cfg.bodyW,
      cfg.bodyH
    );

    ctx.font = `${Math.max(9, 11 / state.zoom)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = hasGround ? '#fff' : '#ff8d8d';
    ctx.fillText(
      hasGround ? label : `${label} / NO FLOOR`,
      x,
      bodyY - cfg.bodyH * 0.5 - 10 / state.zoom
    );

    ctx.restore();
  }

  function drawGrid(bounds) {
    if (!ui.showGrid.checked) return;
    const grid = state.grid;
    const left = Math.max(0, Math.floor(bounds.left / grid) * grid);
    const top = Math.max(0, Math.floor(bounds.top / grid) * grid);
    const right = Math.min(state.map.width, bounds.right);
    const bottom = Math.min(state.map.height, bounds.bottom);

    ctx.lineWidth = 1 / state.zoom;
    for (let x = left; x <= right; x += grid) {
      const major = Math.round(x / grid) % 5 === 0;
      ctx.strokeStyle = major ? '#ffffff22' : '#ffffff0e';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, state.map.height);
      ctx.stroke();
    }
    for (let y = top; y <= bottom; y += grid) {
      const major = Math.round(y / grid) % 5 === 0;
      ctx.strokeStyle = major ? '#ffffff22' : '#ffffff0e';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(state.map.width, y);
      ctx.stroke();
    }
  }

  function drawBlocks() {
    const outline = state.map.outlineSize;
    ctx.fillStyle = state.map.outlineColor;
    for (const rect of state.map.rectangles) {
      ctx.fillRect(
        rect.x - outline,
        rect.y - outline,
        rect.w + outline * 2,
        rect.h + outline * 2
      );
    }

    for (const rect of state.map.rectangles) {
      ctx.fillStyle = rect.color || state.map.groundColor;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }

    const selected = state.map.rectangles[state.selected];
    if (selected) {
      ctx.save();
      ctx.lineWidth = 2 / state.zoom;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(selected.x, selected.y, selected.w, selected.h);

      const handle = 9 / state.zoom;
      ctx.fillStyle = '#fff';
      ctx.fillRect(
        selected.x + selected.w - handle * 0.5,
        selected.y + selected.h - handle * 0.5,
        handle,
        handle
      );
      ctx.restore();
    }
  }

  function normalizedPreviewRect(a, b) {
    let x0 = clamp(snap(a.x), 0, state.map.width);
    let y0 = clamp(snap(a.y), 0, state.map.height);
    let x1 = clamp(snap(b.x), 0, state.map.width);
    let y1 = clamp(snap(b.y), 0, state.map.height);

    if (x0 === x1) x1 = clamp(x1 + state.grid, 0, state.map.width);
    if (y0 === y1) y1 = clamp(y1 + state.grid, 0, state.map.height);

    return {
      x:Math.min(x0, x1),
      y:Math.min(y0, y1),
      w:Math.abs(x1 - x0),
      h:Math.abs(y1 - y0)
    };
  }

  function render() {
    const box = canvas.getBoundingClientRect();
    const dpr = state.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, box.width, box.height);
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, box.width, box.height);

    ctx.save();
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(-state.viewX, -state.viewY);

    ctx.fillStyle = state.map.background;
    ctx.fillRect(0, 0, state.map.width, state.map.height);

    if (Number.isFinite(state.map.waterY)) {
      ctx.fillStyle = '#526d7a';
      ctx.fillRect(
        0,
        state.map.waterY,
        state.map.width,
        Math.max(0, state.map.height - state.map.waterY)
      );
      ctx.fillStyle = '#607e8c';
      ctx.fillRect(0, state.map.waterY, state.map.width, 12);
    }

    drawGrid(visibleWorldBounds());
    drawBlocks();

    if (state.drawing) {
      const preview = normalizedPreviewRect(
        state.drawing.start,
        state.drawing.current
      );
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = ui.brushColor.value;
      ctx.fillRect(preview.x, preview.y, preview.w, preview.h);
      ctx.lineWidth = 2 / state.zoom;
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(preview.x, preview.y, preview.w, preview.h);
      ctx.restore();
    }

    ctx.save();
    ctx.lineWidth = 2 / state.zoom;
    ctx.strokeStyle = '#ffffff99';
    ctx.strokeRect(0, 0, state.map.width, state.map.height);
    ctx.restore();

    if (ui.showPlayers.checked) {
      drawPlayerAt(
        state.map.spawns[0].x,
        state.map.spawns[0].y,
        1,
        'P1',
        '#9a78c7',
        1
      );
      drawPlayerAt(
        state.map.spawns[1].x,
        state.map.spawns[1].y,
        -1,
        'P2',
        '#8c6f78',
        1
      );
    }

    if (
      ui.showGhost.checked &&
      state.mouseWorld.x >= 0 &&
      state.mouseWorld.x <= state.map.width &&
      state.mouseWorld.y >= 0 &&
      state.mouseWorld.y <= state.map.height
    ) {
      drawPlayerAt(
        snap(state.mouseWorld.x),
        state.mouseWorld.y,
        1,
        'SCALE',
        '#d7d7d7',
        0.38
      );
    }

    ctx.restore();

    ui.zoomText.textContent = `${Math.round(state.zoom * 100)}%`;
    ui.coordText.textContent =
      `X ${Math.round(state.mouseWorld.x)} / Y ${Math.round(state.mouseWorld.y)}`;
  }

  function hitRect(world) {
    for (let i = state.map.rectangles.length - 1; i >= 0; i--) {
      const rect = state.map.rectangles[i];
      if (
        world.x >= rect.x &&
        world.x <= rect.x + rect.w &&
        world.y >= rect.y &&
        world.y <= rect.y + rect.h
      ) {
        return i;
      }
    }
    return -1;
  }

  function beginDrag(index, world) {
    const rect = state.map.rectangles[index];
    const handleRadius = 13 / state.zoom;
    const nearResize =
      Math.abs(world.x - (rect.x + rect.w)) <= handleRadius &&
      Math.abs(world.y - (rect.y + rect.h)) <= handleRadius;

    state.drag = {
      index,
      mode:nearResize ? 'resize' : 'move',
      before:snapshot(),
      offsetX:world.x - rect.x,
      offsetY:world.y - rect.y,
      originX:rect.x,
      originY:rect.y
    };
  }

  function finishDrag() {
    if (!state.drag) return;
    if (snapshot() !== state.drag.before) {
      remember(state.drag.before);
      refreshJson();
    }
    state.drag = null;
    syncSelection();
  }

  function deleteSelected() {
    if (state.selected < 0) return;
    mutate(() => {
      state.map.rectangles.splice(state.selected, 1);
      state.selected = -1;
    });
  }

  function placeSpawn(index, world) {
    mutate(() => {
      state.map.spawns[index] = {
        x:clamp(snap(world.x), 0, state.map.width),
        y:clamp(snap(world.y), 0, state.map.height)
      };
    });
  }

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    const screen = pointFromEvent(event);
    const world = screenToWorld(screen.x, screen.y);

    if (event.button === 1 || (state.spaceDown && event.button === 0)) {
      state.panning = {
        screenX:screen.x,
        screenY:screen.y,
        viewX:state.viewX,
        viewY:state.viewY
      };
      event.preventDefault();
      return;
    }

    if (event.button !== 0) return;

    if (state.tool === 'block') {
      state.drawing = { start:world, current:world };
      render();
      return;
    }

    if (state.tool === 'spawn0') {
      placeSpawn(0, world);
      return;
    }

    if (state.tool === 'spawn1') {
      placeSpawn(1, world);
      return;
    }

    if (state.tool === 'water') {
      mutate(() => {
        state.map.waterY = clamp(snap(world.y), 0, state.map.height + 500);
      });
      return;
    }

    const index = hitRect(world);

    if (state.tool === 'erase') {
      if (index >= 0) {
        mutate(() => {
          state.map.rectangles.splice(index, 1);
          state.selected = -1;
        });
      }
      return;
    }

    if (state.tool === 'select') {
      state.selected = index;
      syncSelection();
      if (index >= 0) beginDrag(index, world);
      render();
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    const screen = pointFromEvent(event);
    const world = screenToWorld(screen.x, screen.y);
    state.mouseScreen = screen;
    state.mouseWorld = world;

    if (state.panning) {
      state.viewX =
        state.panning.viewX -
        (screen.x - state.panning.screenX) / state.zoom;
      state.viewY =
        state.panning.viewY -
        (screen.y - state.panning.screenY) / state.zoom;
      render();
      return;
    }

    if (state.drawing) {
      state.drawing.current = world;
      render();
      return;
    }

    if (state.drag) {
      const rect = state.map.rectangles[state.drag.index];
      if (rect) {
        if (state.drag.mode === 'resize') {
          rect.w = Math.max(
            state.grid,
            clamp(
              snap(world.x) - state.drag.originX,
              state.grid,
              state.map.width - state.drag.originX
            )
          );
          rect.h = Math.max(
            state.grid,
            clamp(
              snap(world.y) - state.drag.originY,
              state.grid,
              state.map.height - state.drag.originY
            )
          );
        } else {
          rect.x = clamp(
            snap(world.x - state.drag.offsetX),
            0,
            Math.max(0, state.map.width - rect.w)
          );
          rect.y = clamp(
            snap(world.y - state.drag.offsetY),
            0,
            Math.max(0, state.map.height - rect.h)
          );
        }
        syncSelection();
      }
      render();
      return;
    }

    render();
  });

  canvas.addEventListener('pointerup', (event) => {
    if (state.panning) {
      state.panning = null;
      return;
    }

    if (state.drawing) {
      const preview = normalizedPreviewRect(
        state.drawing.start,
        state.drawing.current
      );
      state.drawing = null;

      if (preview.w > 0 && preview.h > 0) {
        const before = snapshot();
        state.map.rectangles.push({
          ...preview,
          color:ui.brushColor.value,
          material:ui.brushMaterial.value.trim() || 'default'
        });
        state.selected = state.map.rectangles.length - 1;
        remember(before);
        syncAll();
      }
      render();
      return;
    }

    finishDrag();
    render();
  });

  canvas.addEventListener('pointercancel', () => {
    state.drawing = null;
    state.drag = null;
    state.panning = null;
    render();
  });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const screen = pointFromEvent(event);
    const before = screenToWorld(screen.x, screen.y);
    const factor = Math.exp(-event.deltaY * 0.0012);
    state.zoom = clamp(state.zoom * factor, 0.06, 5);
    state.viewX = before.x - screen.x / state.zoom;
    state.viewY = before.y - screen.y / state.zoom;
    render();
  }, { passive:false });

  window.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName;
    const typing = ['INPUT','TEXTAREA','SELECT'].includes(tag);

    if (event.code === 'Space' && !typing) {
      state.spaceDown = true;
      event.preventDefault();
    }

    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyY') {
      event.preventDefault();
      redo();
      return;
    }

    if (typing) return;

    const tools = {
      Digit1:'select',
      Digit2:'block',
      Digit3:'spawn0',
      Digit4:'spawn1',
      Digit5:'water',
      Digit6:'erase'
    };
    if (tools[event.code]) setTool(tools[event.code]);

    if (event.code === 'Delete' || event.code === 'Backspace') {
      event.preventDefault();
      deleteSelected();
    }
    if (event.code === 'KeyF') fitMap();
    if (event.code === 'KeyG') {
      ui.showGrid.checked = !ui.showGrid.checked;
      render();
    }
  });

  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space') state.spaceDown = false;
  });

  ui.tools.forEach((button) => {
    button.addEventListener('click', () => setTool(button.dataset.tool));
  });

  ui.gridSize.addEventListener('change', () => {
    state.grid = Number(ui.gridSize.value) || 25;
    render();
  });

  [
    ui.showGrid,
    ui.showPlayers,
    ui.showGhost,
    ui.showCollision
  ].forEach((input) => input.addEventListener('change', render));

  palette.forEach((color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.style.background = color;
    button.title = color;
    button.addEventListener('click', () => {
      ui.brushColor.value = color;
      if (state.selected >= 0) {
        mutate(() => {
          state.map.rectangles[state.selected].color = color;
        });
      }
      render();
    });
    ui.palette.appendChild(button);
  });

  const mapBindings = [
    [ui.mapId, 'id', (v) => String(v).trim().slice(0,32) || 'my-map'],
    [ui.mapName, 'name', (v) => String(v).trim().slice(0,40) || 'MY MAP'],
    [ui.mapWidth, 'width', (v) => Math.max(320, Math.round(Number(v) || 320))],
    [ui.mapHeight, 'height', (v) => Math.max(240, Math.round(Number(v) || 240))],
    [ui.backgroundColor, 'background', (v) => v],
    [ui.groundColor, 'groundColor', (v) => v],
    [ui.outlineColor, 'outlineColor', (v) => v],
    [ui.outlineSize, 'outlineSize', (v) => clamp(Math.round(Number(v) || 0),0,40)],
    [ui.waterY, 'waterY', (v) => Math.round(Number(v) || 0)]
  ];

  mapBindings.forEach(([input, key, parse]) => {
    input.addEventListener('change', () => {
      mutate(() => {
        state.map[key] = parse(input.value);
        if (key === 'width' || key === 'height') {
          state.map.spawns.forEach((spawn) => {
            spawn.x = clamp(spawn.x, 0, state.map.width);
            spawn.y = clamp(spawn.y, 0, state.map.height);
          });
        }
      });
      render();
    });
  });

  const selectionBindings = [
    [ui.selX, 'x', (v, rect) => clamp(snap(Number(v) || 0), 0, Math.max(0, state.map.width - rect.w))],
    [ui.selY, 'y', (v, rect) => clamp(snap(Number(v) || 0), 0, Math.max(0, state.map.height - rect.h))],
    [ui.selW, 'w', (v, rect) => Math.max(state.grid, snap(Number(v) || state.grid))],
    [ui.selH, 'h', (v, rect) => Math.max(state.grid, snap(Number(v) || state.grid))],
    [ui.selColor, 'color', (v) => v],
    [ui.selMaterial, 'material', (v) => String(v).trim().slice(0,24) || 'default']
  ];

  selectionBindings.forEach(([input, key, parse]) => {
    input.addEventListener('change', () => {
      if (state.selected < 0) return;
      mutate(() => {
        const rect = state.map.rectangles[state.selected];
        rect[key] = parse(input.value, rect);
        rect.w = Math.min(rect.w, state.map.width - rect.x);
        rect.h = Math.min(rect.h, state.map.height - rect.y);
      });
      render();
    });
  });

  ui.duplicateBtn.addEventListener('click', () => {
    if (state.selected < 0) return;
    mutate(() => {
      const source = state.map.rectangles[state.selected];
      const copy = clone(source);
      copy.x = clamp(source.x + state.grid, 0, Math.max(0, state.map.width - source.w));
      copy.y = clamp(source.y + state.grid, 0, Math.max(0, state.map.height - source.h));
      state.map.rectangles.push(copy);
      state.selected = state.map.rectangles.length - 1;
    });
    render();
  });

  ui.deleteBtn.addEventListener('click', deleteSelected);

  ui.newBtn.addEventListener('click', () => {
    const before = snapshot();
    state.map = makeDefaultMap();
    state.selected = -1;
    remember(before);
    syncAll();
    fitMap();
  });

  ui.fitBtn.addEventListener('click', fitMap);

  ui.refreshJsonBtn.addEventListener('click', refreshJson);

  ui.applyJsonBtn.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(ui.jsonText.value);
      const before = snapshot();
      state.map = normalizeMap(parsed);
      state.selected = -1;
      remember(before);
      syncAll();
      fitMap();
      ui.statusText.textContent = 'JSON APPLIED';
    } catch (error) {
      ui.statusText.textContent = 'INVALID JSON';
    }
  });

  ui.copyBtn.addEventListener('click', async () => {
    refreshJson();
    try {
      await navigator.clipboard.writeText(ui.jsonText.value);
      ui.statusText.textContent = 'JSON COPIED';
    } catch (_) {
      ui.jsonText.focus();
      ui.jsonText.select();
      ui.statusText.textContent = 'JSON SELECTED';
    }
  });

  ui.downloadBtn.addEventListener('click', () => {
    refreshJson();
    const blob = new Blob([ui.jsonText.value + '\n'], {
      type:'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.map.id || 'qwarddle-map'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    ui.statusText.textContent = 'JSON DOWNLOADED';
  });

  ui.importFileBtn.addEventListener('click', () => ui.fileInput.click());

  ui.fileInput.addEventListener('change', async () => {
    const file = ui.fileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const before = snapshot();
      state.map = normalizeMap(JSON.parse(text));
      state.selected = -1;
      remember(before);
      syncAll();
      fitMap();
      ui.statusText.textContent = 'MAP IMPORTED';
    } catch (_) {
      ui.statusText.textContent = 'IMPORT FAILED';
    } finally {
      ui.fileInput.value = '';
    }
  });

  new ResizeObserver(resizeCanvas).observe(canvas);

  syncScaleInfo();
  syncAll();
  resizeCanvas();
  requestAnimationFrame(fitMap);
})();
