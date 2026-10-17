'use strict';

const WeaponRegistry = Object.freeze({
  list: [
    {
      id:'revolver',
      sprite:'assets/sprites/revolver/revolver.png',
      languageKey:'weapons.revolver'
    }
  ],
  create(id) {
    if (id === 'revolver') return new Revolver();
    return null;
  }
});
