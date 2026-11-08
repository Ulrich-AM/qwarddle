'use strict';

// 100-HP flat-arena test balance. Ranged tools win through reach/positioning;
// close-range hits carry the larger health damage. Values are provisional
// until live PvP testing, but all key attack intervals live here as well.
const CombatBalance = Object.freeze({
  revolver:Object.freeze({
    primaryDamage:2.5,
    chargedDamage:6.5,
    shotInterval:0.34,
    reloadDuration:0.58,
    primaryKnockback:270,
    chargedKnockback:690,
    reloadTempHealth:10,
    reloadDefense:0.85
  }),

  wand:Object.freeze({
    primaryDamage:0.9,
    primaryInterval:0.32,
    primaryKnockback:65,
    qDamage:0.8,
    qInterval:1.30,
    qKnockback:55,
    eContactDamage:1.5,
    eBurstDamage:0.75,
    eBurstCount:12,
    eBurstKnockback:65
  }),

  sake:Object.freeze({
    drinkMelee:1.15,
    drinkDefense:0.82,
    drinkRegenTotal:6,

    drunkDefense:0.70,
    drunkDamage:1.25,
    drunkMelee:1.20,

    spitDamage:0.6,
    puddleDamage:3,
    shardDamage:1,
    shardBleedDuration:3,
    shardBleedDps:1,
    swingDamage:10,
    gourdDamage:7,
    gourdBleedDuration:3,
    gourdBleedDps:1.5
  }),

  cleaver:Object.freeze({
    slashDamage:13,
    slashCooldown:0.56,
    slashHemorrhageChance:0.125,
    slashRange:104,
    slashArc:1.10,
    dashWindup:0.70,
    dashDuration:0.44,
    dashSpeed:990,
    dashDamage:17,
    dashKnockback:430,
    dashCooldown:6.0,
    throwBaseSpeed:620,
    throwBonusSpeed:500,
    throwBaseDamage:9,
    throwBonusDamage:11,
    throwMaxCharge:1.15,
    throwGravity:810,
    throwExpiry:16,
    hemorrhageDuration:5
  }),
  dagger:Object.freeze({
    lungeDamage:14,
    cloakedLungeDamage:18,
    lungeCooldown:3,
    throwImpactDamage:2,
    bleedDuration:3,
    bleedDps:1.8,
    cloakedBleedDuration:6,
    cloakedBleedDps:2.25
  })
});
