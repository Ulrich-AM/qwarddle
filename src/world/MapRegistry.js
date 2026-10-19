'use strict';

const MapRegistry = Object.freeze({
  list:[
    {
      version:1,
      id:'complex',
      name:'COMPLEX',
      width:2500,
      height:1500,
      waterY:1500,
      background:'#dfe8eb',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:5,
      spawns:[
        { x:625, y:1263 },
        { x:1875, y:1275 }
      ],
      rectangles:[
        { x:0, y:0, w:125, h:1500, color:'#35444b', material:'default' },
        { x:2375, y:0, w:125, h:1500, color:'#35444b', material:'default' },
        { x:38, y:0, w:2388, h:125, color:'#35444b', material:'default' },
        { x:75, y:1375, w:2388, h:125, color:'#35444b', material:'default' },

        { x:500, y:1188, w:1500, h:63, color:'#596057', material:'default' },

        { x:313, y:1000, w:488, h:63, color:'#596057', material:'default' },
        { x:1700, y:1000, w:488, h:63, color:'#596057', material:'default' },

        { x:438, y:850, w:488, h:63, color:'#596057', material:'default' },
        { x:1575, y:850, w:488, h:63, color:'#596057', material:'default' },

        { x:563, y:700, w:488, h:63, color:'#596057', material:'default' },
        { x:1388, y:700, w:488, h:63, color:'#596057', material:'default' },

        { x:813, y:563, w:875, h:63, color:'#596057', material:'default' }
      ]
    }
  ],

  get(id) {
    return this.list.find((map) => map.id === id) || this.list[0];
  }
});
