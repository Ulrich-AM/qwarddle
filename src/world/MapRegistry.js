'use strict';

const MapRegistry = Object.freeze({
  list:[
    {
      version:1,
      id:'enclosed',
      name:'ENCLOSED',
      width:2750,
      height:1225,
      waterY:950,
      background:'#242a30',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:10,
      spawns:[
        { x:700, y:625 },
        { x:2050, y:625 }
      ],
      rectangles:[
        { x:375, y:700, w:2000, h:225 },
        { x:375, y:150, w:225, h:575 },
        { x:2150, y:150, w:225, h:575 },
        { x:600, y:150, w:1550, h:75 }
      ]
    },
    {
      version:1,
      id:'platform',
      name:'PLATFORM',
      width:2750,
      height:1225,
      waterY:950,
      background:'#242a30',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:10,
      spawns:[
        { x:700, y:625 },
        { x:2050, y:625 }
      ],
      rectangles:[
        { x:675, y:675, w:1400, h:50 },
        { x:1275, y:725, w:200, h:500 }
      ]
    },
    {
      version:1,
      id:'sunken',
      name:'SUNKEN',
      width:2750,
      height:1225,
      waterY:950,
      background:'#242a30',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:10,
      spawns:[
        { x:700, y:625 },
        { x:2050, y:625 }
      ],
      rectangles:[
        { x:375, y:700, w:2000, h:225 },
        { x:375, y:575, w:225, h:150 },
        { x:2150, y:575, w:225, h:150 }
      ]
    },
    {
      version:1,
      id:'castle',
      name:'CASTLE',
      width:2750,
      height:1225,
      waterY:950,
      background:'#242a30',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:10,
      spawns:[
        { x:575, y:625 },
        { x:2175, y:625 }
      ],
      rectangles:[
        { x:550, y:700, w:1650, h:225 },
        { x:1087, y:450, w:576, h:325 },
        { x:838, y:575, w:125, h:150 },
        { x:1787, y:575, w:125, h:150 }
      ]
    }
  ],

  get(id) {
    return this.list.find((map) => map.id === id) || this.list[0];
  }
});
