'use strict';

const MapRegistry = Object.freeze({
  list:[
    {
      version:1,
      id:'test-plane',
      name:'TEST PLANE',
      // A wide uninterrupted training field, with water much closer beneath it.
      width:7200,
      height:1700,
      waterY:1270,
      waterOverlay:true,
      background:'#a8d9ee',
      skyTop:'#70b7df',
      skyMiddle:'#b2dff2',
      skyBottom:'#f1f9fc',
      groundColor:'#64746e',
      outlineColor:'#202020',
      outlineSize:6,
      spawns:[
        { x:2850, y:980 },
        { x:4350, y:980 }
      ],
      rectangles:[
        { x:0, y:1050, w:7200, h:650, color:'#64746e', material:'default' }
      ]
    }
  ],

  get(id) {
    return this.list.find((map) => map.id === id) || this.list[0];
  }
});
