'use strict';

const WeaponRegistry = Object.freeze({
  list: [
    {
      id:'revolver',
      sprite:null,
      languageKey:'weapons.revolver'
    }
  ],
  create(id) {
    if (id === 'revolver') return new Revolver();
    return null;
  }
});
