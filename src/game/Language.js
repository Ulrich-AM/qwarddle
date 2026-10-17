'use strict';

const Language = {
  current:{"meta":{"name":"English","code":"en"},"ui":{"menu":{"play":"PLAY"},"mode":{"title":"PLAY","solo":"SOLO","local":"LOCAL","online":"ONLINE"},"maps":{"title":"MAP","continue":"CONTINUE"},"customize":{"title":"CUSTOMIZE","weapons":"WEAPONS","colors":"COLORS","continue":"FIGHT","body":"BODY","arms":"ARMS","legs":"LEGS","moveset":"MOVESET"}},"weapons":{"revolver":{"name":"REVOLVER","description":"A six-shot revolver built around timing, recoil, and loaded-round order.","moves":[{"input":"LEFT CLICK","name":"FIRE","description":"Fire the next round. The revolver must finish its spin before it can fire again."},{"input":"Q","name":"RELOAD","description":"Fill empty chambers with normal rounds without replacing charged rounds."},{"input":"E","name":"CHARGED LOAD","description":"Dump the cylinder and load six charged rounds with extreme recoil."}]},"wand":{"name":"WAND","description":"A light magic weapon that throws spinning stars with strange movement.","moves":[{"input":"LEFT CLICK","name":"STAR","description":"Fire a small spinning star that passes through walls."},{"input":"Q","name":"BOUNCING STAR","description":"Fire a large star that ricochets once based on its impact angle, then bursts into six smaller stars on its next wall impact."},{"input":"E","name":"HOMING STARS","description":"Fire three small stars with slight homing. They fade away after a few seconds."}]}}},
  fallback:{"meta":{"name":"English","code":"en"},"ui":{"menu":{"play":"PLAY"},"mode":{"title":"PLAY","solo":"SOLO","local":"LOCAL","online":"ONLINE"},"maps":{"title":"MAP","continue":"CONTINUE"},"customize":{"title":"CUSTOMIZE","weapons":"WEAPONS","colors":"COLORS","continue":"FIGHT","body":"BODY","arms":"ARMS","legs":"LEGS","moveset":"MOVESET"}},"weapons":{"revolver":{"name":"REVOLVER","description":"A six-shot revolver built around timing, recoil, and loaded-round order.","moves":[{"input":"LEFT CLICK","name":"FIRE","description":"Fire the next round. The revolver must finish its spin before it can fire again."},{"input":"Q","name":"RELOAD","description":"Fill empty chambers with normal rounds without replacing charged rounds."},{"input":"E","name":"CHARGED LOAD","description":"Dump the cylinder and load six charged rounds with extreme recoil."}]},"wand":{"name":"WAND","description":"A light magic weapon that throws spinning stars with strange movement.","moves":[{"input":"LEFT CLICK","name":"STAR","description":"Fire a small spinning star that passes through walls."},{"input":"Q","name":"BOUNCING STAR","description":"Fire a large star that ricochets once based on its impact angle, then bursts into six smaller stars on its next wall impact."},{"input":"E","name":"HOMING STARS","description":"Fire three small stars with slight homing. They fade away after a few seconds."}]}}},

  async load(name = 'english') {
    this.current = this.fallback;
    if (window.location.protocol === 'file:') return this.current;
    try {
      const response = await fetch(`assets/language/language-${name}.json`, { cache:'no-store' });
      if (response.ok) this.current = await response.json();
    } catch (_) {
      this.current = this.fallback;
    }
    return this.current;
  },

  t(path, fallback = '') {
    const value = path.split('.').reduce((node, key) => node && node[key], this.current);
    return typeof value === 'string' ? value : fallback;
  },

  weapon(id) {
    return this.current?.weapons?.[id] || this.fallback?.weapons?.[id] || { name:id.toUpperCase(), description:'', moves:[] };
  },

  applyDocument(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((element) => {
      const value = this.t(element.dataset.i18n, element.textContent);
      element.textContent = value;
    });
  }
};
