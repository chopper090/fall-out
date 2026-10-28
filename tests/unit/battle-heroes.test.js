import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  BOSS,
  BOSS_PHASES,
  ENEMY_SHOT,
  ENEMY_TYPES,
  EVENTS,
  HERO,
  HEROES,
  LINEUP,
  STARTING_LOADOUT,
  WEAPONS,
  battle,
  cooldownShare,
  createHeroFx,
  dt,
  events,
  heroById,
  heroNames,
  laneCenters,
  placeEnemy,
  resetBoss,
  run,
  updateHeroFx,
  updateHeroes,
  weaponArena,
  weaponsOf,
} from '../support/suite.js';
import { damageMultiplier } from '../../src/systems/army.js';

// 1. Schieramento: quattro eroi nei loro posti, il capo è il leader, capo e fuciliere con il colpo normale; i soldati
// sono dell'esercito di partenza (data/loadout.js STARTING_LOADOUT: fucilieri e lanciatori, niente raffica), nelle sue
// proporzioni, con i lanciatori dietro i fucilieri (data/units.js depth)
test('1. Schieramento: quattro eroi nei loro posti, il capo è il leader, capo e fuciliere con...', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 60 });
  const leader = heroById(b, 'leader');
  const rifleman = heroById(b, 'rifleman');
  const slotOf = (hero) => HERO.slots[LINEUP.find((entry) => entry.hero === hero.id).slot];
  const positionsOk = b.army.heroes.every(
    (h) => h.dx === slotOf(h).dx && Math.abs(h.dz - slotOf(h).dz) <= HERO.slotJitter,
  );
  const normalShot = [leader, rifleman].every((h) => h.weapon.name === 'rifle' && h.weapon.kind === 'straight');
  const counts = weaponsOf(b.army);
  const depthOf = (weapon) => b.army.soldiers.filter((s) => s.weapon === weapon).map((s) => s.slot.dz);
  const behind = Math.max(...depthOf('launcher')) <= Math.min(...depthOf('rifle'));
  const { army } = STARTING_LOADOUT;
  const share = army.launcher / (army.rifle + army.launcher);
  const mixOk = Math.abs(counts.launcher - share * b.army.soldiers.length) < 1 && behind;
  check(
    `schieramento: ${heroNames(b)}, capo = leader (${b.army.leader === leader ? 'sì' : 'no'}), posti giusti (${positionsOk ? 'sì' : 'no'}), colpo normale a capo e fuciliere (${normalShot ? 'sì' : 'no'}), soldati dell'esercito di partenza, lanciatori dietro (${mixOk ? 'sì' : 'no'}) ${JSON.stringify(counts)}`,
    b.army.heroes.length === 4 &&
      b.army.leader === leader &&
      positionsOk &&
      normalShot &&
      mixOk &&
      counts.rifle > 0 &&
      counts.burst === 0 &&
      counts.launcher > 0,
  );
  const inside = b.army.soldiers.every((s) =>
    b.army.heroes.every(
      (h) => Math.abs(s.x - h.x) >= (HERO.size + s.size) / 2 - 1 || Math.abs(s.z - h.z) >= (HERO.size + s.size) / 2 - 1,
    ),
  );
  check(
    `nessun soldato dentro un eroe (${inside ? 'sì' : 'no'}), esercito largo ${(b.army.left + b.army.right).toFixed(0)}`,
    inside,
  );
  check.done();
});

// 2. Ogni eroe spara con la sua arma
test('2. Ogni eroe spara con la sua arma', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 1 });
  const seen = new Map();
  let previous = new Set();
  for (let i = 0; i < 60 * 3; i++) {
    b.step();
    const now = new Set([...b.combat.projectiles, ...b.combat.grenades]);
    for (const shot of now) if (!previous.has(shot)) seen.set(shot.weapon, (seen.get(shot.weapon) ?? 0) + 1);
    previous = now;
  }
  const per = b.army.heroes.map((h) => `${h.id} ${seen.get(h.weapon) ?? 0}`).join(', ');
  check(
    `in 3 s: ${per} (attesi ${b.army.heroes.map((h) => `${h.id} ${h.weapon.fireRate * 3 * (h.weapon.pellets ?? 1)}`).join(', ')})`,
    b.army.heroes.every(
      (h) =>
        Math.abs((seen.get(h.weapon) ?? 0) - h.weapon.fireRate * 3 * (h.weapon.pellets ?? 1)) <=
        (h.weapon.pellets ?? 1),
    ),
  );
  check.done();
});

