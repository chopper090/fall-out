import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  BOSS,
  BOSS_PHASES,
  ENEMY_TYPES,
  EVENTS,
  GATES,
  HEROES,
  HERO_POWERS,
  STARTING_LOADOUT,
  battle,
  dt,
  heroById,
  heroData,
  laneCenters,
  placeEnemy,
  placeGate,
  resetBoss,
  run,
  updateHeroes,
  weaponArena,
} from '../support/suite.js';
import { CATEGORIES } from '../../src/data/heroes.js';
import { damageMultiplier } from '../../src/systems/army.js';
import { afterArmor } from '../../src/systems/combat.js';
import { markedDamage } from '../../src/systems/spawn.js';

// L'esercito di partenza con l'eroe hero (di base quello dei dati, id) al posto del Fuciliere (posto 1)
const withHero = (id, hero = HEROES[id]) => ({
  ...STARTING_LOADOUT,
  heroes: STARTING_LOADOUT.heroes.map((entry) => (entry.slot === 1 ? { hero, slot: 1 } : entry)),
});

// Solo l'abilità di hero è pronta: le altre aspettano
function onlyReady(b, hero) {
  for (const other of b.army.heroes) b.heroesState.cooldowns.set(other, other === hero ? 0 : 1e9);
}

// Le abilità guardano la battaglia una volta, senza il resto (niente colpi né movimenti); bosses: i boss da far
// vedere, se non sono quelli in strada
function usePowers(b, bosses = b.bosses.list) {
  const world = { enemies: b.spawner.enemies, enemyShots: b.fire.shots, gates: b.gates.list, bosses };
  updateHeroes(b.heroesState, b.army, world, dt);
}

// Gli eventi name arrivati mentre gira fn (il bus non stacca gli ascolti: dopo, questo non raccoglie più)
function counting(b, name, fn) {
  const seen = [];
  let open = true;
  b.bus.on(EVENTS[name], (payload) => {
    if (open) seen.push(payload);
  });
  fn();
  open = false;
  return seen;
}

const near = (a, c) => Math.abs(a - c) < 1e-6 * Math.max(1, Math.abs(c));

// 192. Adunata (il Capo): senza nemici a tiro non parte; con un nemico a tiro parte e per seconds i colpi dei soldati
// fanno damageBonus di danno in più, poi tornano normali
test('192. Adunata: parte con un nemico a tiro e per seconds i soldati fanno damageBonus in più', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 30 });
  const { leader } = b.army;
  const { seconds, damageBonus } = leader.ability;
  onlyReady(b, leader);
  const idle = counting(b, 'RALLY_STARTED', () => run(b, 0.5)).length;
  // I danni dei colpi dei soldati, uno per tipo di colpo, mentre il nemico resta lì
  let seen = null;
  b.bus.on(EVENTS.ENEMY_HIT, ({ damage, hero }) => {
    if (seen && hero === null) seen.add(Math.round(damage * 1e6) / 1e6);
  });
  const enemy = placeEnemy(b, leader.x, 600, 1e9);
  const hold = (frameCount, into = null) => {
    seen = into;
    for (let i = 0; i < frameCount; i++) {
      b.step();
      enemy.z = 600;
    }
    seen = null;
    return into;
  };
  b.heroesState.cooldowns.set(leader, 1e9);
  const before = hold(60, new Set());
  b.heroesState.cooldowns.set(leader, 0);
  // Mezzo secondo per i colpi già in volo, poi fin quasi alla fine dell'adunata
  const started = counting(b, 'RALLY_STARTED', () => hold(30)).length;
  const during = hold(Math.floor((seconds - 1) * 60), new Set());
  hold(90);
  const after = hold(60, new Set());
  // I danni normali sono quelli di prima e di dopo (le granate non arrivano sempre in tutte e due)
  const plain = [...before, ...after];
  const isPlain = (value) => plain.some((normal) => near(value, normal));
  const boosted = [...during].every((value) => isPlain(value / (1 + damageBonus)) && !isPlain(value));
  check(
    `adunata: senza nemici ${idle}, con un nemico a tiro ${started}; danni dei soldati prima ${[...before].join(', ')}, durante ${[...during].join(', ')} (+${damageBonus * 100}%), dopo ${[...after].join(', ')}`,
    idle === 0 &&
      started === 1 &&
      before.size > 0 &&
      during.size > 0 &&
      boosted &&
      after.size > 0 &&
      [...after].every((value) => !during.has(value)),
  );
  check.done();
});

