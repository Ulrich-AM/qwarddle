'use strict';

const MapRegistry = Object.freeze({
  list:[
    {
      version:1,
      id:'enclosed',
      name:'ENCLOSED',
      width:4400,
      height:1960,
      waterY:1520,
      background:'#242a30',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:20,
      spawns:[
        { x:1120, y:1000 },
        { x:3280, y:1000 }
      ],
      rectangles:[
        { x:600, y:1120, w:3200, h:360 },
        { x:600, y:240, w:360, h:920 },
        { x:3440, y:240, w:360, h:920 },
        { x:960, y:240, w:2480, h:120 }
      ]
    },
    {
      version:1,
      id:'platform',
      name:'PLATFORM',
      width:4400,
      height:1960,
      waterY:1520,
      background:'#242a30',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:20,
      spawns:[
        { x:1120, y:1000 },
        { x:3280, y:1000 }
      ],
      rectangles:[
        { x:1080, y:1080, w:2240, h:80 },
        { x:2040, y:1160, w:320, h:800 }
      ]
    },
    {
      version:1,
      id:'sunken',
      name:'SUNKEN',
      width:4400,
      height:1960,
      waterY:1520,
      background:'#242a30',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:20,
      spawns:[
        { x:1120, y:1000 },
        { x:3280, y:1000 }
      ],
      rectangles:[
        { x:600, y:1120, w:3200, h:360 },
        { x:600, y:920, w:360, h:240 },
        { x:3440, y:920, w:360, h:240 }
      ]
    },
    {
      version:1,
      id:'castle',
      name:'CASTLE',
      width:4400,
      height:1960,
      waterY:1520,
      background:'#242a30',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:20,
      spawns:[
        { x:920, y:1000 },
        { x:3480, y:1000 }
      ],
      rectangles:[
        { x:880, y:1120, w:2640, h:360 },
        { x:1740, y:720, w:920, h:520 },
        { x:1340, y:920, w:200, h:240 },
        { x:2860, y:920, w:200, h:240 }
      ]
    }
  ],

  get(id) {
    return this.list.find((map) => map.id === id) || this.list[0];
  }
});
