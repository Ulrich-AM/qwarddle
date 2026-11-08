'use strict';

class App {
  constructor() {
    this.menu = document.getElementById('menu');
    this.modeScreen = document.getElementById('modeScreen');
    this.localScreen = document.getElementById('localScreen');
    this.lanScreen = document.getElementById('lanScreen');
    this.lanClientScreen = document.getElementById('lanClientScreen');
    this.mapScreen = document.getElementById('mapScreen');
    this.customScreen = document.getElementById('customScreen');
    this.gameCanvas = document.getElementById('game');
    this.lanVideo = document.getElementById('lanVideo');
    this.dizzyOverlay = document.getElementById('dizzyOverlay');
    this.lanDizzyOverlay = document.getElementById('lanDizzyOverlay');
    this.gameNauseaWarp = new NauseaWarp(
      this.gameCanvas, document.getElementById('gameNauseaWarp')
    );
    this.lanNauseaWarp = new NauseaWarp(
      this.lanVideo, document.getElementById('lanNauseaWarp')
    );

    this.game = new Game(this.gameCanvas);
    this.game.onDizzySnapshot = (p1, p2, purple1, purple2) => {
      this.updateDizzyOverlay(this.dizzyOverlay, p1, purple1);
      this.gameNauseaWarp.setIntensity(p1, purple1);
      if (this.screen === 'game' && this.selectedMode === 'lan-host') {
        this.lanPeer?.send?.({
          type:'status-effects',
          dizzy:p2,
          purple:purple2
        });
      }
    };
    this.menuDemo = new MenuDemo(document.getElementById('menuDemo'), { interactive:true });
    this.customDemo = new MenuDemo(document.getElementById('customDemo'), {
      interactive:false,
      stationaryShowcase:true
    });

    this.selectedMapId = MapRegistry.list[0]?.id || null;
    this.selectedMode = 'solo';
    this.cpuDifficulty = 'normal';
    this.cpuWeapon = 'mushroom';
    this.cpuSettings = document.getElementById('cpuSettings');
    this.lanRoom = null;
    this.pendingLanJoin = null;
    this.lanPeer = null;

    this.nicknameInput = document.getElementById('nicknameInput');
    try {
      const savedNickname = localStorage.getItem('qwarddle.nickname');
      if (savedNickname) this.nicknameInput.value = savedNickname.slice(0, 16);
    } catch (_) {}

    this.nicknameInput.addEventListener('input', () => {
      try { localStorage.setItem('qwarddle.nickname', this.nickname()); } catch (_) {}
    });

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
      onContinue:(selection) => this.handleCustomizationContinue(selection)
    });

    this.screen = 'menu';

    document.getElementById('playBtn').addEventListener('click', () => this.showMode());
    document.getElementById('menuHomeBtn').addEventListener('click', () => this.showMenu());
    document.getElementById('menuQuickPlayBtn').addEventListener('click', () => this.showMode());
    document.getElementById('menuLocalBtn').addEventListener('click', () => this.showLocal());
    document.getElementById('menuSoloBtn').addEventListener('click', () => {
      this.selectedMode = 'solo';
      this.showMaps();
    });
    document.getElementById('menuCouchBtn').addEventListener('click', () => {
      this.selectedMode = 'couch';
      this.showMaps();
    });
    document.getElementById('menuLanBtn').addEventListener('click', () => this.showLan());
    document.getElementById('singleBtn').addEventListener('click', () => {
      this.selectedMode = 'solo';
      this.showMaps();
    });
    document.getElementById('vsCpuBtn').addEventListener('click', () => {
      this.cpuSettings.classList.remove('hidden');
      document.getElementById('cpuStartBtn').focus();
    });
    document.getElementById('cpuStartBtn').addEventListener('click', () => {
      this.selectedMode = 'cpu';
      this.cpuDifficulty = document.getElementById('cpuDifficulty').value;
      const choice = document.getElementById('cpuWeapon').value;
      this.cpuWeapon = WeaponRegistry.list.some(w => w.id === choice)
        ? choice : 'mushroom';
      this.showMaps();
    });
    document.getElementById('localBtn').addEventListener('click', () => this.showLocal());
    document.getElementById('couchBtn').addEventListener('click', () => {
      this.selectedMode = 'couch';
      this.showMaps();
    });
    document.getElementById('lanBtn').addEventListener('click', () => this.showLan());
    document.getElementById('lanRefreshBtn').addEventListener('click', () => this.refreshLanRooms());
    document.getElementById('lanHostBtn').addEventListener('click', () => this.createLanRoom());

    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Escape') return;

      if (this.screen === 'lan-client') {
        this.stopLanSession();
        this.showLan();
      } else if (this.screen === 'game') {
        this.stopLanSession();
        this.showMenu();
      } else if (this.screen === 'custom') {
        if (this.selectedMode === 'lan-client') {
          this.stopLanSession();
          this.showLan();
        } else if (MapRegistry.list.length === 1) {
          // One map skips selection automatically; Escape must not loop
          // straight back into the customization screen.
          if (this.selectedMode === 'couch') this.showLocal();
          else if (this.selectedMode === 'lan-host') this.showLan();
          else this.showMode();
        } else {
          this.showMaps();
        }
      } else if (this.screen === 'map') {
        if (this.selectedMode === 'couch') {
          this.showLocal();
        } else if (this.selectedMode === 'lan-host') {
          this.stopLanSession();
          this.showLan();
        } else {
          this.showMode();
        }
      } else if (this.screen === 'lan') {
        this.showLocal();
      } else if (this.screen === 'local') {
        this.showMode();
      } else if (this.screen === 'mode') {
        this.showMenu();
      }
    });

    window.addEventListener('beforeunload', () => {
      this.stopLanSession();
    });
  }

  nickname() {
    const clean = String(this.nicknameInput?.value || 'QWARD')
      .trim()
      .replace(/[\x00-\x1f\x7f]/g, '')
      .slice(0, 16);
    return clean || 'QWARD';
  }

  updateDizzyOverlay(element, opacity = 0, purple = 0) {
    if (!element) return;
    const dizzyAmount = MathEx.clamp(Number(opacity) || 0, 0, 0.45);
    const purpleAmount = MathEx.clamp(Number(purple) || 0, 0, 0.45);
    const amount = Math.max(dizzyAmount, purpleAmount);
    element.style.opacity = String(amount);
    element.classList.toggle('active', amount > 0);
    element.classList.toggle('purple', purpleAmount > 0);
  }

  hideScreens() {
    this.updateDizzyOverlay(this.dizzyOverlay, 0);
    this.updateDizzyOverlay(this.lanDizzyOverlay, 0);
    this.gameNauseaWarp.setIntensity(0, 0);
    this.lanNauseaWarp.setIntensity(0, 0);
    this.menu.classList.add('hidden');
    this.modeScreen.classList.add('hidden');
    this.localScreen.classList.add('hidden');
    this.lanScreen.classList.add('hidden');
    this.lanClientScreen.classList.add('hidden');
    this.mapScreen.classList.add('hidden');
    this.customScreen.classList.add('hidden');
  }

  setDemos(menu, custom) {
    this.menuDemo.setActive(menu);
    this.customDemo.setActive(custom);
  }

  showMenu() {
    this.screen = 'menu';
    this.hideScreens();
    this.menu.classList.remove('hidden');
    this.game.setActive(false);
    this.setDemos(true, false);
  }

  showMode() {
    this.screen = 'mode';
    this.hideScreens();
    this.cpuSettings.classList.add('hidden');
    this.modeScreen.classList.remove('hidden');
    this.game.setActive(false);
    this.setDemos(false, false);
  }

  showLocal() {
    this.screen = 'local';
    this.hideScreens();
    this.localScreen.classList.remove('hidden');
    this.game.setActive(false);
    this.setDemos(false, false);
  }

  showLan() {
    this.screen = 'lan';
    this.hideScreens();
    this.lanScreen.classList.remove('hidden');
    this.game.setActive(false);
    this.setDemos(false, false);

    const roomName = document.getElementById('lanRoomName');
    if (!roomName.value.trim()) roomName.value = `${this.nickname()}'s game`;
    this.refreshLanRooms();
  }

  showMaps() {
    if (MapRegistry.list.length === 1) {
      this.selectedMapId = MapRegistry.list[0].id;
      this.showCustomize();
      return;
    }

    this.screen = 'map';
    this.hideScreens();
    this.mapScreen.classList.remove('hidden');
    this.game.setActive(false);
    this.setDemos(false, false);
  }

  showCustomize() {
    this.screen = 'custom';
    this.hideScreens();
    this.customScreen.classList.remove('hidden');
    this.game.setActive(false);
    this.setDemos(false, true);
    this.customization.setMode(this.selectedMode);
  }

  lanAvailable() {
    return window.location.protocol === 'http:' || window.location.protocol === 'https:';
  }

  lanUnavailableMessage() {
    return 'LAN needs the companion server. Run: py lan_server.py';
  }

  async createLanRoom() {
    const status = document.getElementById('lanHostStatus');
    if (!this.lanAvailable()) {
      status.textContent = this.lanUnavailableMessage();
      return;
    }

    status.textContent = 'CREATING ROOM...';

    try {
      const room = await LanApi.createRoom({
        name:document.getElementById('lanRoomName').value,
        nickname:this.nickname(),
        password:document.getElementById('lanHostPassword').value
      });

      this.lanRoom = {
        id:room.id,
        name:room.name,
        role:'host',
        token:room.hostToken
      };
      this.pendingLanJoin = null;
      this.selectedMode = 'lan-host';
      status.textContent = `ROOM ${room.id} READY`;
      this.showMaps();
    } catch (error) {
      status.textContent = error.message || 'COULD NOT CREATE ROOM';
    }
  }

  async refreshLanRooms() {
    const list = document.getElementById('lanRoomList');
    const status = document.getElementById('lanJoinStatus');
    list.innerHTML = '';

    if (!this.lanAvailable()) {
      status.textContent = this.lanUnavailableMessage();
      return;
    }

    status.textContent = 'SEARCHING...';

    try {
      const result = await LanApi.listRooms();
      const rooms = result.rooms || [];

      if (!rooms.length) {
        status.textContent = 'NO ROOMS ON THIS LAN SERVER';
        return;
      }

      status.textContent = '';
      for (const room of rooms) {
        const row = document.createElement('div');
        row.className = 'lanRoom';

        const info = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'lanRoomTitle';
        title.textContent = room.name;

        const meta = document.createElement('div');
        meta.className = 'lanRoomMeta';
        meta.textContent = `${room.hostNickname}  |  ${room.players}/${room.capacity}${room.locked ? '  |  LOCKED' : ''}  |  ${room.id}`;

        info.append(title, meta);

        const join = document.createElement('button');
        join.className = 'lanJoinBtn';
        join.textContent = room.players >= room.capacity ? 'FULL' : 'JOIN';
        join.disabled = room.players >= room.capacity;
        join.addEventListener('click', () => this.joinLanRoom(room));

        row.append(info, join);
        list.appendChild(row);
      }
    } catch (error) {
      status.textContent = error.message || 'LAN SERVER NOT FOUND';
    }
  }

  async joinLanRoom(room) {
    const status = document.getElementById('lanJoinStatus');
    status.textContent = 'JOINING...';

    try {
      const joined = await LanApi.joinRoom(room.id, {
        nickname:this.nickname(),
        password:document.getElementById('lanJoinPassword').value
      });

      this.pendingLanJoin = {
        id:joined.id,
        name:joined.name,
        role:'client',
        token:joined.clientToken,
        hostNickname:joined.hostNickname
      };
      this.lanRoom = null;
      this.selectedMode = 'lan-client';
      status.textContent = `JOINED ${joined.name}`;
      this.showCustomize();
    } catch (error) {
      status.textContent = error.message || 'COULD NOT JOIN ROOM';
    }
  }

  handleCustomizationContinue(selection) {
    if (this.selectedMode === 'lan-client') {
      this.startLanClient(selection);
      return;
    }

    if (this.selectedMode === 'couch') {
      this.showGame(selection?.p1, selection?.p2);
      return;
    }

    this.showGame(selection);
  }

  showGame(p1Loadout = null, p2Loadout = null) {
    this.screen = 'game';
    this.hideScreens();

    this.game.setCpuDifficulty(this.cpuDifficulty);
    this.game.setMode(this.selectedMode);
    this.game.applyMap(this.selectedMapId);
    if (p1Loadout) this.game.applyFighterLoadout(0, p1Loadout);
    if (this.selectedMode === 'cpu') {
      this.game.applyFighterLoadout(1, { weapon:this.cpuWeapon });
    } else if (this.selectedMode === 'solo') {
      this.game.applyFighterLoadout(1, { weapon:'revolver' });
    } else if (p2Loadout) {
      this.game.applyFighterLoadout(1, p2Loadout);
    }

    this.game.setNickname(0, this.nickname());
    this.game.setNickname(1, this.selectedMode === 'cpu' ? 'CPU' : 'P2');

    this.setDemos(false, false);
    this.game.setActive(true);
    this.game.reset();

    if (this.selectedMode === 'lan-host') {
      this.startLanHost();
    }
  }

  async startLanHost() {
    if (!this.lanRoom) return;

    await this.stopLanPeerOnly();

    const status = document.getElementById('lanHostStatus');
    const peer = new LanPeer({
      role:'host',
      roomId:this.lanRoom.id,
      token:this.lanRoom.token,
      nickname:this.nickname(),
      canvas:this.gameCanvas,
      onInput:(state) => {
        this.game.getNetworkController()?.applyRemoteInput(state);
      },
      onLoadout:(loadout) => {
        this.game.applyFighterLoadout(1, loadout);
      },
      onNickname:(nickname) => {
        this.game.setNickname(1, nickname);
      },
      onStatus:(message) => {
        status.textContent = `ROOM ${this.lanRoom?.id || ''}: ${message}`;
      }
    });

    this.lanPeer = peer;
    try {
      await peer.start();
    } catch (error) {
      status.textContent = error.message || 'LAN HOST ERROR';
    }
  }

  async startLanClient(loadout) {
    if (!this.pendingLanJoin) return;

    await this.stopLanPeerOnly();

    this.screen = 'lan-client';
    this.hideScreens();
    this.lanClientScreen.classList.remove('hidden');
    this.game.setActive(false);
    this.setDemos(false, false);

    const status = document.getElementById('lanClientStatus');
    status.textContent = 'CONNECTING...';

    const peer = new LanPeer({
      role:'client',
      roomId:this.pendingLanJoin.id,
      token:this.pendingLanJoin.token,
      nickname:this.nickname(),
      video:this.lanVideo,
      loadout,
      onStatusEffects:(state) => {
        this.updateDizzyOverlay(this.lanDizzyOverlay, state?.dizzy, state?.purple);
        this.lanNauseaWarp.setIntensity(state?.dizzy, state?.purple);
      },
      onStatus:(message) => {
        status.textContent = message;
      }
    });

    this.lanPeer = peer;
    try {
      await peer.start();
    } catch (error) {
      status.textContent = error.message || 'LAN CLIENT ERROR';
    }
  }

  async stopLanPeerOnly() {
    if (!this.lanPeer) return;
    const peer = this.lanPeer;
    this.lanPeer = null;
    await peer.close().catch(() => null);
  }

  async stopLanSession() {
    const room = this.lanRoom;
    const pending = this.pendingLanJoin;
    const hadPeer = !!this.lanPeer;

    await this.stopLanPeerOnly();

    if (!hadPeer && room) {
      await LanApi.leave(room.id, 'host', room.token).catch(() => null);
    }
    if (!hadPeer && pending) {
      await LanApi.leave(pending.id, 'client', pending.token).catch(() => null);
    }

    this.lanRoom = null;
    this.pendingLanJoin = null;
  }

  start() {
    this.game.start();
    this.menuDemo.start();
    this.customDemo.start();
    this.showMenu();
  }
}
