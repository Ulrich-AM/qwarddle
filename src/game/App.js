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

    this.game = new Game(this.gameCanvas);
    this.menuDemo = new MenuDemo(document.getElementById('menuDemo'), { interactive:true });
    this.customDemo = new MenuDemo(document.getElementById('customDemo'), {
      interactive:false,
      stationaryShowcase:true
    });

    this.selectedMapId = MapRegistry.list[0]?.id || null;
    this.selectedMode = 'solo';
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
    document.getElementById('singleBtn').addEventListener('click', () => {
      this.selectedMode = 'solo';
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

  hideScreens() {
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

    this.game.setMode(this.selectedMode);
    this.game.applyMap(this.selectedMapId);
    if (p1Loadout) this.game.applyFighterLoadout(0, p1Loadout);
    if (p2Loadout) this.game.applyFighterLoadout(1, p2Loadout);

    this.game.setNickname(0, this.nickname());
    if (this.selectedMode === 'couch') this.game.setNickname(1, 'P2');

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
