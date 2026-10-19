'use strict';

// Central combat tuning. Keep raw damage/modifier values here so multiplayer
// playtests can be balanced without hunting magic numbers through weapon files.
const CombatBalance = Object.freeze({
  revolver:Object.freeze({
    primaryDamage:10,
    chargedDamage:20,
    reloadTempHealth:10,
    reloadDefense:0.85
  }),

  wand:Object.freeze({
    primaryDamage:4,
    qDamage:2.5,
    eContactDamage:3.5,
    eBurstDamage:2.25,
    eBurstCount:12
  }),

  sake:Object.freeze({
    drinkMelee:1.15,
    drinkDefense:0.82,
    drinkRegenTotal:6,

    drunkDefense:0.70,
    drunkDamage:1.25,
    drunkMelee:1.20,

    spitDamage:1.0,
    puddleDamage:4,
    shardDamage:1.5,
    shardBleedDuration:3,
    shardBleedDps:1.5,
    swingDamage:8,
    gourdDamage:10,
    gourdBleedDuration:3,
    gourdBleedDps:2
  }),

  dagger:Object.freeze({
    lungeDamage:9,
    cloakedLungeDamage:13,
    throwImpactDamage:3,
    bleedDuration:3,
    bleedDps:2.5,
    cloakedBleedDuration:6,
    cloakedBleedDps:3.25
  })
});
