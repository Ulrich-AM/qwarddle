'use strict';

const DEFAULT_GAME_CONFIG = Object.freeze({
  bodyW:58,
  bodyH:58,
  upperLeg:35,
  lowerLeg:37,
  hipInset:14,
  footW:19,
  footH:7,

  walkSpeed:210,
  runSpeed:330,
  accel:1500,
  airAccel:650,
  friction:1800,
  jumpSpeed:625,
  gravity:1450,

  bodyHeight:48,
  supportSpring:165,
  supportDamping:21,
  bodyBob:4.0,
  bodySway:2.0,
  accelLean:0.13,
  landingSquash:9,

  stepLength:52,
  runStepBonus:18,
  stepHeight:25,
  stepTrigger:18,
  swingTime:0.18,
  runSwingTime:0.13,
  landingPrediction:0.085,
  stanceSpread:12,
  restRecenter:5,

  kneeBend:1.0,
  kneeResponse:18,
  kneeLagMax:7,
  kneeWobble:2.0,

  airTuckX:8,
  airTuckY:43,
  airSpread:14,
  airFootSpring:115,
  airFootDamping:16,
  landingTime:0.15,
  landingSnap:1,
  stopSettleTime:0.16,

  // The cursor itself is NOT range limited. handReach only limits where the
  // physical hand motor is allowed to chase. The hand may wobble past that
  // limit until handHardReach catches it.
  handSize:20,
  handReach:138,
  handHardReach:192,
  handOriginY:-4,
  handRestX:78,
  handRestY:-8,
  handSpring:58,
  handDamping:8.7,
  handMaxSpeed:1120,
  handWobble:15.5,
  handWobbleSpeed:6.4,
  handCollisionBounce:0.08,
  handCollisionFriction:0.72,

  armWidthUpper:10,
  armWidthLower:9,
  armMidpoint:0.48,
  armCloseBend:37,
  armFarBend:10,
  elbowSpring:72,
  elbowDamping:11.5,
  elbowMaxSpeed:900,
  elbowLagMax:28,
  elbowWobble:6.0,
  armGravity:55
});

function createGameConfig() {
  return { ...DEFAULT_GAME_CONFIG };
}
