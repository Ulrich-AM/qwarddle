'use strict';

const Language = {
  current:{"meta":{"name":"English","code":"en"},"ui":{"menu":{"play":"PLAY"},"mode":{"title":"PLAY","solo":"SOLO","local":"LOCAL","online":"ONLINE"},"maps":{"title":"MAP","continue":"CONTINUE"},"customize":{"title":"CUSTOMIZE","weapons":"WEAPONS","colors":"COLORS","continue":"FIGHT","body":"BODY","arms":"ARMS","legs":"LEGS","moveset":"MOVESET"}},"weapons":{"revolver":{"name":"REVOLVER","description":"A six-shot revolver built around timing, recoil, and loaded-round order.","moves":[{"input":"LEFT CLICK","name":"FIRE","description":"Fire the next round. The revolver must finish its spin before it can fire again."},{"input":"Q","name":"RELOAD","description":"Reload missing normal rounds. Reloading also grants 15 temporary health and 25% damage reduction for 1 second."},{"input":"E","name":"CHARGED LOAD","description":"At full charge, dump the cylinder and load six charged rounds with extreme recoil."}]},"wand":{"name":"WAND","description":"A light magic weapon that throws spinning stars with strange movement.","moves":[{"input":"LEFT CLICK","name":"STAR","description":"Fire a small spinning star that passes through walls."},{"input":"Q","name":"HOMING STARS","description":"Fire three small stars with slight homing. They fade away after a few seconds."},{"input":"E","name":"BOUNCING STAR","description":"At full charge, fire a large star that ricochets once, then bursts into twelve smaller stars on its next wall impact."}]},"sake":{"name":"SAKE","description":"A difficult stance weapon built around drinking, spills, buffs, and a dangerous drunk state.","moves":[{"input":"LEFT CLICK","name":"DRINK / GOURD THROW","description":"Normally, pull the gourd to your mouth and drink once every 5 seconds. Each drink fills one of 8 drunk slots and gives an equal chance at +25% melee damage, +25% defense, or 8 health regenerated over 5 seconds. At 8 slots you automatically enter the drunk state. While drunk, LMB throws the gourd toward the cursor every 3 seconds."},{"input":"Q","name":"SAKE SPIT / SAKE SPILL","description":"For 5 seconds after drinking, Q spits a messy fading cone of sake droplets with a 4 second cooldown. After that mouthful expires, Q tips the gourd and spills sake onto the ground with a 5 second cooldown, creating a slippery damaging puddle."},{"input":"E","name":"CHUG","description":"Every 25 seconds, pull the gourd to your mouth and chug to enter a 15 second drunk state with +50% damage, defense, movement, and jump strength. Normal Q and E are disabled while drunk."}]}}},
  fallback:{"meta":{"name":"English","code":"en"},"ui":{"menu":{"play":"PLAY"},"mode":{"title":"PLAY","solo":"SOLO","local":"LOCAL","online":"ONLINE"},"maps":{"title":"MAP","continue":"CONTINUE"},"customize":{"title":"CUSTOMIZE","weapons":"WEAPONS","colors":"COLORS","continue":"FIGHT","body":"BODY","arms":"ARMS","legs":"LEGS","moveset":"MOVESET"}},"weapons":{"revolver":{"name":"REVOLVER","description":"A six-shot revolver built around timing, recoil, and loaded-round order.","moves":[{"input":"LEFT CLICK","name":"FIRE","description":"Fire the next round. The revolver must finish its spin before it can fire again."},{"input":"Q","name":"RELOAD","description":"Reload missing normal rounds. Reloading also grants 15 temporary health and 25% damage reduction for 1 second."},{"input":"E","name":"CHARGED LOAD","description":"At full charge, dump the cylinder and load six charged rounds with extreme recoil."}]},"wand":{"name":"WAND","description":"A light magic weapon that throws spinning stars with strange movement.","moves":[{"input":"LEFT CLICK","name":"STAR","description":"Fire a small spinning star that passes through walls."},{"input":"Q","name":"HOMING STARS","description":"Fire three small stars with slight homing. They fade away after a few seconds."},{"input":"E","name":"BOUNCING STAR","description":"At full charge, fire a large star that ricochets once, then bursts into twelve smaller stars on its next wall impact."}]},"sake":{"name":"SAKE","description":"A difficult stance weapon built around drinking, spills, buffs, and a dangerous drunk state.","moves":[{"input":"LEFT CLICK","name":"DRINK / GOURD THROW","description":"Normally, pull the gourd to your mouth and drink once every 5 seconds. Each drink fills one of 8 drunk slots and gives an equal chance at +25% melee damage, +25% defense, or 8 health regenerated over 5 seconds. At 8 slots you automatically enter the drunk state. While drunk, LMB throws the gourd toward the cursor every 3 seconds."},{"input":"Q","name":"SAKE SPIT / SAKE SPILL","description":"For 5 seconds after drinking, Q spits a messy fading cone of sake droplets with a 4 second cooldown. After that mouthful expires, Q tips the gourd and spills sake onto the ground with a 5 second cooldown, creating a slippery damaging puddle."},{"input":"E","name":"CHUG","description":"Every 25 seconds, pull the gourd to your mouth and chug to enter a 15 second drunk state with +50% damage, defense, movement, and jump strength. Normal Q and E are disabled while drunk."}]}}},

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
