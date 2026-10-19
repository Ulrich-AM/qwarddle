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

  // Ground response is intentionally separate from movement speed so future
  // terrain materials can change grip/slipperiness without changing controls.
  surfaceAcceleration:1.0,
  surfaceDeceleration:1.0,
  surfaceReverse:1.0,
  surfaceFootGrip:1.0,
  jumpSpeed:780,
  gravity:1450,

  bodyHeight:48,
  supportSpring:145,
  supportDamping:18,
  supportSingleFootRadius:68,
  supportEdgeFalloff:64,
  supportMinStrength:0.08,
  supportLandingTolerance:14,
  supportLandingDamping:0.22,
  supportEdgeLean:0.16,
  bodyAngularSpring:26,
  bodyAngularDamping:7,
  bodyAngularAirDamping:1.15,
  bodyAngularMax:0.42,
  bodyWobble:0.045,
  bhopBoost:1.055,
  bhopMaxSpeedMultiplier:1.18,
  bodyBob:4.0,
  bodySway:2.0,
  accelLean:0.13,
  landingSquash:9,

  stepLength:52,
  runStepBonus:18,
  stepHeight:25,
  stepTrigger:18,
  swingTime:0.22,
  runSwingTime:0.17,
  landingPrediction:0.12,
  stanceSpread:12,

  // Ground gait is phase driven so a bad physical foot position can never stall
  // walking. Two steps occur per gait cycle.
  gaitWalkHz:2.60,
  gaitRunHz:3.20,
  gaitSwingFraction:0.40,
  gaitRearStride:0.42,
  gaitFrontStride:0.50,

  activeLegConstraintIterations:4,
  activeLegConstraintStrength:0.68,
  activeLegPlantedFootWeight:0.06,
  kneeGroundClearance:9,
  restRecenter:5,

  kneeBend:1.0,
  kneeSpring:82,
  kneeDamping:12.5,
  kneeMaxSpeed:650,
  kneeLagMax:10,
  kneeWobble:2.0,

  footPlantSpring:165,
  footPlantDamping:20,
  footSwingSpring:205,
  footSwingDamping:21,
  footMaxSpeed:980,
  footContactRange:24,
  footReleaseReach:1.07,
  footSoftReach:0.97,

  airTuckX:8,
  airTuckY:43,
  airSpread:14,
  airFootSpring:115,
  airFootDamping:16,
  landingTime:0.20,
  landingSnap:1,
  stopSettleTime:0.20,

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
