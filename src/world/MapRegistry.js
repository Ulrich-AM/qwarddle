'use strict';

const MapRegistry = Object.freeze({
  list:[
    {
      version:1,
      id:'test-plane',
      name:'TEST PLANE',
      width:2400,
      height:1200,
      waterY:1600,
      background:'#8fc4df',
      groundColor:'#64746e',
      outlineColor:'#202020',
      outlineSize:6,
      spawns:[
        { x:650, y:980 },
        { x:1750, y:980 }
      ],
      rectangles:[
        { x:0, y:1050, w:2400, h:150, color:'#64746e', material:'default' }
      ]
    }
  ],

  get(id) {
    return this.list.find((map) => map.id === id) || this.list[0];
  }
});
