import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  GROWTH,
  HEROES,
  LINEUP,
  RARITIES,
  RECRUIT,
  REWARDS,
  STARTING_LOADOUT,
  armyPower,
  createProfile,
  grantRewards,
  heroData,
  levelOf,
  loadoutFrom,
  newBattle,
  placeHero,
  profileFrom,
  pullsToRare,
  recruit,
  starCost,
  starUp,
} from '../support/suite.js';

// 120. Crescita: il livello dall'esperienza (fino al massimo), i numeri in battaglia che crescono con livello e
// stelle, l'abilità più forte alle stelle giuste; al livello 1 con una stella i numeri sono quelli di base
test("120. Crescita: il livello dall'esperienza (fino al massimo), i numeri in battaglia che...", async (t) => {
  const check = checker(t);
  const first = Math.round(GROWTH.xpBase);
  const at = (xp) => levelOf(xp).level;
  // Un comune al livello 1 con una stella ha i numeri di base; un raro o un epico la forza della sua rarità
  const base = Object.keys(HEROES).every((id) => {
    const { growth, ...numbers } = heroData(id, { xp: 0, stars: 1 });
    const { strength } = RARITIES[HEROES[id].rarity];
    if (strength !== 1) return growth === strength && Math.abs(numbers.maxHp - HEROES[id].maxHp * strength) < 1e-9;
    return growth === 1 && JSON.stringify(numbers) === JSON.stringify(HEROES[id]);
  });
  const xpTo5 = [1, 2, 3, 4].reduce((sum, n) => sum + Math.round(GROWTH.xpBase * n ** GROWTH.xpGrowth), 0);
  const grown = heroData('leader', { xp: xpTo5, stars: 3 });
  const scale = (1 + GROWTH.levelBonus * 4) * (1 + GROWTH.starBonus * 2);
  const five = heroData('leader', { xp: 0, stars: 5 });
  const top = levelOf(1e9);
  check(
    `crescita: livello ${at(0)} a 0 esp., ${at(first - 1)} a ${first - 1}, ${at(first)} a ${first}, ${at(xpTo5)} a ${xpTo5}, massimo ${top.level} (${top.next}); numeri di base uguali ${base}; liv. 5 e 3 stelle: vita ${grown.maxHp.toFixed(2)}, arma ${grown.weapon.damage.toFixed(2)}, onda ${grown.ability.damage.toFixed(1)} ogni ${grown.ability.cooldownSeconds.toFixed(2)} s; 5 stelle ogni ${five.ability.cooldownSeconds.toFixed(2)} s`,
    at(0) === 1 &&
      at(first - 1) === 1 &&
      at(first) === 2 &&
      at(xpTo5) === 5 &&
      top.level === GROWTH.maxLevel &&
      top.next === 0 &&
      base &&
      Math.abs(grown.maxHp - HEROES.leader.maxHp * scale) < 1e-9 &&
      Math.abs(grown.weapon.damage - HEROES.leader.weapon.damage * scale) < 1e-9 &&
      Math.abs(grown.ability.damage - HEROES.leader.ability.damage * scale * (1 + GROWTH.abilityDamage)) < 1e-9 &&
      Math.abs(grown.ability.cooldownSeconds - HEROES.leader.ability.cooldownSeconds * (1 - GROWTH.abilityCooldown)) <
        1e-9 &&
      Math.abs(
        five.ability.cooldownSeconds - HEROES.leader.ability.cooldownSeconds * (1 - GROWTH.abilityCooldown) ** 2,
      ) < 1e-9,
  );
  check.done();
});

