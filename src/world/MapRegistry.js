'use strict';

const MapRegistry = Object.freeze({
  list:[
    {
      version:1,
      id:'complex',
      name:'COMPLEX',
      width:5000,
      height:3000,
      waterY:3000,
      background:'#dfe8eb',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:10,
      spawns:[
        { x:1250, y:2525 },
        { x:3750, y:2550 }
      ],
      rectangles:[
        { x:0, y:0, w:250, h:3000, color:'#35444b', material:'default' },
        { x:4750, y:0, w:250, h:3000, color:'#35444b', material:'default' },
        { x:75, y:0, w:4775, h:250, color:'#35444b', material:'default' },
        { x:150, y:2750, w:4775, h:250, color:'#35444b', material:'default' },

        { x:1000, y:2375, w:3000, h:125, color:'#596057', material:'default' },

        { x:625, y:2000, w:975, h:125, color:'#596057', material:'default' },
        { x:3400, y:2000, w:975, h:125, color:'#596057', material:'default' },

        { x:875, y:1700, w:975, h:125, color:'#596057', material:'default' },
        { x:3150, y:1700, w:975, h:125, color:'#596057', material:'default' },

        { x:1125, y:1400, w:975, h:125, color:'#596057', material:'default' },
        { x:2775, y:1400, w:975, h:125, color:'#596057', material:'default' },

        { x:1625, y:1125, w:1750, h:125, color:'#596057', material:'default' }
      ]
    }
  ],

  get(id) {
    return this.list.find((map) => map.id === id) || this.list[0];
  }
});