// 193. Barricata (il Difensore): mentre il boss sta per schiacciare dove c'è l'esercito si alza, e lo schianto prende
// smashCut in meno: meno soldati e meno vita agli eroi. Con smashCut 0,3 (non 0,5, che è anche quello che resta)
test('193. Barricata: si alza prima dello schianto del boss e lo schianto prende smashCut in meno', async (t) => {
  const check = checker(t);
  BOSS.escort.interval = 1e9;
  const { ability } = CATEGORIES.defense;
  const smashCut = ability.smashCut;
  ability.smashCut = 0.3;
  const smashWith = (shield) => {
    const b = battle({ size: 60, x: laneCenters[1], startWithBoss: true });
    for (const h of b.army.heroes) h.hp = h.maxHp = 1e9;
    const defender = heroById(b, 'defender');
    for (const h of b.army.heroes) b.heroesState.cooldowns.set(h, 1e9);
    run(b, 1, () => b.boss.enemy);
    b.boss.enemy.hp = b.boss.enemy.maxHp = 1e9;
    run(b, 20, () => b.boss.phase === BOSS_PHASES.warn);
    if (shield) b.heroesState.cooldowns.set(defender, 0);
    const raised = [];
    b.bus.on(EVENTS.SHIELD_RAISED, (p) => raised.push(p));
    const heroDamage = [];
    b.bus.on(EVENTS.HERO_HIT, ({ damage }) => heroDamage.push(damage));
    let smash = null;
    let inZone = 0;
    b.bus.on(EVENTS.BOSS_SMASHED, () => {
      smash = { hit: b.boss.victims.length, inZone, guard: b.bosses.guard.ms };
    });
    for (let i = 0; i < 60 * 3 && !smash; i++) {
      const { zone } = b.boss;
      inZone = b.army.soldiers.filter((s) => Math.hypot(s.x - zone.x, s.z - zone.z) < zone.radius).length;
      b.step();
    }
    return { ...smash, raised, heroDamage, cut: defender.ability.smashCut };
  };
  const open = smashWith(false);
  const guarded = smashWith(true);
  resetBoss();
  ability.smashCut = smashCut;
  const { heroDamage } = ENEMY_TYPES.boss;
  const kept = 1 - guarded.cut;
  check(
    `schianto senza barricata: soldati colpiti ${open.hit} su ${open.inZone} nella zona, vita tolta agli eroi ${open.heroDamage.join(', ')}; con la barricata (alzata ${guarded.raised.length} volta, -${guarded.cut * 100}%, ancora ${guarded.guard} ms): ${guarded.hit} su ${guarded.inZone}, vita ${guarded.heroDamage.join(', ')}`,
    open.raised.length === 0 &&
      open.inZone > 0 &&
      Math.abs(open.hit - open.inZone) <= 1 &&
      open.heroDamage.length > 0 &&
      open.heroDamage.every((d) => d === heroDamage) &&
      guarded.raised.length === 1 &&
      guarded.cut === 0.3 &&
      guarded.raised[0].smashCut === guarded.cut &&
      guarded.guard > 0 &&
      Math.abs(guarded.hit - Math.round(guarded.inZone * kept)) <= 1 &&
      guarded.heroDamage.length > 0 &&
      guarded.heroDamage.every((d) => near(d, heroDamage * kept)),
  );
  check.done();
});