// 3. Lo scontro toglie vita solo all'eroe toccato; un eroe morto sparisce, il capo morto fa fallire
test("3. Lo scontro toglie vita solo all'eroe toccato; un eroe morto sparisce, il capo morto...", async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 1 });
  const defender = heroById(b, 'defender');
  const leader = b.army.leader;
  placeEnemy(b, defender.x, defender.z + 40, 1e9);
  b.step();
  check(
    `nemico addosso al difensore: difensore ${HEROES.defender.maxHp} -> ${defender.hp}, capo ${leader.hp}/${leader.maxHp}`,
    defender.hp === HEROES.defender.maxHp - ENEMY_TYPES.grunt.heroDamage && leader.hp === leader.maxHp,
  );
  const sniper = heroById(b, 'sniper');
  let killed = null;
  b.bus.on(EVENTS.HERO_KILLED, (h) => {
    killed = h;
  });
  sniper.hp = 1;
  b.bus.emit(EVENTS.HERO_HIT, { hero: sniper, damage: 5 });
  b.bus.emit(EVENTS.HERO_HIT, { hero: sniper, damage: 5 });
  const pop = b.armyFx.pops.find((p) => p.hero === sniper);
  check(
    `cecchino ucciso: eroi in campo ${heroNames(b)}, evento una volta (${killed === sniper ? 'sì' : 'no'}), missione ${b.log.over ?? 'in corso'}, scoppio con la sua pedina (${pop ? 'sì' : 'no'}), ricarica dimenticata (${b.heroesState.cooldowns.has(sniper) ? 'no' : 'sì'})`,
    b.army.heroes.length === LINEUP.length - 1 &&
      killed === sniper &&
      !b.log.over &&
      pop &&
      !b.heroesState.cooldowns.has(sniper),
  );
  b.bus.emit(EVENTS.HERO_HIT, { hero: leader, damage: 1e9 });
  check(`capo ucciso: missione ${b.log.over}`, b.log.over === 'fallita');
  check.done();
});

// 4. I tiratori mirano a un eroe a caso
test('4. I tiratori mirano a un eroe a caso', async (t) => {
  const check = checker(t);
  const targets = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const b = weaponArena({ size: 1, seed });
    for (const h of b.army.heroes) h.hp = h.maxHp = 1e9;
    const e = placeEnemy(b, laneCenters[1], 1300, 1e9, ENEMY_TYPES.shooter);
    let fired = 0;
    b.bus.on(EVENTS.ENEMY_FIRED, () => {
      fired += 1;
    });
    for (let i = 0; i < 60 * 5 && fired < 3; i++) {
      b.step();
      for (const shot of b.fire.shots) {
        const aimed = b.army.heroes.reduce(
          (best, h) => {
            const t = (h.z - shot.z) / shot.vz;
            const miss = Math.abs(shot.x + shot.vx * t - h.x);
            return miss < best.miss ? { h, miss } : best;
          },
          { h: null, miss: Infinity },
        );
        if (aimed.miss < 1) targets.add(aimed.h.id);
      }
      e.z = Math.max(e.z, 1150);
    }
  }
  check(`colpi nemici diretti a: ${[...targets].join(', ')}`, targets.size >= 2);
  check.done();
});

