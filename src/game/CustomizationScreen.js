'use strict';

class CustomizationScreen {
  constructor({ root, items, preview, onContinue }) {
    this.root = root;
    this.items = items;
    this.preview = preview;
    this.onContinue = onContinue;
    this.tab = 'weapon';
    this.selectedPart = 'chest';
    this.loadout = {
      weapon:'revolver',
      appearance:Player.defaultAppearance()
    };

    this.parts = [
      ['chest','CHEST'],
      ['arms','ARMS'],
      ['legs','LEGS']
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

  renderWeapons() {
    const grid = document.createElement('div');
    grid.className = 'itemGrid weaponGrid';
    for (const weapon of WeaponRegistry.list) {
      grid.appendChild(this.makeCard(weapon.name, this.loadout.weapon === weapon.id, () => {
        this.loadout.weapon = weapon.id;
        this.syncPreview();
        this.renderItems();
      }, 'weaponCard'));
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
    for (const [key,label] of this.parts) {
      partGrid.appendChild(this.makeCard(label, this.selectedPart === key, () => {
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
