'use strict';

class LanApi {
  static async request(path, options = {}) {
    const response = await fetch(path, {
      cache:'no-store',
      headers:{
        'Content-Type':'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    let payload = {};
    try { payload = await response.json(); } catch (_) {}

    if (!response.ok) {
      throw new Error(payload.error || `LAN request failed (${response.status})`);
    }
    return payload;
  }

  static listRooms() {
    return this.request('/api/rooms');
  }

  static createRoom({ name, nickname, password }) {
    return this.request('/api/rooms', {
      method:'POST',
      body:JSON.stringify({ name, nickname, password })
    });
  }

  static joinRoom(roomId, { nickname, password }) {
    return this.request(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
      method:'POST',
      body:JSON.stringify({ nickname, password })
    });
  }

  static sendSignal(roomId, role, token, data) {
    return this.request(`/api/rooms/${encodeURIComponent(roomId)}/signal`, {
      method:'POST',
      body:JSON.stringify({ role, token, data })
    });
  }

  static pollSignals(roomId, role, token, after = 0) {
    const query = new URLSearchParams({
      role,
      token,
      after:String(after)
    });
    return this.request(
      `/api/rooms/${encodeURIComponent(roomId)}/signal?${query.toString()}`
    );
  }

  static leave(roomId, role, token) {
    return this.request(`/api/rooms/${encodeURIComponent(roomId)}/leave`, {
      method:'POST',
      body:JSON.stringify({ role, token })
    }).catch(() => null);
  }
}

class LanRemoteInput {
  constructor(video, send) {
    this.video = video;
    this.send = send;
    this.keys = new Set();
    this.mouseDown = false;
    this.rightMouseDown = false;
    this.aimX = 0.5;
    this.aimY = 0.5;
    this.sequence = 0;
    this.active = false;
    this.raf = 0;

    this.onKeyDown = (event) => {
      if (!this.active) return;
      this.keys.add(event.code);
      if ([
        'KeyW','KeyA','KeyS','KeyD',
        'ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
        'Space','KeyQ','KeyE','ShiftLeft','ShiftRight'
      ].includes(event.code)) event.preventDefault();
    };

    this.onKeyUp = (event) => {
      this.keys.delete(event.code);
    };

    this.onMouseMove = (event) => {
      if (!this.active) return;
      this.updateAim(event.clientX, event.clientY);
    };

    this.onMouseDown = (event) => {
      if (!this.active) return;

      if (event.button === 0) this.mouseDown = true;
      if (event.button === 2) this.rightMouseDown = true;
      if (event.button !== 0 && event.button !== 2) return;

      this.updateAim(event.clientX, event.clientY);
      event.preventDefault();
    };

    this.onMouseUp = (event) => {
      if (event.button === 0) this.mouseDown = false;
      if (event.button === 2) this.rightMouseDown = false;
    };

    this.onBlur = () => this.clear();
    this.onContextMenu = (event) => event.preventDefault();
  }

  clear() {
    this.keys.clear();
    this.mouseDown = false;
    this.rightMouseDown = false;
  }

  updateAim(clientX, clientY) {
    const rect = this.video.getBoundingClientRect();
    const sourceW = this.video.videoWidth || rect.width || 1;
    const sourceH = this.video.videoHeight || rect.height || 1;

    const scale = Math.min(
      rect.width / Math.max(1, sourceW),
      rect.height / Math.max(1, sourceH)
    );
    const contentW = sourceW * scale;
    const contentH = sourceH * scale;
    const left = rect.left + (rect.width - contentW) * 0.5;
    const top = rect.top + (rect.height - contentH) * 0.5;

    this.aimX = MathEx.clamp((clientX - left) / Math.max(1, contentW), 0, 1);
    this.aimY = MathEx.clamp((clientY - top) / Math.max(1, contentH), 0, 1);
  }

  key(...codes) {
    return codes.some((code) => this.keys.has(code));
  }

  state() {
    const left = this.key('KeyA','ArrowLeft');
    const right = this.key('KeyD','ArrowRight');

    return {
      type:'input',
      seq:++this.sequence,
      moveX:(right ? 1 : 0) - (left ? 1 : 0),
      jump:this.key('KeyW','ArrowUp','Space'),
      run:this.key('ShiftLeft','ShiftRight'),
      attack1:this.mouseDown,
      attack2:this.key('KeyQ'),
      attack3:this.key('KeyE'),
      defense:this.rightMouseDown,
      aimX:this.aimX,
      aimY:this.aimY
    };
  }

  tick = () => {
    if (!this.active) return;
    this.send(this.state());
    this.raf = requestAnimationFrame(this.tick);
  };

  start() {
    if (this.active) return;
    this.active = true;
    window.addEventListener('keydown', this.onKeyDown, { passive:false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('blur', this.onBlur);
    this.video.addEventListener('mousemove', this.onMouseMove);
    this.video.addEventListener('mousedown', this.onMouseDown);
    this.video.addEventListener('contextmenu', this.onContextMenu);
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.clear();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('blur', this.onBlur);
    this.video.removeEventListener('mousemove', this.onMouseMove);
    this.video.removeEventListener('mousedown', this.onMouseDown);
    this.video.removeEventListener('contextmenu', this.onContextMenu);
  }
}

class LanPeer {
  constructor({
    role,
    roomId,
    token,
    nickname,
    canvas = null,
    video = null,
    loadout = null,
    onInput = null,
    onLoadout = null,
    onNickname = null,
    onStatus = null
  }) {
    this.role = role;
    this.roomId = roomId;
    this.token = token;
    this.nickname = nickname || (role === 'host' ? 'HOST' : 'GUEST');
    this.canvas = canvas;
    this.video = video;
    this.loadout = loadout;
    this.onInput = onInput;
    this.onLoadout = onLoadout;
    this.onNickname = onNickname;
    this.onStatus = onStatus;

    this.pc = null;
    this.channel = null;
    this.input = null;
    this.closed = false;
    this.lastSignal = 0;
    this.pollTimer = 0;
    this.pollBusy = false;
    this.pendingCandidates = [];
    this.hasRemoteDescription = false;
  }

  status(text) {
    this.onStatus?.(text);
  }

  async start() {
    if (!window.RTCPeerConnection) {
      throw new Error('WebRTC is not available in this browser.');
    }

    this.pc = new RTCPeerConnection({ iceServers:[] });
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState || 'closed';
      if (state === 'connected') this.status('CONNECTED');
      else if (state === 'failed') this.status('CONNECTION FAILED');
      else if (state === 'disconnected') this.status('DISCONNECTED');
      else if (state === 'connecting') this.status('CONNECTING...');
    };

    this.pc.onicecandidate = (event) => {
      if (!event.candidate || this.closed) return;
      this.signal({
        type:'candidate',
        candidate:event.candidate.toJSON?.() || event.candidate
      });
    };

    if (this.role === 'host') {
      await this.startHost();
    } else {
      await this.startClient();
    }

    this.schedulePoll(0);
  }

  async startHost() {
    if (!this.canvas?.captureStream) {
      throw new Error('Canvas streaming is not supported in this browser.');
    }

    const stream = this.canvas.captureStream(60);
    for (const track of stream.getTracks()) {
      this.pc.addTrack(track, stream);
    }

    this.bindChannel(this.pc.createDataChannel('qwarddle', {
      ordered:true
    }));

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.signal({
      type:'offer',
      description:this.pc.localDescription
    });
    this.status('WAITING FOR P2...');
  }

  async startClient() {
    if (!this.video) throw new Error('LAN client video element is missing.');

    this.video.muted = true;
    this.video.autoplay = true;
    this.video.playsInline = true;

    this.pc.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (!stream) return;
      this.video.srcObject = stream;
      this.video.play().catch(() => null);
    };

    this.pc.ondatachannel = (event) => {
      this.bindChannel(event.channel);
    };

    this.status('FINDING HOST...');
  }

  bindChannel(channel) {
    this.channel = channel;

    channel.onopen = () => {
      this.status('CONNECTED');
      this.send({
        type:'hello',
        nickname:this.nickname,
        loadout:this.loadout || null
      });

      if (this.role === 'client' && this.video) {
        this.input = new LanRemoteInput(
          this.video,
          (message) => this.send(message)
        );
        this.input.start();
      }
    };

    channel.onclose = () => {
      if (!this.closed) this.status('DISCONNECTED');
      this.input?.stop();
    };

    channel.onerror = () => {
      if (!this.closed) this.status('DATA CHANNEL ERROR');
    };

    channel.onmessage = (event) => {
      let message = null;
      try { message = JSON.parse(event.data); } catch (_) { return; }
      if (!message || typeof message !== 'object') return;

      if (message.type === 'input' && this.role === 'host') {
        this.onInput?.(message);
      } else if (message.type === 'hello') {
        if (message.nickname) this.onNickname?.(String(message.nickname).slice(0, 16));
        if (message.loadout) this.onLoadout?.(message.loadout);
      } else if (message.type === 'loadout') {
        this.onLoadout?.(message.loadout);
      }
    };
  }

  send(message) {
    if (!this.channel || this.channel.readyState !== 'open') return false;
    try {
      this.channel.send(JSON.stringify(message));
      return true;
    } catch (_) {
      return false;
    }
  }

  async signal(data) {
    if (this.closed) return;
    await LanApi.sendSignal(
      this.roomId,
      this.role,
      this.token,
      data
    );
  }

  schedulePoll(delay = 180) {
    if (this.closed) return;
    clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => this.pollSignals(), delay);
  }

  async pollSignals() {
    if (this.closed || this.pollBusy) return;
    this.pollBusy = true;

    try {
      const result = await LanApi.pollSignals(
        this.roomId,
        this.role,
        this.token,
        this.lastSignal
      );

      for (const message of result.messages || []) {
        this.lastSignal = Math.max(this.lastSignal, message.seq || 0);
        await this.handleSignal(message.data);
      }
    } catch (error) {
      if (!this.closed) this.status(error.message || 'LAN SIGNAL ERROR');
    } finally {
      this.pollBusy = false;
      this.schedulePoll();
    }
  }

  async handleSignal(signal) {
    if (!signal || !this.pc) return;

    if (signal.type === 'offer' && this.role === 'client') {
      if (this.hasRemoteDescription) return;
      await this.pc.setRemoteDescription(signal.description);
      this.hasRemoteDescription = true;
      await this.flushCandidates();

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      await this.signal({
        type:'answer',
        description:this.pc.localDescription
      });
      this.status('CONNECTING...');
      return;
    }

    if (signal.type === 'answer' && this.role === 'host') {
      if (this.hasRemoteDescription) return;
      await this.pc.setRemoteDescription(signal.description);
      this.hasRemoteDescription = true;
      await this.flushCandidates();
      this.status('CONNECTING...');
      return;
    }

    if (signal.type === 'candidate' && signal.candidate) {
      if (!this.hasRemoteDescription) {
        this.pendingCandidates.push(signal.candidate);
      } else {
        await this.pc.addIceCandidate(signal.candidate).catch(() => null);
      }
    }
  }

  async flushCandidates() {
    const candidates = this.pendingCandidates.splice(0);
    for (const candidate of candidates) {
      await this.pc.addIceCandidate(candidate).catch(() => null);
    }
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.pollTimer);
    this.input?.stop();

    try { this.channel?.close(); } catch (_) {}
    try { this.pc?.close(); } catch (_) {}

    if (this.video) this.video.srcObject = null;
    await LanApi.leave(this.roomId, this.role, this.token);
  }
}
