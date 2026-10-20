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
        // Arena shell. No ceiling so the blue sky remains visible.
        { x:0, y:0, w:100, h:1400, color:'#405866', material:'default' },
        { x:2300, y:0, w:100, h:1400, color:'#405866', material:'default' },

        // Main floor with two narrow water pits.
        { x:100, y:1190, w:800, h:110, color:'#64746e', material:'default' },
        { x:1000, y:1190, w:400, h:110, color:'#64746e', material:'default' },
        { x:1500, y:1190, w:800, h:110, color:'#64746e', material:'default' },

        // Tier 1: 175 px above the floor.
        { x:220, y:1015, w:520, h:70, color:'#6f8180', material:'default' },
        { x:1660, y:1015, w:520, h:70, color:'#6f8180', material:'default' },

        // Tier 2: another 170 px rise.
        { x:500, y:845, w:480, h:70, color:'#667b7e', material:'default' },
        { x:1420, y:845, w:480, h:70, color:'#667b7e', material:'default' },

        // Tier 3: wide central contest platform, 165 px higher.
        { x:800, y:680, w:800, h:70, color:'#748887', material:'default' },

        // Tier 4: side perches, 160 px higher with overlap to lower routes.
        { x:300, y:520, w:450, h:65, color:'#62767b', material:'default' },
        { x:1650, y:520, w:450, h:65, color:'#62767b', material:'default' },

        // Tier 5: final center perch, 155 px higher.
        { x:850, y:365, w:700, h:65, color:'#7b8d8a', material:'default' }
      ]
    }
  ],

  get(id) {
    return this.list.find((map) => map.id === id) || this.list[0];
  }
});
