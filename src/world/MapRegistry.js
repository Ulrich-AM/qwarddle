'use strict';

const MapRegistry = Object.freeze({
  list:[
    {
      version:1,
      id:'enclosed',
      name:'ENCLOSED',
      width:2200,
      height:980,
      waterY:760,
      background:'#242a30',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:10,
      spawns:[
        { x:560, y:500 },
        { x:1640, y:500 }
      ],
      rectangles:[
        { x:300, y:560, w:1600, h:180 },
        { x:300, y:120, w:180, h:460 },
        { x:1720, y:120, w:180, h:460 },
        { x:480, y:120, w:1240, h:60 }
      ]
    },
    {
      version:1,
      id:'platform',
      name:'PLATFORM',
      width:2200,
      height:980,
      waterY:760,
      background:'#242a30',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:10,
      spawns:[
        { x:560, y:500 },
        { x:1640, y:500 }
      ],
      rectangles:[
        { x:540, y:540, w:1120, h:40 },
        { x:1000, y:580, w:160, h:400 }
      ]
    },
    {
      version:1,
      id:'sunken',
      name:'SUNKEN',
      width:2200,
      height:980,
      waterY:760,
      background:'#242a30',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:10,
      spawns:[
        { x:560, y:500 },
        { x:1640, y:500 }
      ],
      rectangles:[
        { x:300, y:560, w:1600, h:180 },
        { x:300, y:460, w:180, h:120 },
        { x:1720, y:460, w:180, h:120 }
      ]
    },
    {
      version:1,
      id:'castle',
      name:'CASTLE',
      width:2200,
      height:980,
      waterY:760,
      background:'#242a30',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:10,
      spawns:[
        { x:460, y:500 },
        { x:1740, y:500 }
      ],
      rectangles:[
        { x:440, y:560, w:1320, h:180 },
        { x:860, y:360, w:460, h:260 },
        { x:660, y:460, w:100, h:120 },
        { x:1420, y:460, w:100, h:120 }
      ]
    }
  ],

  get(id) {
    return this.list.find((map) => map.id === id) || this.list[0];
  }
});