// 121. Profilo: chi comincia ha gli eroi di partenza, lo schieramento di partenza e le piastrine; uno schieramento
// salvato sbagliato torna quello di partenza; un salvataggio del 4.2 (eroi senza posseduto e stelle) si carica
test('121. Profilo: chi comincia ha gli eroi di partenza, lo schieramento di partenza e le pi...', async (t) => {
  const check = checker(t);
  const fresh = createProfile();
  const owned = Object.keys(fresh.heroes)
    .filter((id) => fresh.heroes[id].owned)
    .sort()
    .join(' ');
  const starters = Object.values(HEROES)
    .filter((h) => h.starter)
    .map((h) => h.id)
    .sort()
    .join(' ');
  const lineupOk =
    LINEUP.every(({ hero, slot }) => fresh.lineup[slot] === hero) &&
    fresh.lineup.filter(Boolean).length === LINEUP.length;
  const bad = [
    ['rifleman', 'leader', null, null, null],
    ['leader', 'scout', null, null, null],
    ['leader', 'sniper', 'sniper', null, null],
    ['leader', null],
  ].map((lineup) => JSON.stringify(profileFrom({ lineup }).lineup) === JSON.stringify(fresh.lineup));
  const old = profileFrom({
    heroes: { leader: { xp: 120, fragments: 3 }, sniper: { xp: 10, fragments: 0 } },
    resources: { materials: 7 },
  });
  const good = profileFrom({ lineup: ['leader', 'defender', 'rifleman', null, 'sniper'] }).lineup.join(',');
  check(
    `profilo: posseduti ${owned} (di partenza ${starters}), schieramento ${fresh.lineup.join(',')} ${lineupOk}, piastrine ${fresh.resources.dogTags}; schieramenti sbagliati rifatti ${bad.filter(Boolean).length}/${bad.length}, uno giusto tenuto ${good}; dal 4.2: capo ${JSON.stringify(old.heroes.leader)}, materiali ${old.resources.materials}, piastrine ${old.resources.dogTags}`,
    owned === starters &&
      lineupOk &&
      fresh.resources.dogTags === RECRUIT.startTags &&
      bad.every(Boolean) &&
      good === 'leader,defender,rifleman,,sniper' &&
      old.heroes.leader.owned &&
      old.heroes.leader.xp === 120 &&
      old.heroes.leader.stars === 1 &&
      old.resources.materials === 7 &&
      old.resources.dogTags === RECRUIT.startTags,
  );
  check.done();
});

// 122. Schieramento: un eroe va nel posto scelto, scambiandosi con chi c'era se era altrove; null svuota il posto;
// il posto del capo e gli eroi non posseduti non si toccano
test("122. Schieramento: un eroe va nel posto scelto, scambiandosi con chi c'era se era altr...", async (t) => {
  const check = checker(t);
  const p = createProfile();
  placeHero(p, 2, 'rifleman');
  const moved = p.lineup.join(',');
  placeHero(p, 4, 'rifleman');
  const swapped = p.lineup.join(',');
  placeHero(p, 3, null);
  const emptied = p.lineup.join(',');
  placeHero(p, 0, 'sniper');
  placeHero(p, 3, 'scout');
  const untouched = p.lineup.join(',');
  check(
    `schieramento: spostato ${moved}; scambiato ${swapped}; svuotato ${emptied}; capo e non posseduti fermi ${untouched}`,
    moved === 'leader,,rifleman,sniper,defender' &&
      swapped === 'leader,,defender,sniper,rifleman' &&
      emptied === 'leader,,defender,,rifleman' &&
      untouched === emptied,
  );
  check.done();
});

// 123. Stelle: con i frammenti giusti l'eroe sale e li spende; senza, o alla stella massima, no
test("123. Stelle: con i frammenti giusti l'eroe sale e li spende; senza, o alla stella mass...", async (t) => {
  const check = checker(t);
  const p = createProfile();
  const record = p.heroes.sniper;
  const without = starUp(p, 'sniper');
  record.fragments = GROWTH.starCosts.reduce((s, c) => s + c, 0) + 3;
  let ups = 0;
  while (starUp(p, 'sniper')) ups += 1;
  const locked = starUp(p, 'scout');
  check(
    `stelle: senza frammenti ${without}; salite ${ups} fino a ${record.stars}, frammenti rimasti ${record.fragments}, prossima ${starCost(record.stars)}; eroe non posseduto ${locked}`,
    !without &&
      ups === GROWTH.maxStars - 1 &&
      record.stars === GROWTH.maxStars &&
      record.fragments === 3 &&
      starCost(record.stars) === null &&
      !locked,
  );
  check.done();
});

