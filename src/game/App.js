'use strict';

class App {
  constructor() {
    this.menu = document.getElementById('menu');
    this.modeScreen = document.getElementById('modeScreen');
    this.customScreen = document.getElementById('customScreen');
    this.gameCanvas = document.getElementById('game');

    this.game = new Game(this.gameCanvas);
    this.menuDemo = new MenuDemo(document.getElementById('menuDemo'), { interactive:true });
    this.customDemo = new MenuDemo(document.getElementById('customDemo'), { interactive:false, stationaryShowcase:true });
    this.customization = new CustomizationScreen({
      root:this.customScreen,
      items:document.getElementById('customItems'),
      preview:this.customDemo,
      onContinue:(loadout) => this.showGame(loadout)
    });

    this.screen = 'menu';
    document.getElementById('playBtn').addEventListener('click', () => this.showMode());
    document.getElementById('singleBtn').addEventListener('click', () => this.showCustomize());

    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Escape') return;
      if (this.screen === 'game') this.showMenu();
      else if (this.screen === 'custom') this.showMode();
      else if (this.screen === 'mode') this.showMenu();
    });
  }

  hideScreens() {
    this.menu.classList.add('hidden');
    this.modeScreen.classList.add('hidden');
    this.customScreen.classList.add('hidden');
  }

  showMenu() {
    this.screen = 'menu';
    this.hideScreens();
    this.menu.classList.remove('hidden');
    this.game.setActive(false);
  }

  showMode() {
    this.screen = 'mode';
    this.hideScreens();
    this.modeScreen.classList.remove('hidden');
    this.game.setActive(false);
  }

  showCustomize() {
    this.screen = 'custom';
    this.hideScreens();
    this.customScreen.classList.remove('hidden');
    this.game.setActive(false);
  }

  showGame(loadout = null) {
    this.screen = 'game';
    this.hideScreens();
    if (loadout) this.game.applyLoadout(loadout);
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