// 5. Onda d'urto (Corto raggio, l'Esploratore al posto del Fuciliere): parte solo con nemici vicini, li colpisce
// tutti, li spinge indietro almeno a pushSpeed e li ferma per stunSeconds (non vengono avanti nemmeno con il campo in
// moto, chi non è fermo sì), poi si ricarica
test("5. Onda d'urto: parte solo con nemici vicini, li colpisce tutti, li ferma, poi si ricarica", async (t) => {
  const check = checker(t);
  const loadout = {
    ...STARTING_LOADOUT,
    heroes: STARTING_LOADOUT.heroes.map((entry) => (entry.slot === 1 ? { hero: HEROES.scout, slot: 1 } : entry)),
  };
  const b = weaponArena({ size: 1, loadout });
  const scout = heroById(b, 'scout');
  scout.hp = scout.maxHp = 1e9;
  b.heroesState.cooldowns.set(scout, 0);
  const uses = [];
  b.bus.on(EVENTS.ABILITY_USED, (p) => {
    if (p.ability.kind === 'shockwave') uses.push(p.ability.kind);
  });
  run(b, 1);
  const idle = uses.length;
  const { radius, share, stunSeconds, pushSpeed, cooldownSeconds } = scout.ability;
  const near = placeEnemy(b, scout.x + 60, scout.z + radius - 40, 1e9);
  const far = placeEnemy(b, scout.x, scout.z + radius + 200, 1e9);
  // Il colpo dell'onda toglie la sua quota della vita di un normale della battaglia (con il danno in più dell'esercito)
  const damage = b.heroesState.powerHp * share * damageMultiplier(b.army);
  const hits = new Map();
  b.bus.on(EVENTS.ENEMY_HIT, ({ enemy, damage: d }) => {
    if (Math.abs(d - damage) < 1) hits.set(enemy, (hits.get(enemy) ?? 0) + 1);
  });
  b.step();
  const usedAt = b.log.t;
  const stunned = near.stunMs;
  check(
    `onda d'urto: senza nemici vicini non parte (${idle}), con un nemico a ${radius - 40} parte (${uses.length}): colpito ${hits.get(near) ?? 0} volte per ${Math.round(damage)} (${share * 100}% della vita di un normale, ${b.heroesState.powerHp}), fermo per ${(stunned / 1000).toFixed(2)} s (${stunSeconds}), quello lontano ${hits.get(far) ?? 0}; ricarica ${cooldownShare(b.heroesState, scout).toFixed(2)}`,
    idle === 0 &&
      uses.includes('shockwave') &&
      hits.get(near) === 1 &&
      !hits.has(far) &&
      stunned > 0 &&
      Math.abs(stunned - stunSeconds * 1000) <= dt + 1 &&
      far.stunMs === 0 &&
      Math.abs(cooldownShare(b.heroesState, scout) - 1) < 0.01,
  );
  const knock = near.knock;
  const nearZ = near.z;
  const farZ = far.z;
  let advanced = false;
  for (let i = 0; i < Math.floor(stunSeconds * 60) - 2; i++) {
    b.step();
    advanced ||= near.z < nearZ - 1e-6;
  }
  check(
    `fermo: campo a ${b.scroll.speed}, quello colpito spinto a ${Math.round(knock)} (${pushSpeed}) e mai avanti ${!advanced}; quello lontano avanti di ${Math.round(farZ - far.z)}`,
    b.scroll.speed > 0 && knock >= pushSpeed && !advanced && farZ - far.z > 0,
  );
  for (let i = 0; i < 60 * (cooldownSeconds + 0.5) && uses.length < 2; i++) {
    b.step();
    near.z = scout.z + radius - 40;
  }
  check(
    `seconda onda dopo ${((b.log.t - usedAt) / 1000).toFixed(2)} s (ricarica ${cooldownSeconds})`,
    uses.length === 2 && Math.abs((b.log.t - usedAt) / 1000 - cooldownSeconds) < 0.1,
  );
  check.done();
});

// 6. Colpo perforante: tutti i nemici nella colonna del cecchino fino alla gittata, non quelli di lato
test('6. Colpo perforante: tutti i nemici nella colonna del cecchino fino alla gittata, non q...', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 1 });
  const sniper = heroById(b, 'sniper');
  b.heroesState.cooldowns.set(sniper, 0);
  const { share, range, width } = HEROES.sniper.ability;
  const damage = b.heroesState.powerHp * share * damageMultiplier(b.army);
  const column = [
    placeEnemy(b, sniper.x, 300, 1e9),
    placeEnemy(b, sniper.x + 10, 900, 1e9),
    placeEnemy(b, sniper.x, range - 100, 1e9),
  ];
  const aside = placeEnemy(b, sniper.x + width / 2 + ENEMY_TYPES.grunt.size / 2 + 5, 600, 1e9);
  const beyond = placeEnemy(b, sniper.x, range + 100, 1e9);
  const hits = new Map();
  b.bus.on(EVENTS.ENEMY_HIT, ({ enemy, damage: d }) => {
    if (Math.abs(d - damage) < 1) hits.set(enemy, (hits.get(enemy) ?? 0) + 1);
  });
  b.step();
  check(
    `colpo perforante: in colonna ${column.map((e) => hits.get(e) ?? 0).join(' ')} (attesi 1 1 1), di lato ${hits.get(aside) ?? 0}, oltre la gittata ${hits.get(beyond) ?? 0}`,
    column.every((e) => hits.get(e) === 1) && !hits.has(aside) && !hits.has(beyond),
  );
  check.done();
});

