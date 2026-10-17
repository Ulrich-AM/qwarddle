'use strict';

const WeaponRegistry = Object.freeze({
  list: [
    {
      id:'revolver',
      sprite:'assets/sprites/revolver/revolver.png',
      languageKey:'weapons.revolver'
    },
    {
      id:'wand',
      sprite:'assets/sprites/wand/wand.png',
      languageKey:'weapons.wand'
    },
    {
      id:'sake',
      sprite:'assets/sprites/sake/sake.png',
      languageKey:'weapons.sake'
    }
  ],
  create(id) {
    if (id === 'revolver') return new Revolver();
    if (id === 'wand') return new Wand();
    if (id === 'sake') return new Sake();
    return null;
  }
});
