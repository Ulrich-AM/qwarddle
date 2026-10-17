'use strict';

const MapRegistry = Object.freeze({
  list:[
    {
      id:'training-blocks',
      name:'TRAINING BLOCKS',
      width:2200,
      height:980,
      waterY:760,
      background:'#242a30',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:10,
      spawns:[
        { x:560, y:480 },
        { x:1640, y:480 }
      ],
      rectangles:[
        { x:260, y:560, w:1680, h:170 },
        { x:420, y:470, w:300, h:90 },
        { x:1480, y:470, w:300, h:90 }
      ]
    },
    {
      id:'split-levels',
      name:'SPLIT LEVELS',
      width:2200,
      height:980,
      waterY:780,
      background:'#242a30',
      groundColor:'#596057',
      outlineColor:'#202020',
      outlineSize:10,
      spawns:[
        { x:520, y:470 },
        { x:1680, y:470 }
      ],
      rectangles:[
        { x:220, y:590, w:760, h:150 },
        { x:1220, y:590, w:760, h:150 },
        { x:760, y:470, w:680, h:80 }
      ]
    }
  ],

  get(id) {
    return this.list.find((map) => map.id === id) || this.list[0];
  }
});