// 7. Scudo: parte quando arrivano colpi, li ferma senza danni finché dura, poi i colpi fanno di nuovo male
test('7. Scudo: parte quando arrivano colpi, li ferma senza danni finché dura, poi i colpi fa...', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 20 });
  const defender = heroById(b, 'defender');
  b.heroesState.cooldowns.set(defender, 0);
  for (const h of b.army.heroes) h.hp = h.maxHp = 1e9;
  let raised = 0;
  let blocked = 0;
  let lost = 0;
  let heroHits = 0;
  b.bus.on(EVENTS.SHIELD_RAISED, () => {
    raised += 1;
  });
  b.bus.on(EVENTS.SHOT_BLOCKED, () => {
    blocked += 1;
  });
  b.bus.on(EVENTS.SOLDIER_KILLED, () => {
    lost += 1;
  });
  b.bus.on(EVENTS.HERO_HIT, () => {
    heroHits += 1;
  });
  run(b, 1);
  const idleOk = raised === 0 && b.heroesState.shieldMs === 0;
  const e = placeEnemy(b, laneCenters[1], 1300, 1e9, ENEMY_TYPES.shooter);
  for (let i = 0; i < 60 * 12 && blocked === 0; i++) {
    b.step();
    e.z = Math.max(e.z, 1150);
  }
  const during = { blocked, lost, heroHits, shield: b.heroesState.shieldMs };
  // Un tiratore spara solo finché sta fermo: finito lo scudo ne arriva un altro. Il primo, finiti i suoi colpi, lascia
  // il campo: senza scontri il danno può venire solo dai colpi del secondo
  b.spawner.enemies.length = 0;
  for (let i = 0; i < 60 * 12 && b.heroesState.shieldMs > 0; i++) b.step();
  const next = placeEnemy(b, laneCenters[1], 1300, 1e9, ENEMY_TYPES.shooter);
  let fired = 0;
  let clashed = 0;
  b.bus.on(EVENTS.ENEMY_FIRED, (enemy) => {
    if (enemy === next) fired += 1;
  });
  b.bus.on(EVENTS.ENEMY_CLASHED, () => {
    clashed += 1;
  });
  for (let i = 0; i < 60 * 12 && lost + heroHits === 0; i++) {
    b.step();
    next.z = Math.max(next.z, 1150);
  }
  check(
    `scudo: fermo senza colpi in arrivo (${idleOk ? 'sì' : 'no'}); alzato ${raised} volte, primo colpo fermato con ${during.shield.toFixed(0)} ms di scudo, persi ${during.lost}, eroi colpiti ${during.heroHits}; dopo lo scudo un colpo fa danno (${lost + heroHits > 0 ? 'sì' : 'no'}, scudo ${b.heroesState.shieldMs}, colpi del secondo tiratore ${fired}, scontri ${clashed})`,
    idleOk &&
      raised >= 1 &&
      during.blocked >= 1 &&
      during.lost === 0 &&
      during.heroHits === 0 &&
      lost + heroHits > 0 &&
      fired > 0 &&
      clashed === 0 &&
      b.heroesState.shieldMs === 0,
  );
  check.done();
});

// 8. Il boss schiaccia tutti gli eroi nella zona, e la zona è segnata sul capo
test('8. Il boss schiaccia tutti gli eroi nella zona, e la zona è segnata sul capo', async (t) => {
  const check = checker(t);
  BOSS.escort.interval = 1e9;
  const b = battle({ size: 1, x: laneCenters[1], startWithBoss: true });
  for (const h of b.army.heroes) h.hp = h.maxHp = 1e9;
  run(b, 1, () => b.boss.enemy);
  b.boss.enemy.hp = b.boss.enemy.maxHp = 1e9;
  run(b, 20, () => b.boss.phase === BOSS_PHASES.warn);
  const zone = { ...b.boss.zone };
  const hpBefore = b.army.heroes.map((h) => h.hp);
  run(b, 3, () => b.enemyFx.smashes.size > 0);
  const lost = b.army.heroes.map((h, i) => hpBefore[i] - h.hp);
  const inside = b.army.heroes.map((h) => Math.hypot(h.x - zone.x, h.z - zone.z) < zone.radius);
  resetBoss();
  check(
    `zona sul capo (${zone.x === b.army.leader.x ? 'sì' : 'no'}); schiacciati: ${b.army.heroes.map((h, i) => `${h.id} -${lost[i]}${inside[i] ? '' : ' (fuori)'}`).join(', ')}`,
    zone.x === b.army.leader.x &&
      inside[0] &&
      lost.every((l, i) => l === (inside[i] ? ENEMY_TYPES.boss.heroDamage : 0)),
  );
  check.done();
});

