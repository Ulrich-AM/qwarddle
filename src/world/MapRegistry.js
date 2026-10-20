'use strict';

const MapRegistry = Object.freeze({
  list:[
    {
      version:1,
      id:'complex',
      name:'COMPLEX',
      width:2400,
      height:1400,
      waterY:1310,
      background:'#b8d6e8',
      groundColor:'#64746e',
      outlineColor:'#202020',
      outlineSize:6,
      spawns:[
        { x:500, y:1120 },
        { x:1900, y:1120 }
      ],
      rectangles:[
        // Arena shell. No ceiling so the pale-blue sky remains visible.
        { x:0, y:0, w:100, h:1400, color:'#405866', material:'default' },
        { x:2300, y:0, w:100, h:1400, color:'#405866', material:'default' },

        // Main floor with two narrow water pits.
        { x:100, y:1190, w:800, h:110, color:'#64746e', material:'default' },
        { x:1000, y:1190, w:400, h:110, color:'#64746e', material:'default' },
        { x:1500, y:1190, w:800, h:110, color:'#64746e', material:'default' },

        // Low side platforms, about 200 px above the floor.
        { x:220, y:990, w:520, h:70, color:'#6f8180', material:'default' },
        { x:1660, y:990, w:520, h:70, color:'#6f8180', material:'default' },

        // Mid routes. The ~170 px rise is comfortably inside current jump height.
        { x:500, y:820, w:480, h:70, color:'#667b7e', material:'default' },
        { x:1420, y:820, w:480, h:70, color:'#667b7e', material:'default' },

        // Wide central contest platform.
        { x:850, y:650, w:700, h:70, color:'#748887', material:'default' },

        // Upper side perches and final center perch.
        { x:300, y:490, w:380, h:65, color:'#62767b', material:'default' },
        { x:1720, y:490, w:380, h:65, color:'#62767b', material:'default' },
        { x:950, y:335, w:500, h:65, color:'#7b8d8a', material:'default' }
      ]
    }
  ],

  get(id) {
    return this.list.find((map) => map.id === id) || this.list[0];
  }
});
