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

  // A fast procedural stride is allowed to momentarily lose a planted contact
  // without making the torso fall. Continuity only applies while a real floor
  // still exists under the body, so it cannot bridge gaps or ledges.
  supportContactGrace:0.11,
  supportGraceStrength:0.72,
  supportFloorContinuityTolerance:34,

  // The torso is intentionally a little underdamped. Locomotion stays
  // deterministic at the feet while acceleration, recoil and landings can
  // visibly throw the upper body around.
  bodyAngularSpring:18,
  bodyAngularDamping:4.8,
  bodyAngularAirDamping:0.85,
  bodyAngularMax:0.42,
  bodyWobble:0.034,
  bodyStepLean:0.030,
  bodyAngularAccelerationKick:2.8,
  bodyRecoverySpringScale:0.68,
  bodyRecoveryDampingScale:0.52,

  bodyBob:2.4,
  bodySway:2.0,
  accelLean:0.13,
  landingSquash:9,

  stepLength:52,
  runStepBonus:20,
  stepHeight:26,
  stepTrigger:10,
  swingTime:0.15,
  runSwingTime:0.095,
  landingPrediction:0.11,
  stepLookahead:0.92,
  stepReachTrigger:0.82,

  // Sprinting uses a short double-support transfer: the rear leg may begin its
  // next swing before the other foot has fully finished. This removes the long
  // planted-leg stretch that visually looked like dragging.
  sprintOverlapMinSpeed:0.68,
  sprintOverlapStart:0.52,
  stepMinPlantTime:0.025,
  sprintMinPlantTime:0.035,
  sprintOverlapTrailing:5,
  sprintOverlapPredictedReach:0.86,

  stanceSpread:12,
  restRecenter:5,

  // Airborne legs extend before contact so jump landings meet the ground rather
  // than suddenly switching from a tucked pose into a landing swing.
  airLandingExtendStart:120,
  airLandingExtendFull:680,
  airLandingExtendY:16,
  airLandingLead:0.025,
  airReleaseBodyVelocityX:0.45,
  airReleaseBodyVelocityY:0.30,

  // Landing response preserves some downward inertia and then compresses the
  // torso briefly before the standing spring rebounds.
  landingTime:0.115,
  landingFootHeight:4,
  landingVelocityCarry:0.68,
  landingCompressionDuration:0.21,
  landingCompressionStartSpeed:240,
  landingCompressionMin:3,
  landingCompressionMax:12,

  // Hard impacts first disturb balance, then hand control over to the existing
  // non-lethal ragdoll state once speed crosses the crash threshold.
  balanceRecoveryDuration:0.55,
  hardLandingSpeed:560,
  floorCrashSpeed:980,
  floorImpactUprightHorizontalWeight:0.16,
  floorCrashHorizontalWeight:0.72,
  floorOverspeedImpactWeight:0.55,
  floorSafeTilt:0.12,
  floorCrashTiltRelief:110,
  wallStumbleSpeed:535,
  wallCrashSpeed:760,
  ceilingStumbleSpeed:690,
  ceilingCrashSpeed:930,
  impactCrashCooldown:0.38,
  impactRagdollMinDuration:0.78,
  impactRagdollMaxDuration:1.35,
  impactRagdollMaxSeverity:1.75,

  kneeBend:1.0,
  kneeResponse:18,
  kneeLagMax:7,
  kneeWobble:2.0,

  airTuckX:8,
  airTuckY:43,
  airSpread:14,
  airFootSpring:115,
  airFootDamping:16,
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