// 9. Folla ferma: ogni soldato sul suo posto; con swipe veloci nessun soldato entra in un eroe
test('9. Folla ferma: ogni soldato sul suo posto; con swipe veloci nessun soldato entra in un...', async (t) => {
  const check = checker(t);
  const outOfPlace = [];
  for (const size of [20, 40, 60, 100]) {
    const b = weaponArena({ size });
    run(b, 2);
    const off = b.army.soldiers.filter((s) => Math.abs(s.x - (b.army.x + s.slot.dx)) > 0.5).length;
    if (off > 0) outOfPlace.push(`${size}: ${off}`);
  }
  let overlap = 0;
  let grazes = 0;
  let soldierFrames = 0;
  for (const speed of [6, 12, 20]) {
    const b = weaponArena({ size: 100 });
    for (let i = 0; i < 60 * 4; i++) {
      b.bus.emit(EVENTS.STEER, i % 120 < 60 ? -speed : speed);
      b.step();
      soldierFrames += b.army.soldiers.length;
      for (const s of b.army.soldiers)
        for (const h of b.army.heroes) {
          const reach = (HERO.size + s.size) / 2 - 1;
          const depth = Math.min(reach - Math.abs(s.x - h.x), reach - Math.abs(s.z - h.z));
          if (depth <= 0) continue;
          if (Math.abs(s.offsetX) <= 1 && Math.abs(s.offsetZ) <= 1) overlap += 1;
          else if (depth > 10) grazes += 1;
        }
    }
  }
  check(
    `folla ferma: soldati fuori posto ${outOfPlace.length ? outOfPlace.join(', ') : 'nessuno'}; swipe veloci: soldati al loro posto dentro un eroe ${overlap}, che cambiano posto e ci entrano per più di 10 ${grazes} su ${soldierFrames} (${((100 * grazes) / soldierFrames).toFixed(2)}%)`,
    outOfPlace.length === 0 && overlap === 0 && grazes / soldierFrames < 0.005,
  );
  check.done();
});

// 10. Scudo: un colpo già passato dietro tutta la folla non lo alza, uno che arriva sì
test('10. Scudo: un colpo già passato dietro tutta la folla non lo alza, uno che arriva sì', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 40 });
  const defender = heroById(b, 'defender');
  const fakeShot = (z) => ({ x: defender.x, z, vx: 0, vz: -ENEMY_SHOT.speed });
  b.heroesState.cooldowns.set(defender, 0);
  const world = (shot) => ({ enemies: [], enemyShots: [shot], gates: [], bosses: [] });
  updateHeroes(b.heroesState, b.army, world(fakeShot(b.army.back - ENEMY_SHOT.size)), dt);
  const behind = b.heroesState.shieldMs;
  updateHeroes(b.heroesState, b.army, world(fakeShot(b.army.front + 100)), dt);
  const coming = b.heroesState.shieldMs;
  check(
    `scudo: colpo dietro la folla (z ${(b.army.back - ENEMY_SHOT.size).toFixed(0)}, retro ${b.army.back.toFixed(0)}) -> ${behind} ms; colpo in arrivo -> ${coming} ms`,
    behind === 0 && coming > 0,
  );
  check.done();
});