// 194. Colpo perforante (il Cecchino): colpisce chi è nella sua colonna e dà gateHits colpi alla porta che ci trova;
// niente alle porte fuori colonna né a quelle già al massimo
test('194. Colpo perforante: gateHits colpi alla porta nella colonna, niente alle altre', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 1 });
  const sniper = heroById(b, 'sniper');
  const { gateHits } = sniper.ability;
  const farLane = laneCenters.reduce(
    (best, x, lane) => (Math.abs(x - sniper.x) > Math.abs(laneCenters[best] - sniper.x) ? lane : best),
    0,
  );
  const target = placeGate(b, 'minus', 1, 800, -10, 10);
  target.x = sniper.x;
  const full = placeGate(b, 'plus', 1, 1100, 10);
  full.x = sniper.x;
  const aside = placeGate(b, 'minus', farLane, 800, -10, 10);
  const enemy = placeEnemy(b, sniper.x, 1300, 1e9);
  onlyReady(b, sniper);
  const gateEvents = counting(b, 'GATE_HIT', () => usePowers(b));
  const hitsOn = (gate) => gateEvents.filter((p) => p.gate === gate).length;
  check(
    `colpo perforante: porta nella colonna ${hitsOn(target)} colpi (${gateHits}), porta al massimo ${hitsOn(full)}, porta in un'altra corsia ${hitsOn(aside)}; nemico in colonna ${enemy.hp < 1e9 ? 'colpito' : 'no'}`,
    hitsOn(target) === gateHits &&
      hitsOn(full) === 0 &&
      Math.abs(aside.x - sniper.x) > GATES.width &&
      hitsOn(aside) === 0 &&
      enemy.hp < 1e9,
  );
  check.done();
});

// 195. Bombardamento (l'Artificiere al posto del Fuciliere): senza nemici entro range non parte; con un gruppo e uno
// da solo (primo nella lista e più lontano: né il primo né il più lontano bastano) scoppia sul gruppo e lo colpisce
// tutto, non quello da solo; con il boss a tiro scoppia su di lui e gli toglie la sua quota (meno su un boss)
test('195. Bombardamento: niente fuori portata, poi sul gruppo più fitto, e sul boss se c’è', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 1, loadout: withHero('sapper') });
  const sapper = heroById(b, 'sapper');
  const { range, share } = sapper.ability;
  onlyReady(b, sapper);
  placeEnemy(b, sapper.x, sapper.z + range + 200, 1e9);
  const idle = counting(b, 'BLAST', () => usePowers(b)).length;
  b.spawner.enemies.length = 0;
  const lone = placeEnemy(b, sapper.x - 300, 1300, 1e9);
  const group = [
    placeEnemy(b, sapper.x + 200, 900, 1e9),
    placeEnemy(b, sapper.x + 240, 930, 1e9),
    placeEnemy(b, sapper.x + 180, 960, 1e9),
  ];
  const blasts = counting(b, 'BLAST', () => usePowers(b));
  const onGroup = blasts.length === 1 && group.some((e) => e.x === blasts[0].x && e.z === blasts[0].z);
  const groupHit = group.every((e) => e.hp < 1e9);
  // Il boss: entro range, lontano dal gruppo
  b.spawner.enemies.length = 0;
  onlyReady(b, sapper);
  const boss = placeEnemy(b, sapper.x, 1200, 1e9, ENEMY_TYPES.boss);
  placeEnemy(b, sapper.x + 300, 700, 1e9);
  placeEnemy(b, sapper.x + 320, 720, 1e9);
  const bossBlast = counting(b, 'BLAST', () => usePowers(b, [{ enemy: boss }]));
  const expected = afterArmor(
    1e9 * share * HERO_POWERS.targetShare.boss * damageMultiplier(b.army),
    ENEMY_TYPES.boss.armor,
  );
  check(
    `bombardamento: oltre range ${idle}; gruppo e uno da solo: scoppi ${blasts.length} sul gruppo ${onGroup}, gruppo colpito ${groupHit}, quello da solo ${lone.hp < 1e9 ? 'colpito' : 'no'}; con il boss: scoppio su di lui ${bossBlast.length === 1 && bossBlast[0].x === boss.x && bossBlast[0].z === boss.z}, tolto ${Math.round(1e9 - boss.hp)} (${Math.round(expected)})`,
    idle === 0 &&
      onGroup &&
      groupHit &&
      lone.hp === 1e9 &&
      bossBlast.length === 1 &&
      bossBlast[0].x === boss.x &&
      near(1e9 - boss.hp, expected),
  );
  check.done();
});

