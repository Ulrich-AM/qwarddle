'use strict';

// Central combat tuning. Ranged weapons should win through reach, control,
// knockback and utility rather than matching melee health damage.
const CombatBalance = Object.freeze({
  revolver:Object.freeze({
    primaryDamage:4,
    chargedDamage:9,
    reloadTempHealth:10,
    reloadDefense:0.85
  }),

  wand:Object.freeze({
    primaryDamage:1.5,
    qDamage:1.0,
    eContactDamage:1.5,
    eBurstDamage:0.75,
    eBurstCount:12
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

  dagger:Object.freeze({
    lungeDamage:12,
    cloakedLungeDamage:17,
    throwImpactDamage:2,
    bleedDuration:3,
    bleedDps:1.8,
    cloakedBleedDuration:6,
    cloakedBleedDps:2.25
  })
});