// 11. Schiacciamento: se un eroe muore nel colpo, gli altri nella zona perdono vita lo stesso
test('11. Schiacciamento: se un eroe muore nel colpo, gli altri nella zona perdono vita lo st...', async (t) => {
  const check = checker(t);
  BOSS.escort.interval = 1e9;
  const b = battle({ size: 1, x: laneCenters[1], startWithBoss: true });
  for (const h of b.army.heroes) h.hp = h.maxHp = 1e9;
  run(b, 1, () => b.boss.enemy);
  b.boss.enemy.hp = b.boss.enemy.maxHp = 1e9;
  run(b, 20, () => b.boss.phase === BOSS_PHASES.warn);
  const zone = { ...b.boss.zone };
  const defender = heroById(b, 'rifleman');
  defender.hp = 1;
  const others = b.army.heroes.filter((h) => h !== defender && Math.hypot(h.x - zone.x, h.z - zone.z) < zone.radius);
  const hpBefore = others.map((h) => h.hp);
  run(b, 3, () => b.enemyFx.smashes.size > 0);
  const lost = others.map((h, i) => hpBefore[i] - h.hp);
  resetBoss();
  check(
    `schiacciamento con il fuciliere che muore: in campo ${heroNames(b)}; nella zona ${others.map((h, i) => `${h.id} -${lost[i]}`).join(', ')}`,
    !b.army.heroes.includes(defender) && others.length > 0 && lost.every((l) => l === ENEMY_TYPES.boss.heroDamage),
  );
  check.done();
});

// 12. Senza eroi in campo i tiratori non sparano e non ci sono errori
test('12. Senza eroi in campo i tiratori non sparano e non ci sono errori', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 10 });
  b.army.heroes.length = 0;
  placeEnemy(b, laneCenters[1], 1300, 1e9, ENEMY_TYPES.shooter);
  let error = null;
  try {
    for (let i = 0; i < 60 * 5; i++) b.step();
  } catch (err) {
    error = err;
  }
  check(
    `senza eroi: errore ${error ? error.message : 'nessuno'}, colpi sparati ${events(b, 'ENEMY_FIRED').length}`,
    error === null && events(b, 'ENEMY_FIRED').length === 0,
  );
  check.done();
});

// 13. Fuoco rapido: fermo senza nemici a tiro; con un nemico a tiro parte una volta e per seconds il fuciliere e chi
// gli sta entro radius sparano fireRateScale volte più in fretta, chi è più lontano no; poi tutto torna normale.
// L'anello a terra c'è finché dura
test('13. Fuoco rapido: fermo senza nemici a tiro; con un nemico a tiro parte una volta e per...', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 60 });
  const heroFx = createHeroFx(b.bus);
  const step = () => {
    b.step();
    updateHeroFx(heroFx, dt);
  };
  const rifleman = heroById(b, 'rifleman');
  const { seconds, fireRateScale, radius } = HEROES.rifleman.ability;
  b.heroesState.cooldowns.set(rifleman, 0);
  let started = 0;
  b.bus.on(EVENTS.RAPID_FIRE_STARTED, () => {
    started += 1;
  });
  // Nemici fuori portata: di lato oltre il raggio e oltre la gittata
  const aside = placeEnemy(b, rifleman.x + radius + ENEMY_TYPES.grunt.size / 2 + 20, 600, 1e9);
  const beyond = placeEnemy(b, rifleman.x, rifleman.weapon.range + 200, 1e9);
  for (let i = 0; i < 60; i++) {
    step();
    aside.z = 600;
    beyond.z = rifleman.weapon.range + 200;
  }
  const idle = started;
  b.spawner.enemies.length = 0;
  const distance = (s) => Math.hypot(s.x - rifleman.x, s.z - rifleman.z);
  const sorted = [...b.army.soldiers].sort((a, c) => distance(a) - distance(c));
  const near = sorted[0];
  const far = sorted[sorted.length - 1];
  const shooters = [rifleman, near, far];
  const rateOf = (s) => (s === rifleman ? rifleman.weapon : WEAPONS[s.weapon]).fireRate;
  // Quanto avanza il ritmo di tiro di ognuno in un frame, rispetto al normale (dalla sua fase)
  const paces = () => {
    const before = shooters.map((s) => s.phase);
    step();
    return shooters.map((s, i) => (before[i] - s.phase + (s.phase > before[i] ? 1 : 0)) / ((dt / 1000) * rateOf(s)));
  };
  const enemy = placeEnemy(b, rifleman.x, 700, 1e9);
  const during = [];
  for (let i = 0; i < Math.floor(seconds * 60) - 2; i++) {
    during.push(paces());
    enemy.z = 700;
  }
  const ringDuring = heroFx.boosts.length;
  for (let i = 0; i < 20; i++) {
    step();
    enemy.z = 700;
  }
  const after = [];
  for (let i = 0; i < 30; i++) {
    after.push(paces());
    enemy.z = 700;
  }
  const mean = (rows, c) => rows.reduce((sum, row) => sum + row[c], 0) / rows.length;
  const x = (rows) => shooters.map((_, c) => `x${mean(rows, c).toFixed(2)}`).join(' / ');
  const ok = (rows, expected) => expected.every((e, c) => Math.abs(mean(rows, c) - e) < 0.05);
  check(
    `fuoco rapido: nemici fuori portata ${idle} partenze; con un nemico a tiro ${started}; durante (fuciliere / soldato a ${distance(near).toFixed(0)} / soldato a ${distance(far).toFixed(0)}, raggio ${radius}) ${x(during)}; dopo ${x(after)}; anello durante ${ringDuring}, dopo ${heroFx.boosts.length}`,
    idle === 0 &&
      started === 1 &&
      distance(near) <= radius &&
      distance(far) > radius &&
      ok(during, [fireRateScale, fireRateScale, 1]) &&
      ok(after, [1, 1, 1]) &&
      ringDuring === 1 &&
      heroFx.boosts.length === 0,
  );
  check.done();
});

