'use strict';

class CustomizationScreen {
  constructor({ root, items, preview, onContinue }) {
    this.root = root;
    this.items = items;
    this.preview = preview;
    this.onContinue = onContinue;
    this.info = document.getElementById('weaponInfo');
    this.tab = 'weapon';
    this.selectedPart = 'chest';
    this.loadout = {
      weapon:'revolver',
      appearance:Player.defaultAppearance()
    };

    this.parts = [
      ['chest','ui.customize.body'],
      ['arms','ui.customize.arms'],
      ['legs','ui.customize.legs']
    ];
    this.colors = [
      '#9a78c7','#d88b55','#e2a45f','#6096c6','#78a9d4','#c7bd4e',
      '#d7cf68','#76b887','#69a9b7','#d7dce3','#df6c6c','#66b67a',
      '#5f8ed0','#dbb85c','#d477b7','#ededed','#9a9a9a','#5f5f5f','#242424'
    ];

    root.querySelectorAll('[data-tab]').forEach(button => {
      button.addEventListener('click', () => this.showTab(button.dataset.tab));
    });
    document.getElementById('continueBtn').addEventListener('click', () => this.onContinue(this.getLoadout()));
    this.renderItems();
    this.syncPreview();
  }

  getLoadout() {
    return { weapon:this.loadout.weapon, appearance:{...this.loadout.appearance} };
  }

  showTab(tab) {
    this.tab = tab;
    this.hideWeaponInfo();
    this.root.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
    this.renderItems();
  }

  syncPreview() {
    this.preview.setAppearance(this.loadout.appearance);
    this.preview.setWeapon(this.loadout.weapon);
  }

  makeCard(label, selected, handler, extraClass='') {
    const button = document.createElement('button');
    button.className = `itemCard ${selected ? 'selected' : ''} ${extraClass}`.trim();
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  }

  renderItems() {
    this.items.innerHTML = '';
    if (this.tab === 'weapon') this.renderWeapons();
    else this.renderColors();
  }

  showWeaponInfo(weapon, event = null, anchor = null) {
    const copy = Language.weapon(weapon.id);
    this.info.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'weaponInfoTitle';
    title.textContent = copy.name;
    this.info.appendChild(title);

    if (copy.description) {
      const description = document.createElement('div');
      description.className = 'weaponInfoDescription';
      description.textContent = copy.description;
      this.info.appendChild(description);
    }

    const moveset = document.createElement('div');
    moveset.className = 'weaponInfoLabel';
    moveset.textContent = Language.t('ui.customize.moveset', 'MOVESET');
    this.info.appendChild(moveset);

    for (const move of copy.moves || []) {
      const row = document.createElement('div');
      row.className = 'moveRow';

      const input = document.createElement('div');
      input.className = 'moveInput';
      input.textContent = move.input;

      const text = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = move.name;
      const detail = document.createElement('div');
      detail.className = 'moveDescription';
      detail.textContent = move.description;
      text.append(name, detail);

      row.append(input, text);
      this.info.appendChild(row);
    }

    this.info.classList.remove('hidden');
    this.positionWeaponInfo(event, anchor);
  }

  positionWeaponInfo(event = null, anchor = null) {
    let clientX = event?.clientX;
    let clientY = event?.clientY;

    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      const rect = anchor?.getBoundingClientRect?.();
      if (!rect) return;
      clientX = rect.right;
      clientY = rect.top + rect.height * 0.5;
    }

    const margin = 10;
    const offset = 16;
    const rect = this.info.getBoundingClientRect();

    let left = clientX + offset;
    let top = clientY + offset;

    if (left + rect.width > window.innerWidth - margin) {
      left = clientX - rect.width - offset;
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = clientY - rect.height - offset;
    }

    this.info.style.left = `${Math.max(margin, left)}px`;
    this.info.style.top = `${Math.max(margin, top)}px`;
  }

  hideWeaponInfo() {
    this.info.classList.add('hidden');
  }

  renderWeapons() {
    const grid = document.createElement('div');
    grid.className = 'weaponGrid';

    for (const weapon of WeaponRegistry.list) {
      const copy = Language.weapon(weapon.id);
      const button = document.createElement('button');
      button.className = `weaponTile ${this.loadout.weapon === weapon.id ? 'selected' : ''}`.trim();
      button.title = copy.name;
      button.setAttribute('aria-label', copy.name);

      if (weapon.sprite) {
        const image = document.createElement('img');
        image.className = 'weaponTileSprite';
        image.src = weapon.sprite;
        image.alt = '';
        button.appendChild(image);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'weaponPlaceholder';
        button.appendChild(placeholder);
      }

      button.addEventListener('mouseenter', (event) => this.showWeaponInfo(weapon, event, button));
      button.addEventListener('mousemove', (event) => this.positionWeaponInfo(event, button));
      button.addEventListener('mouseleave', () => this.hideWeaponInfo());
      button.addEventListener('focus', () => this.showWeaponInfo(weapon, null, button));
      button.addEventListener('blur', () => this.hideWeaponInfo());
      button.addEventListener('click', () => {
        this.loadout.weapon = weapon.id;
        this.syncPreview();
        this.renderItems();
      });

      grid.appendChild(button);
    }

    this.items.appendChild(grid);
  }

  groupColor(group) {
    const a = this.loadout.appearance;
    if (group === 'chest') return a.body;
    if (group === 'arms') return a.armUpper;
    return a.legUpper0;
  }

  applyGroupColor(group, color) {
    const a = this.loadout.appearance;
    if (group === 'chest') {
      a.body = color;
    } else if (group === 'arms') {
      a.armUpper = color;
      a.armLower = color;
      a.hand = color;
    } else {
      a.legUpper0 = color;
      a.legLower0 = color;
      a.foot0 = color;
      a.legUpper1 = color;
      a.legLower1 = color;
      a.foot1 = color;
    }
  }

  renderColors() {
    const partGrid = document.createElement('div');
    partGrid.className = 'partSelector';
    for (const [key,labelKey] of this.parts) {
      partGrid.appendChild(this.makeCard(Language.t(labelKey, key.toUpperCase()), this.selectedPart === key, () => {
        this.selectedPart = key;
        this.renderItems();
      }, 'partCard'));
    }
    this.items.appendChild(partGrid);

    const swatches = document.createElement('div');
    swatches.className = 'swatchGrid';
    const active = this.groupColor(this.selectedPart);
    for (const color of this.colors) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = color;
      b.classList.toggle('selected', active === color);
      b.title = color;
      b.addEventListener('click', () => {
        this.applyGroupColor(this.selectedPart, color);
        this.syncPreview();
        this.renderItems();
      });
      swatches.appendChild(b);
    }
    this.items.appendChild(swatches);
  }
}
