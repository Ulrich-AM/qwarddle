'use strict';

class FighterGameView {
  constructor(game, slot) {
    this.game = game;
    this.slot = slot;
  }

  get terrain() { return this.game.terrain; }

  gainCharge(amount) {
    this.game.gainCharge(this.slot, amount);
  }

  hasFullCharge() {
    return this.game.hasFullCharge(this.slot);
  }

  consumeFullCharge() {
    return this.game.consumeFullCharge(this.slot);
  }

  getTargetableActors() {
    return this.game.getTargetableActors(this.slot);
  }

  getHazardActors() {
    return this.game.getHazardActors();
  }

  addHazard(hazard) {
    return this.game.addHazard(hazard);
  }

  knockDownActor(actor, duration) {
    return this.game.knockDownActor(actor, duration);
  }

  addStatusVisual(actor, spritePath, duration, key, options) {
    return this.game.addStatusVisual(actor, spritePath, duration, key, options);
  }

  removeStatusVisual(actor, key) {
    return this.game.removeStatusVisual(actor, key);
  }

  // Kept under the weapon-facing name used by Dagger. Internally this is no
  // longer player-specific: either fighter slot can own the attack ragdoll.
  startPlayerAttackRagdoll(options) {
    return this.game.startAttackRagdoll(this.slot, options);
  }
}

class FighterSlot {
  constructor({
    id,
    index,
    actor,
    controller,
    loadout,
    maxCharge = 100
  }) {
    this.id = id;
    this.index = index;
    this.actor = actor;
    this.controller = controller;
    this.loadout = loadout;

    this.maxCharge = maxCharge;
    this.charge = 0;

    this.ragdoll = null;
    this.respawnRemaining = 0;

    this.knockdown = null;
    this.knockdownRemaining = 0;

    this.attackRagdoll = null;
    this.attackRemaining = 0;
    this.attackData = null;

    this.gameView = null;
  }

  bindGame(game) {
    this.gameView = new FighterGameView(game, this);
    return this;
  }

  clearTransientState() {
    this.ragdoll = null;
    this.respawnRemaining = 0;
    this.knockdown = null;
    this.knockdownRemaining = 0;
    this.attackRagdoll = null;
    this.attackRemaining = 0;
    this.attackData = null;
  }

  activeBody() {
    return this.ragdoll?.body || this.knockdown?.body || this.attackRagdoll?.body || this.actor;
  }

  isDead() {
    return !!this.ragdoll || this.actor.dead || this.actor.health <= 0;
  }

  canControl() {
    return !this.ragdoll && !this.knockdown && !this.attackRagdoll && !this.actor.dead;
  }
}