// 14. Se il fuciliere muore durante il fuoco rapido, il fuoco rapido e il suo anello finiscono subito
test('14. Se il fuciliere muore durante il fuoco rapido, il fuoco rapido e il suo anello fini...', async (t) => {
  const check = checker(t);
  const b = weaponArena({ size: 60 });
  const heroFx = createHeroFx(b.bus);
  const rifleman = heroById(b, 'rifleman');
  b.heroesState.cooldowns.set(rifleman, 0);
  placeEnemy(b, rifleman.x, 700, 1e9);
  b.step();
  updateHeroFx(heroFx, dt);
  const before = b.combat.rapidFire.find((entry) => entry.hero === rifleman)?.ms ?? 0;
  const ringBefore = heroFx.boosts.length;
  b.bus.emit(EVENTS.HERO_HIT, { hero: rifleman, damage: 1e9 });
  b.step();
  updateHeroFx(heroFx, dt);
  check(
    `fuciliere ucciso durante il fuoco rapido: durava ancora ${before.toFixed(0)} ms, dopo ${b.combat.rapidFire.find((entry) => entry.hero === rifleman)?.ms ?? 0} ms; anello ${ringBefore} -> ${heroFx.boosts.length}; in campo ${heroNames(b)}`,
    before > 0 &&
      ringBefore === 1 &&
      (b.combat.rapidFire.find((entry) => entry.hero === rifleman)?.ms ?? 0) === 0 &&
      heroFx.boosts.length === 0 &&
      !b.army.heroes.includes(rifleman),
  );
  check.done();
});

// 16. Finché la folla è piccola l'esercito arriva al centro di ogni corsia, e un nemico esattamente al centro è a tiro
// dei fucili davanti
test("16. Finché la folla è piccola l'esercito arriva al centro di ogni corsia, e un nemico...", async (t) => {
  const check = checker(t);
  const reached = [];
  for (const size of [1, 11, 21, 41]) {
    const b = weaponArena({ size });
    reached.push(
      `${size}: ${laneCenters.every((c) => b.army.snapPoints.includes(c)) ? 'sì' : 'no'} [${b.army.minX.toFixed(0)}, ${b.army.maxX.toFixed(0)}]`,
    );
  }
  const front = LINEUP.filter((entry) => HERO.slots[entry.slot].dz === 0).map((entry) => HEROES[entry.hero]);
  const reach = (hero) => (hero.weapon.size + ENEMY_TYPES.grunt.size) / 2;
  const covered = front.filter(
    (hero) =>
      hero.weapon.kind === 'straight' &&
      Math.abs(HERO.slots[LINEUP.find((e) => e.hero === hero.id).slot].dx) < reach(hero),
  );
  check(
    `centri delle corsie raggiungibili (esercito: ${reached.join('; ')}); nemico al centro a tiro di ${covered.map((h) => h.id).join(' e ')}`,
    reached.every((r) => r.includes('sì')) && covered.length === 2,
  );
  check.done();
});
