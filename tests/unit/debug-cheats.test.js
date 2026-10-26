import { test } from 'node:test';
import { checker } from '../support/check.js';
import { GROWTH } from '../../src/data/growth.js';
import { VILLAGE } from '../../src/data/village.js';
import { WORLD } from '../../src/data/world.js';
import {
  addResources,
  finishBuild,
  jumpToArea,
  jumpToTile,
  setBuilders,
  setHeroLevel,
  setHeroStars,
  skipTime,
  unlockHeroes,
} from '../../src/debug/cheats.js';
import { levelOf } from '../../src/meta/heroes.js';
import { createProfile, profileFrom, storedProfile } from '../../src/meta/profile.js';
import { ROAD_TILES, conqueredAreas, isBattle } from '../../src/meta/road.js';
import { canPlace, canUpgrade, freeSpot, placeBuilding, settle, siteOf, startUpgrade } from '../../src/meta/village.js';
import { areaRect } from '../../src/meta/world.js';

// I trucchi di prova del pannello di sviluppo (debug/cheats.js) su profili in memoria, con l'ora ferma: cambiano il
// profilo come promettono, tengono i numeri dentro i limiti, e il profilo cambiato si salva e si rilegge uguale
const T0 = 1_800_000_000_000;
const MINUTE = 60000;