// 196. Soccorso (lo Scudiero al posto del Fuciliere): con tutti in forze non parte; con un eroe sotto belowShare della
// vita gli ridà healShare della vita piena senza soldati in più; una porta che toglie soldati non è una perdita (non
// parte e non li riporta); con l'esercito che ne ha persi contro i nemici più di soldiers ne riporta soldiers. Il
// Paladino (epico, soldiers più alto) parte con gli stessi minLost persi e li riporta tutti
test('196. Soccorso: cura gli eroi feriti e riporta i soldati persi contro i nemici, mai di più', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 40, loadout: withHero('squire') });
  const squire = heroById(b, 'squire');
  const { healShare, soldiers, belowShare, minLost } = squire.ability;
  const size = b.army.size;
  onlyReady(b, squire);
  const idle = counting(b, 'HEROES_HEALED', () => usePowers(b)).length;
  squire.hp = squire.maxHp * (belowShare - 0.2);
  const hurtHp = squire.hp;
  const revivedHurt = counting(b, 'SOLDIERS_REVIVED', () => usePowers(b));
  const healed = squire.hp - hurtHp;
  const sizeAfterHeal = b.army.size;
  // Una porta da -10, con tutti gli eroi in forze
  onlyReady(b, squire);
  const gate = placeGate(b, 'minus', 1, 0, -10, 10);
  b.bus.emit(EVENTS.GATE_PASSED, gate);
  const afterGate = b.army.size;
  const afterGateUses = counting(b, 'ABILITY_USED', () => usePowers(b)).length;
  // Soldati persi contro i nemici
  const lose = (battle, count) => {
    for (const soldier of battle.army.soldiers.slice(0, count)) {
      soldier.lives = 1;
      battle.bus.emit(EVENTS.SOLDIER_HIT, { soldier });
    }
  };
  lose(b, soldiers + 2);
  const lostSize = b.army.size;
  const revived = counting(b, 'SOLDIERS_REVIVED', () => usePowers(b));
  // Il Paladino: ne perde minLost + 2, meno del suo soldiers, e li riporta tutti
  const paladinBattle = weaponArena({
    size: 40,
    loadout: withHero('paladin', heroData('paladin', { level: 1, stars: 1 })),
  });
  const paladin = heroById(paladinBattle, 'paladin');
  onlyReady(paladinBattle, paladin);
  const paladinSize = paladinBattle.army.size;
  lose(paladinBattle, minLost + 2);
  const paladinRevived = counting(paladinBattle, 'SOLDIERS_REVIVED', () => usePowers(paladinBattle));
  check(
    `soccorso: tutti in forze ${idle}; eroe al ${Math.round((100 * hurtHp) / squire.maxHp)}% curato di ${healed.toFixed(2)} (${(healShare * squire.maxHp).toFixed(2)}), soldati riportati ${revivedHurt.length} (esercito ${size} -> ${sizeAfterHeal}); porta da -10: esercito ${sizeAfterHeal} -> ${afterGate}, poteri usati ${afterGateUses}; persi ${afterGate - lostSize}: riportati ${revived.map((p) => p.count).join(', ')} (${soldiers}), esercito ${b.army.size}; Paladino (fino a ${paladin.ability.soldiers}) persi ${minLost + 2}: riportati ${paladinRevived.map((p) => p.count).join(', ')}, esercito ${paladinSize} -> ${paladinBattle.army.size}`,
    idle === 0 &&
      near(healed, healShare * squire.maxHp) &&
      revivedHurt.length === 0 &&
      sizeAfterHeal === size &&
      afterGate === size - 10 &&
      afterGateUses === 0 &&
      afterGate - lostSize === soldiers + 2 &&
      revived.length === 1 &&
      revived[0].count === soldiers &&
      b.army.size === lostSize + soldiers &&
      paladin.ability.soldiers > minLost + 2 &&
      paladinRevived.length === 1 &&
      paladinRevived[0].count === minLost + 2 &&
      paladinBattle.army.size === paladinSize,
  );
  check.done();
});

