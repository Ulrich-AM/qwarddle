'use strict';

const DEFAULT_GAME_CONFIG = Object.freeze({
  bodyW:58,
  bodyH:58,
  upperLeg:35,
  lowerLeg:37,
  hipInset:14,
  footW:19,
  footH:7,

  walkSpeed:270,
  runSpeed:445,
  accel:720,
  reverseAccel:1450,
  airAccel:460,
  friction:1500,
  jumpSpeed:780,
  gravity:1450,

  // Surface multipliers are intentionally separate from movement speed.
  surfaceAcceleration:1.0,
  surfaceDeceleration:1.0,
  surfaceReverse:1.0,
  surfaceFootGrip:1.0,

  bhopBoost:1.055,
  bhopMaxSpeedMultiplier:1.18,

  bodyHeight:48,

  // Physical torso support. The legs remain procedural and deterministic.
  supportSpring:145,
  supportDamping:20,
  supportSingleFootRadius:68,
  supportEdgeFalloff:72,
  supportMinStrength:0.08,
  supportLandingTolerance:18,
  supportLandingAssist:0.20,
  supportEdgeLean:0.10,

  bodyAngularSpring:24,
  bodyAngularDamping:7.2,
  bodyAngularAirDamping:1.2,
  bodyAngularMax:0.30,
  bodyWobble:0.020,

  bodyBob:2.4,
  bodySway:2.0,
  accelLean:0.11,
  landingSquash:9,

  stepLength:52,
  runStepBonus:18,
  stepHeight:25,
  stepTrigger:14,
  swingTime:0.15,
  runSwingTime:0.105,
  landingPrediction:0.095,
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
