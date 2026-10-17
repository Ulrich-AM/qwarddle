'use strict';

class App {
  constructor() {
    this.menu = document.getElementById('menu');
    this.modeScreen = document.getElementById('modeScreen');
    this.mapScreen = document.getElementById('mapScreen');
    this.customScreen = document.getElementById('customScreen');
    this.gameCanvas = document.getElementById('game');

    this.game = new Game(this.gameCanvas);
    this.menuDemo = new MenuDemo(document.getElementById('menuDemo'), { interactive:true });
    this.customDemo = new MenuDemo(document.getElementById('customDemo'), { interactive:false, stationaryShowcase:true });

    this.selectedMapId = MapRegistry.list[0]?.id || null;

    this.mapSelection = new MapSelectionScreen({
      root:this.mapScreen,
      items:document.getElementById('mapItems'),
      onContinue:(mapId) => {
        this.selectedMapId = mapId;
        this.showCustomize();
      }
    });

    this.customization = new CustomizationScreen({
      root:this.customScreen,
      items:document.getElementById('customItems'),
      preview:this.customDemo,
      onContinue:(loadout) => this.showGame(loadout)
    });

    this.screen = 'menu';
    document.getElementById('playBtn').addEventListener('click', () => this.showMode());
    document.getElementById('singleBtn').addEventListener('click', () => this.showMaps());

    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Escape') return;
      if (this.screen === 'game') this.showMenu();
      else if (this.screen === 'custom') this.showMaps();
      else if (this.screen === 'map') this.showMode();
      else if (this.screen === 'mode') this.showMenu();
    });
  }

  hideScreens() {
    this.menu.classList.add('hidden');
    this.modeScreen.classList.add('hidden');
    this.mapScreen.classList.add('hidden');
    this.customScreen.classList.add('hidden');
  }

  showMenu() {
    this.screen = 'menu';
    this.hideScreens();
    this.menu.classList.remove('hidden');
    this.game.setActive(false);
    this.menuDemo.setActive(true);
    this.customDemo.setActive(false);
  }

  showMode() {
    this.screen = 'mode';
    this.hideScreens();
    this.modeScreen.classList.remove('hidden');
    this.game.setActive(false);
    this.menuDemo.setActive(false);
    this.customDemo.setActive(false);
  }

  showMaps() {
    this.screen = 'map';
    this.hideScreens();
    this.mapScreen.classList.remove('hidden');
    this.game.setActive(false);
    this.menuDemo.setActive(false);
    this.customDemo.setActive(false);
  }

  showCustomize() {
    this.screen = 'custom';
    this.hideScreens();
    this.customScreen.classList.remove('hidden');
    this.game.setActive(false);
    this.menuDemo.setActive(false);
    this.customDemo.setActive(true);
  }

  showGame(loadout = null) {
    this.screen = 'game';
    this.hideScreens();
    this.game.applyMap(this.selectedMapId);
    if (loadout) this.game.applyLoadout(loadout);
    this.menuDemo.setActive(false);
    this.customDemo.setActive(false);
    this.game.setActive(true);
    this.game.reset();
  }

  start() {
    this.game.start();
    this.menuDemo.start();
    this.customDemo.start();
    this.showMenu();
  }
}