// 197. Marchio (il Tiratore al posto del Fuciliere): marchia il nemico più duro a tiro (l'élite, non il normale) con
// un colpo che non conta il proprio marchio; poi per seconds l'élite prende markBonus di danno in più da ogni colpo, e
// il danno dei colpi (quello che mostrano i numeri e contano le statistiche) è quello che perde davvero; poi il marchio
// passa
test('197. Marchio: sul più duro a tiro, che per seconds prende markBonus di danno in più', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 1, loadout: withHero('shooter') });
  const shooter = heroById(b, 'shooter');
  const { seconds, markBonus, share } = shooter.ability;
  const elite = placeEnemy(b, shooter.x, 900, 1e9, ENEMY_TYPES.elite);
  const grunt = placeEnemy(b, shooter.x + 150, 800, 1e9);
  onlyReady(b, shooter);
  const hits = [];
  b.bus.on(EVENTS.ENEMY_HIT, (payload) => hits.push(payload));
  const marked = counting(b, 'ENEMY_MARKED', () => usePowers(b));
  const strike = hits.find((p) => p.enemy === elite && p.hero === shooter);
  const { hpScale, armor } = ENEMY_TYPES.elite;
  const life = b.heroesState.powerHp * Math.max(1, hpScale);
  const plain = afterArmor(life * share * HERO_POWERS.targetShare.elite * damageMultiplier(b.army), armor);
  const markMs = elite.markMs;
  const boosted = markedDamage(elite, 100);
  const unmarked = markedDamage(grunt, 100);
  // Un secondo di colpi veri sull'élite marchiata
  for (const h of b.army.heroes) b.heroesState.cooldowns.set(h, 1e9);
  const hpBefore = elite.hp;
  hits.length = 0;
  for (let i = 0; i < 60; i++) {
    b.step();
    grunt.z = 800;
    elite.z = 900;
  }
  const onElite = hits.filter((p) => p.enemy === elite);
  const shown = onElite.reduce((sum, p) => sum + p.damage, 0);
  const lost = hpBefore - elite.hp;
  for (let i = 0; i < 60 * seconds; i++) {
    b.step();
    grunt.z = 800;
    elite.z = 900;
  }
  const later = markedDamage(elite, 100);
  check(
    `marchio: marchiati ${marked.map((p) => (p.enemy === elite ? 'élite' : 'normale')).join(', ')} per ${markMs} ms, con un colpo da ${strike?.damage.toFixed(2)} (${plain.toFixed(2)}, senza il suo marchio); un colpo da 100 sull'élite ne toglie ${boosted} (+${markBonus * 100}%), sul normale ${unmarked}; in un secondo ${onElite.length} colpi da ${shown.toFixed(2)} in tutto, l'élite ne ha persi ${lost.toFixed(2)}; dopo ${seconds} s un colpo da 100 ne toglie ${later}`,
    marked.length === 1 &&
      marked[0].enemy === elite &&
      strike !== undefined &&
      near(strike.damage, plain) &&
      markMs === seconds * 1000 &&
      near(boosted, 100 * (1 + markBonus)) &&
      unmarked === 100 &&
      onElite.length > 0 &&
      near(shown, lost) &&
      later === 100,
  );
  check.done();
});

// 198. Furia (l'Attaccabrighe al posto del Fuciliere): i suoi colpi su un corazzato perdono la corazza solo mentre la
// furia è accesa
test('198. Furia: durante la furia i colpi dell’eroe passano la corazza', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 1, loadout: withHero('brawler') });
  const brawler = heroById(b, 'brawler');
  const { armor } = ENEMY_TYPES.armored;
  for (const h of b.army.heroes) b.heroesState.cooldowns.set(h, 1e9);
  let seen = null;
  b.bus.on(EVENTS.ENEMY_HIT, ({ damage, hero }) => {
    if (seen && hero === brawler) seen.add(Math.round(damage * 1e6) / 1e6);
  });
  const enemy = placeEnemy(b, brawler.x, 400, 1e9, ENEMY_TYPES.armored);
  const hold = (frameCount, into = null) => {
    seen = into;
    for (let i = 0; i < frameCount; i++) {
      b.step();
      enemy.z = 400;
    }
    seen = null;
    return into;
  };
  const before = hold(60, new Set());
  b.heroesState.cooldowns.set(brawler, 0);
  const started = counting(b, 'RAPID_FIRE_STARTED', () => hold(30)).length;
  const during = hold(60, new Set());
  const full = brawler.weapon.damage * damageMultiplier(b.army);
  check(
    `furia: colpi sul corazzato (corazza ${armor}) prima ${[...before].join(', ')} (${afterArmor(full, armor)}), durante ${[...during].join(', ')} (${full}); partita ${started}`,
    started === 1 &&
      before.size === 1 &&
      near([...before][0], afterArmor(full, armor)) &&
      during.size === 1 &&
      near([...during][0], full),
  );
  check.done();
});