// Il profilo come tornerebbe dal telefono: scritto e riletto (meta/profile.js)
function reread(profile) {
  return profileFrom(JSON.parse(JSON.stringify(storedProfile(profile))));
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// La fattoria al livello 1, vuota, che produce da T0, e risorse per costruire
function withFarm() {
  const profile = createProfile();
  profile.village.levels.center = VILLAGE.buildings.center.maxLevel;
  profile.village.levels.farm = 1;
  profile.village.positions.farm = freeSpot(profile.village.positions, 'farm', 0);
  profile.village.farm = { stored: 0, since: T0 };
  Object.assign(profile.resources, { wood: 500, stone: 500, gears: 100 });
  return profile;
}

test('Trucchi: risorse in più per tutte, e in meno fino a zero', (t) => {
  const check = checker(t);
  const profile = createProfile();
  const before = { ...profile.resources };
  addResources(profile, 250);
  const added = Object.keys(before).every((kind) => profile.resources[kind] === before[kind] + 250);
  const kept = same(reread(profile).resources, profile.resources);
  addResources(profile, -1000);
  const zero = Object.values(profile.resources).every((amount) => amount === 0);
  check(
    `risorse: +250 a tutte le ${Object.keys(before).length} (${JSON.stringify(before)} → ${added}), rilette uguali ${kept}; −1000 le porta a zero ${zero}`,
    added && kept && zero,
  );
  check.done();
});

test('Trucchi: il cantiere aperto finisce subito; senza cantiere non cambia niente', (t) => {
  const check = checker(t);
  const profile = withFarm();
  const spot = freeSpot(profile.village.positions, 'barracks', 0);
  const started = placeBuilding(profile, 'barracks', spot, T0);
  const now = T0 + MINUTE / 2;
  const finished = finishBuild(profile, now);
  const level = profile.village.levels.barracks;
  const open = siteOf(profile, 'barracks');
  const produced = profile.village.farm.stored;
  const before = JSON.stringify(profile);
  const again = finishBuild(profile, now);
  const untouched = JSON.stringify(profile) === before;
  check(
    `cantiere della caserma (${VILLAGE.buildings.barracks.minutes[0]} min) aperto ${started}: finito dopo mezzo minuto ${finished}, livello ${level}, cantiere ${JSON.stringify(open)}, la fattoria ha prodotto fin lì ${produced}; senza cantiere ${again} e profilo uguale ${untouched}`,
    started && finished && level === 1 && open === null &&
      Math.abs(produced - VILLAGE.buildings.farm.rationsPerHour[0] / 120) < 1e-9 && again === false && untouched,
  );
  check.done();
});

// Il tempo saltato sposta indietro i tempi del villaggio, non l'orologio: riletto dal telefono, la fattoria continua
// a produrre da adesso invece di restare ferma
test('Trucchi: far passare il tempo finisce i cantieri e fa produrre la fattoria, anche dopo averlo riletto', (t) => {
  const check = checker(t);
  const profile = withFarm();
  const spot = freeSpot(profile.village.positions, 'barracks', 0);
  placeBuilding(profile, 'barracks', spot, T0);
  const perHour = VILLAGE.buildings.farm.rationsPerHour[0];
  skipTime(profile, 10 * MINUTE, T0);
  const { levels, farm } = profile.village;
  const construction = siteOf(profile, 'barracks');
  const after = { barracks: levels.barracks, stored: farm.stored, since: farm.since, construction };
  const back = reread(profile);
  settle(back, T0 + 10 * MINUTE);
  const later = back.village.farm.stored;
  const short = withFarm();
  skipTime(short, 0, T0);
  const nothing = short.village.farm.stored === 0 && short.village.sites.length === 0;
  check(
    `10 minuti saltati: caserma al livello ${after.barracks} (cantiere ${JSON.stringify(after.construction)}), fattoria ${after.stored} razioni (${perHour} l'ora), fin quando ha prodotto ${after.since - T0} ms da adesso; riletto e passati altri 10 minuti veri ne ha ${later}; senza tempo niente ${nothing}`,
    after.barracks === 1 && after.construction === null && Math.abs(after.stored - perHour / 6) < 1e-9 &&
      after.since === T0 && Math.abs(later - perHour / 3) < 1e-9 && nothing,
  );
  check.done();
});

// A1. Con due posti cantiere i trucchi seguono tutti i cantieri: Finisci li chiude tutti e due, il tempo saltato li
// porta avanti tutti e due. I posti si cambiano di uno: da 1 a uno per edificio, mai meno dei cantieri aperti
test('A1. Trucchi con più cantieri: finiti e portati avanti tutti; posti cantiere dentro i loro limiti', (t) => {
  const check = checker(t);
  const original = VILLAGE.builders;
  try {
    VILLAGE.builders = 2;
    const twoSites = () => {
      const profile = withFarm();
      placeBuilding(profile, 'barracks', freeSpot(profile.village.positions, 'barracks', 0), T0);
      startUpgrade(profile, 'farm', T0);
      return profile;
    };
    const finished = twoSites();
    const done = finishBuild(finished, T0 + MINUTE / 2);
    const finishedLevels = `caserma ${finished.village.levels.barracks}, fattoria ${finished.village.levels.farm}`;
    const skipped = twoSites();
    const ends = skipped.village.sites.map((site) => site.endsAt - T0);
    skipTime(skipped, 3 * MINUTE, T0);
    const left = skipped.village.sites.map((site) => `${site.building} ${(site.endsAt - T0) / MINUTE}`);
    check(
      `due cantieri (fine a +${ends.map((ms) => ms / MINUTE).join(' e +')} min): Finisci ${done}, livelli ${finishedLevels}, aperti ${finished.village.sites.length}; 3 minuti saltati: caserma liv. ${skipped.village.levels.barracks}, aperto ancora ${left.join(', ')} min`,
      done && finished.village.levels.barracks === 1 && finished.village.levels.farm === 2 &&
        finished.village.sites.length === 0 && skipped.village.levels.barracks === 1 &&
        left.join() === `farm ${VILLAGE.buildings.farm.minutes[1] - 3}`,
    );
    VILLAGE.builders = 1;
    const profile = withFarm();
    const steps = [];
    const press = (count) => {
      const changed = setBuilders(profile, count);
      steps.push(`${count} → ${VILLAGE.builders}${changed ? '' : ' (fermo)'}`);
      return changed;
    };
    const below = press(0);
    const most = Object.keys(VILLAGE.buildings).length;
    const up = [press(2), press(most), press(most + 1)];
    placeBuilding(profile, 'barracks', freeSpot(profile.village.positions, 'barracks', 0), T0);
    startUpgrade(profile, 'farm', T0);
    const third = canUpgrade(profile, 'forge');
    const down = [press(2), press(1)];
    check(
      `posti cantiere: ${steps.join(', ')}; con ${most} posti e 2 cantieri aperti un terzo si apre ${third}, e i posti non scendono sotto i cantieri aperti (${profile.village.sites.length})`,
      !below && up.join() === 'true,true,false' && down.join() === 'true,false' && VILLAGE.builders === 2 &&
        profile.village.sites.length === 2 && third,
    );
  } finally {
    VILLAGE.builders = original;
  }
  check.done();
});

test('Trucchi: salto a una casella della strada, dentro la strada; una battaglia resta da vincere', (t) => {
  const check = checker(t);
  const profile = createProfile();
  const battle = ROAD_TILES.find((tile) => tile.kind === 'battle');
  const neutral = ROAD_TILES.find((tile) => tile.kind === 'neutral' && tile.index > battle.index);
  const rows = [battle.index, neutral.index, -5, 99999, 2.6].map((index) => {
    const tile = jumpToTile(profile, index);
    return { index, at: profile.road.at, done: profile.road.done, tile: tile.index };
  });
  const [onBattle, onNeutral, before, after, rounded] = rows;
  const kept = same(reread(profile).road, profile.road);
  check(
    `salti: ${rows.map((row) => `${row.index} → ${row.at} fatta ${row.done}`).join(', ')}; riletto uguale ${kept}`,
    onBattle.at === battle.index && !onBattle.done && onNeutral.at === neutral.index && onNeutral.done &&
      before.at === 0 && before.done && after.at === ROAD_TILES.length - 1 && rounded.at === 3 &&
      rounded.done === !isBattle(ROAD_TILES[3]) && rows.every((row) => row.tile === row.at) && kept,
  );
  check.done();
});

// Le aree conquistate con il salto, senza premio; tornando indietro gli edifici fuori dal territorio rientrano
// rileggendo il profilo
test('Trucchi: salto alle aree conquistate; tornando indietro gli edifici rientrano nel villaggio', (t) => {
  const check = checker(t);
  const profile = createProfile();
  const counts = [0, 1, 3, WORLD.road.length, WORLD.road.length + 5, -2].map((count) => {
    jumpToArea(profile, count);
    const tile = ROAD_TILES[profile.road.at];
    return { count, conquered: conqueredAreas(profile.road), kind: tile.kind, done: profile.road.done };
  });
  const expected = [0, 1, 3, WORLD.road.length, WORLD.road.length, 0];
  const right = counts.every((row, index) => row.conquered === expected[index] && row.done);
  const kinds = counts.map((row) => row.kind);
  const resources = same(profile.resources, createProfile().resources);
  jumpToArea(profile, 1);
  const first = areaRect({ col: WORLD.road[0].area[0], row: WORLD.road[0].area[1] });
  const near = { col: first.col + first.cols / 2, row: first.row + first.rows / 2 };
  profile.village.levels.forge = 1;
  profile.village.positions.forge = freeSpot(profile.village.positions, 'forge', 1, near);
  const outside = !canPlace({}, 'forge', profile.village.positions.forge, 0);
  jumpToArea(profile, 0);
  const back = reread(profile);
  const inside = canPlace({}, 'forge', back.village.positions.forge, 0);
  check(
    `aree conquistate: ${counts.map((row, index) => `${row.count} → ${row.conquered} (${kinds[index]})`).join(', ')}, risorse non toccate ${resources}; fucina nella prima area fuori dal villaggio ${outside}, dopo il salto indietro riletta dentro ${inside} (${JSON.stringify(back.village.positions.forge)})`,
    right && kinds[0] === 'gate' && kinds.slice(1, 5).every((kind) => kind === 'boss') && resources && outside &&
      inside,
  );
  check.done();
});

test('Trucchi: tutti gli eroi sbloccati, livello e stelle dentro i limiti', (t) => {
  const check = checker(t);
  const profile = createProfile();
  const locked = Object.values(profile.heroes).filter((record) => !record.owned).length;
  const lineup = JSON.stringify(profile.lineup);
  unlockHeroes(profile);
  const owned = Object.values(profile.heroes).every((record) => record.owned);
  const levels = [7, 1, 0, 99, 3.4].map((level) => {
    setHeroLevel(profile, 'scout', level);
    const reached = levelOf(profile.heroes.scout.xp);
    return { level, reached: reached.level, inside: reached.xp };
  });
  const stars = [4, 0, 9, 2.5].map((count) => {
    setHeroStars(profile, 'scout', count);
    return profile.heroes.scout.stars;
  });
  setHeroLevel(profile, 'scout', 12);
  setHeroStars(profile, 'scout', 3);
  const back = reread(profile);
  const kept = same(back.heroes, profile.heroes) && JSON.stringify(back.lineup) === lineup;
  check(
    `eroi: ${locked} da sbloccare, tutti posseduti ${owned}, schieramento uguale ${JSON.stringify(profile.lineup) === lineup}; livelli ${levels.map((row) => `${row.level} → ${row.reached} (+${row.inside})`).join(', ')}; stelle ${stars.join(', ')}; rilette uguali ${kept}`,
    locked > 0 && owned &&
      levels.map((row) => row.reached).join() === `7,1,1,${GROWTH.maxLevel},3` &&
      levels.every((row) => row.inside === 0) && stars.join() === `4,1,${GROWTH.maxStars},3` && kept,
  );
  check.done();
});
