'use strict';

const WeaponRegistry = Object.freeze({
  list: [
    {
      id:'revolver',
      sprite:null,
      languageKey:'weapons.revolver'
    },
    {
      id:'wand',
      sprite:'assets/sprites/wand/wand.png',
      languageKey:'weapons.wand'
    }
  ],
  create(id) {
    if (id === 'revolver') return new Revolver();
    if (id === 'wand') return new Wand();
    return null;
  }
});