// 124. Reclutamento: costa piastrine (senza niente), lo stesso profilo pesca sempre uguale, mai il capo, almeno un raro
// ogni RECRUIT.pity tiri, i doppioni danno i frammenti della loro rarità, le rarità più o meno nelle loro parti
test('124. Reclutamento: costa piastrine (senza niente), lo stesso profilo pesca sempre ugual...', async (t) => {
  const check = checker(t);
  const pulls = (seed, count) => {
    const p = createProfile();
    p.resources.dogTags = RECRUIT.cost * count;
    const out = [];
    for (let i = 0; i < count; i++) out.push(recruit(p, seed));
    return { p, out };
  };
  const a = pulls(42, 30)
    .out.map((r) => r.id)
    .join(',');
  const b = pulls(42, 30)
    .out.map((r) => r.id)
    .join(',');
  const broke = createProfile();
  broke.resources.dogTags = RECRUIT.cost - 1;
  const none = recruit(broke, 1);
  let longest = 0;
  let leader = 0;
  let dupWrong = 0;
  const counts = { common: 0, rare: 0, epic: 0 };
  for (let seed = 1; seed <= 300; seed++) {
    const { out } = pulls(seed * 1000 + 7, 20);
    let run = 0;
    for (const r of out) {
      counts[r.rarity] += 1;
      run = r.rarity === 'common' ? run + 1 : 0;
      longest = Math.max(longest, run);
      if (r.id === 'leader') leader += 1;
      if (!r.isNew && r.fragments !== RARITIES[r.rarity].duplicate) dupWrong += 1;
    }
  }
  const total = counts.common + counts.rare + counts.epic;
  const share = (n) => Math.round((100 * n) / total);
  check(
    `reclutamento: senza piastrine ${none}; stesso seme stessi tiri ${a === b}; 6000 tiri: comuni ${share(counts.common)}%, rari ${share(counts.rare)}%, epici ${share(counts.epic)}%; comuni di fila al massimo ${longest} (garanzia ogni ${RECRUIT.pity}); capo uscito ${leader}; doppioni sbagliati ${dupWrong}; tiri al raro garantito da zero ${pullsToRare(createProfile())}`,
    none === null &&
      a === b &&
      longest <= RECRUIT.pity - 1 &&
      leader === 0 &&
      dupWrong === 0 &&
      counts.epic > 0 &&
      share(counts.common) <= 72 &&
      share(counts.common) >= 55 &&
      pullsToRare(createProfile()) === RECRUIT.pity,
  );
  check.done();
});

// 125. La battaglia scende in campo con lo schieramento del profilo, con i numeri di livello e stelle, e la potenza
// lo conta; senza schieramento resta quello di partenza
test('125. La battaglia scende in campo con lo schieramento del profilo, con i numeri di live...', async (t) => {
  const check = checker(t);
  const p = createProfile();
  p.heroes.scout.owned = true;
  placeHero(p, 2, 'scout');
  p.heroes.sniper.xp = 400;
  p.heroes.sniper.stars = 3;
  const loadout = loadoutFrom(p);
  const b = newBattle(3, undefined, loadout);
  const ids = b.army.heroes.map((h) => h.id).join(',');
  const sniper = b.army.heroes.find((h) => h.id === 'sniper');
  const plain = newBattle(3)
    .army.heroes.map((h) => h.id)
    .join(',');
  check(
    `schieramento in battaglia: ${ids} (cecchino vita ${sniper.maxHp.toFixed(2)}, arma ${sniper.weapon.damage.toFixed(2)}); senza ${plain}; potenza ${Math.round(armyPower(loadout))} contro ${Math.round(armyPower())}`,
    ids === 'leader,rifleman,scout,sniper,defender' &&
      sniper.maxHp > HEROES.sniper.maxHp &&
      sniper.weapon.damage > HEROES.sniper.weapon.damage &&
      plain === LINEUP.map((e) => e.hero).join(',') &&
      armyPower(loadout) > armyPower() &&
      armyPower(STARTING_LOADOUT) === armyPower(),
  );
  check.done();
});

// 127. La vittoria dà anche le piastrine del reclutamento; la sconfitta no
test('127. La vittoria dà anche le piastrine del reclutamento; la sconfitta no', async (t) => {
  const check = checker(t);
  const p = createProfile();
  const heroes = [{ id: 'leader', damageDealt: 1, damageTaken: 0, kills: 0 }];
  const base = {
    distance: 1,
    wave: 4,
    boss: true,
    heroes,
    loot: { materials: 0, xp: 0, scrap: 0, accelerators: 0, fragments: {} },
  };
  const won = grantRewards(p, { ...base, completed: true });
  const lost = grantRewards(p, { ...base, completed: false });
  check(
    `piastrine: vittoria +${won.prize.dogTags}, sconfitta +${lost.prize.dogTags}, ora ${p.resources.dogTags}`,
    won.prize.dogTags === REWARDS.victory.dogTags &&
      lost.prize.dogTags === 0 &&
      p.resources.dogTags === RECRUIT.startTags + REWARDS.victory.dogTags,
  );
  check.done();
});
