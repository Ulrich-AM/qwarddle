'use strict';

const WeaponRegistry = Object.freeze({
  list: [
    { id:'revolver', name:'REVOLVER', description:'Six shots. Q top-up reload. E loads six high-recoil charged rounds.' }
  ],
  create(id) {
    if (id === 'revolver') return new Revolver();
    return null;
  }
});
