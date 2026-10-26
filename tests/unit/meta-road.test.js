import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  LENGTHS, ROAD, ROAD_TILES, VILLAGE, WORLD, areaProgress, areaRect, battle, bossBattle, canStep, conqueredAreas,
  conquestAreas, conquestReward, count, createProfile, gateCells, hasCell, kindKnown, lastOf, newBattle, onRoad,
  overlaps, profileFrom, roadLoadout, roadMeta, roadStep, roadTileAt, same, storage, stored, villageModule,
  villageRect, winRoadTile,
} from '../support/suite.js';

// 160. Il percorso: parte dalla porta (la cella dentro, poi quella fuori), ogni casella accanto alla precedente, ogni
// pezzo dentro la sua area, le 24 aree tutte diverse e fuori dal villaggio; mai due pezzi di strada che si toccano,
// nemmeno in diagonale (solo le curve); la prima area ha 10 caselle, le altre circa 12
test('160. Il percorso: parte dalla porta (la cella dentro, poi quella fuori), ogni casella a...', async (t) => {
  const check = checker(t);
  const { inside, outside } = gateCells();
  const start = ROAD_TILES[0].col === inside.col && ROAD_TILES[0].row === inside.row && ROAD_TILES[0].kind === 'gate' &&
    ROAD_TILES[1].col === outside.col && ROAD_TILES[1].row === outside.row;
  let jumps = 0;
  for (let index = 1; index < ROAD_TILES.length; index++) {
    const a = ROAD_TILES[index - 1];
    const b = ROAD_TILES[index];
    if (Math.abs(a.col - b.col) + Math.abs(a.row - b.row) !== 1) jumps += 1;
  }
  const areas = conquestAreas();
  const outsideArea = ROAD_TILES.slice(1).filter((tile) => !hasCell(areaRect(areas[tile.area]), tile)).length;
  const distinct = new Set(areas.map(({ col, row }) => `${col},${row}`)).size === areas.length;
  const notVillage = areas.every((area) => !overlaps(areaRect(area), villageRect()));
  let contacts = 0;
  for (const a of ROAD_TILES) {
    for (const b of ROAD_TILES) {
      const gap = b.index - a.index;
      if (gap < 2) continue;
      const dc = Math.abs(a.col - b.col);
      const dr = Math.abs(a.row - b.row);
      if (Math.max(dc, dr) > 1) continue;
      if (gap === 2 && dc === 1 && dr === 1) continue;
      contacts += 1;
    }
  }
  const inVillage = ROAD_TILES.slice(1).filter((tile) => hasCell(villageRect(), tile)).length;
  const lengths = areas.map((_, area) => ROAD_TILES.filter((tile) => tile.area === area).length);
  const lookup = ROAD_TILES.every((tile) => roadTileAt(tile.col, tile.row) === tile) && roadTileAt(17, 17) === null;
  check(`strada: ${ROAD_TILES.length} caselle dalla porta ${start}, salti ${jumps}, fuori dalla sua area ${outsideArea}, aree ${areas.length} diverse ${distinct} fuori dal villaggio ${notVillage}; pezzi che si toccano ${contacts}, nel villaggio ${inVillage}; caselle per area ${lengths.join(' ')}; cerca per cella ${lookup}`,
    start && jumps === 0 && outsideArea === 0 && areas.length === WORLD.areas ** 2 - 1 && distinct && notVillage &&
    contacts === 0 && inVillage === 0 && lengths[0] === 10 && lengths.slice(1).every((n) => n >= 11 && n <= 14) && lookup);
  check.done();
});

// 161. Le caselle di ogni area: l'ingresso neutro, il boss in fondo, battaglie mai vicine né subito prima del boss, circa
// un terzo battaglie e un terzo raccolte; battaglie sempre più dure lungo la strada, e così i boss, ognuno più duro
// delle battaglie della sua area; le raccolte crescono di area in area; solo le battaglie costano
test('161. Le caselle di ogni area: l\'ingresso neutro, il boss in fondo, battaglie mai vicin...', async (t) => {
  const check = checker(t);
  let shape = true;
  let close = 0;
  const shares = { battle: 0, collect: 0, neutral: 0, middle: 0 };
  conquestAreas().forEach((_, area) => {
    const tiles = ROAD_TILES.filter((tile) => tile.area === area);
    if (tiles[0].kind !== 'neutral' || tiles.at(-1).kind !== 'boss') shape = false;
    for (let index = 1; index < tiles.length - 1; index++) {
      shares[tiles[index].kind] += 1;
      shares.middle += 1;
      if (tiles[index].kind === 'battle' && tiles[index + 1].kind !== 'neutral' && tiles[index + 1].kind !== 'collect') close += 1;
    }
  });
  const battles = ROAD_TILES.filter((tile) => tile.rules);
  const rising = (list) => list.every((tile, index) => index === 0 || tile.rules.enemyHpScale >= list[index - 1].rules.enemyHpScale);
  const harder = rising(battles.filter((tile) => tile.kind === 'battle')) && rising(battles.filter((tile) => tile.kind === 'boss'));
  const bosses = conquestAreas().every((_, area) => {
    const own = battles.filter((tile) => tile.area === area);
    return own.slice(0, -1).every((tile) => tile.rules.enemyHpScale < own.at(-1).rules.enemyHpScale);
  });
  const materials = ROAD_TILES.filter((tile) => tile.resource === 'materials');
  const grow = materials.at(-1).amount > materials[0].amount;
  const costs = Object.fromEntries(['gate', 'neutral', 'collect', 'battle', 'boss'].map((kind) => [kind, roadMeta.stepCost({ kind })]));
  const battleShare = shares.battle / shares.middle;
  const collectShare = shares.collect / shares.middle;
  check(`caselle: ingresso e boss ${shape}, battaglie vicine o prima del boss ${close}; battaglie ${Math.round(100 * battleShare)}%, raccolte ${Math.round(100 * collectShare)}%; più dure lungo la strada ${harder}, boss più duri ${bosses} (dal primo ×${battles[0].rules.enemyHpScale.toFixed(2)} all'ultimo ×${battles.at(-1).rules.enemyHpScale.toFixed(2)}); materiali da ${materials[0].amount} a ${materials.at(-1).amount}; costi ${JSON.stringify(costs)}`,
    shape && close === 0 && battleShare > 0.3 && battleShare < 0.4 && collectShare > 0.3 && collectShare < 0.4 && harder &&
    bosses && grow && costs.battle === ROAD.cost.battle && costs.boss === ROAD.cost.boss && costs.neutral === 0 && costs.collect === 0);
  check.done();
});

// 162. Passi: neutre e raccolte non costano, la raccolta dà la sua risorsa (i frammenti a uno schierato); entrare in una
// battaglia costa le sue razioni, e senza non si entra; finché non è vinta non si va avanti; persa si riprova senza
// pagare; vinta si prosegue
test('162. Passi: neutre e raccolte non costano, la raccolta dà la sua risorsa (i frammenti a...', async (t) => {
  const check = checker(t);
  let wrong = 0;
  let freeSteps = 0;
  const seen = new Set();
  for (let at = 0; at < ROAD_TILES.length - 1; at++) {
    const p = onRoad(at);
    p.resources.rations = 50;
    const next = ROAD_TILES[at + 1];
    const before = JSON.parse(JSON.stringify(p));
    const result = roadStep(p);
    const paid = before.resources.rations - p.resources.rations;
    let ok = result !== null && result.tile === next && p.road.at === next.index;
    if (next.kind === 'collect') {
      seen.add(next.resource);
      const { kind, amount, hero } = result.gain;
      if (kind === 'fragments') ok &&= p.heroes[hero].fragments === before.heroes[hero].fragments + amount && p.lineup.includes(hero);
      else if (kind === 'rations') ok &&= p.resources.rations === before.resources.rations + amount;
      else ok &&= p.resources[kind] === before.resources[kind] + amount;
      ok &&= p.road.done && amount === next.amount;
    } else {
      ok &&= paid === roadMeta.stepCost(next) && p.road.done === !roadMeta.isBattle(next) && result.gain === null;
    }
    if (!roadMeta.isBattle(next) && paid <= 0) freeSteps += 1;
    if (!ok) wrong += 1;
  }
  const firstBattle = ROAD_TILES.find((tile) => tile.kind === 'battle');
  const poor = onRoad(firstBattle.index - 1);
  poor.resources.rations = ROAD.cost.battle - 1;
  const broke = roadStep(poor);
  const pending = onRoad(firstBattle.index, false);
  pending.resources.rations = 50;
  const blocked = roadStep(pending);
  const rations = pending.resources.rations;
  const lost = pending.road.done;
  const won = winRoadTile(pending, firstBattle.index);
  const again = winRoadTile(pending, firstBattle.index);
  const after = roadStep(pending);
  check(`passi: sbagliati ${wrong}, gratis ${freeSteps}, raccolte ${[...seen].join(' ')}; senza razioni ${broke}; sulla battaglia da vincere ${blocked} (razioni uguali ${pending.resources.rations === rations + 0}, fatta ${lost}); vinta ${won} poi fatta ${pending.road.done}, di nuovo ${again}; avanti ${after?.tile.index}`,
    wrong === 0 && freeSteps > 0 && seen.size >= 5 && broke === null && blocked === null && !lost && won === null &&
    pending.road.done && again === null && after?.tile.index === firstBattle.index + 1 && canStep(onRoad(0)));
  check.done();
});

// 163. Il boss conquista l'area: il suo premio entra nelle risorse, l'area conta tra le conquistate e quella dopo è la
// prossima; si vedono il tipo delle prossime ROAD.sight caselle e il boss dell'area da conquistare, mai più in là
test('163. Il boss conquista l\'area: il suo premio entra nelle risorse, l\'area conta tra le...', async (t) => {
  const check = checker(t);
  const boss = lastOf(0);
  const p = onRoad(boss.index, false);
  const before = { ...p.resources };
  const conquest = winRoadTile(p, boss.index);
  const reward = conquestReward(0);
  const paid = Object.entries(reward).every(([kind, amount]) => p.resources[kind] === before[kind] + amount);
  const progress = areaProgress(p);
  const counts = [onRoad(0), onRoad(boss.index - 1), onRoad(boss.index, false), p].map((q) => conqueredAreas(q.road));
  const fresh = onRoad(0);
  const known = ROAD_TILES.filter((tile) => kindKnown(fresh, tile)).map((tile) => tile.index);
  const end = areaProgress(onRoad(ROAD_TILES.length - 1, true));
  const bigger = conquestReward(5).materials > reward.materials;
  check(`conquista: ${JSON.stringify(conquest)} pagata ${paid}; aree conquistate ${counts.join(' ')}; ora l'area ${progress.area + 1} (${progress.count} caselle, raggiunte ${progress.reached}); si vedono dalla porta ${known.join(',')}; strada finita ${end}; premio che cresce ${bigger}`,
    conquest?.area === 0 && paid && counts.join(' ') === '0 0 0 1' && progress.area === 1 && progress.reached === 0 &&
    known.join(',') === `0,1,2,${boss.index}` && end === null && bigger);
  check.done();
});

// 164. Il territorio cresce con le aree conquistate: prima della conquista nell'area 1 non si costruisce, dopo sì, ma
// non sulla strada, non a ridosso delle mura e non a cavallo tra mura e area; il posto libero si trova anche lì
test('164. Il territorio cresce con le aree conquistate: prima della conquista nell\'area 1 n...', async (t) => {
  const check = checker(t);
  const { canPlace, freeSpot } = villageModule;
  const east = areaRect(conquestAreas()[0]);
  const empty = createProfile().village.positions;
  const cell = { col: east.col + 3, row: east.row + 1 };
  const before = canPlace(empty, 'farm', cell, 0);
  const after = canPlace(empty, 'farm', cell, 1);
  const road = ROAD_TILES.find((tile) => tile.area === 0 && tile.col > east.col);
  const onRoadCell = canPlace(empty, 'farm', { col: road.col - 1, row: road.row - 1 }, 1);
  const nearWall = canPlace(empty, 'farm', { col: east.col, row: east.row }, 1);
  const across = canPlace(empty, 'farm', { col: east.col - 1, row: east.row + 1 }, 1);
  const spot = freeSpot(empty, 'barracks', 1, { col: east.col + 4, row: east.row + 2 });
  const spotIn = spot !== null && hasCell(east, spot) && canPlace(empty, 'barracks', spot, 1);
  const p = onRoad(lastOf(0).index, true);
  p.resources.materials = 100;
  const placed = villageModule.placeBuilding(p, 'farm', cell, 0);
  const q = onRoad(lastOf(0).index - 1, true);
  q.resources.materials = 100;
  const early = villageModule.placeBuilding(q, 'farm', cell, 0);
  check(`territorio: nell'area 1 prima ${before}, dopo ${after}; sulla strada ${onRoadCell}, a ridosso delle mura ${nearWall}, a cavallo ${across}; posto libero ${JSON.stringify(spot)} nell'area ${spotIn}; messa dopo la conquista ${placed}, prima ${early}`,
    !before && after && !onRoadCell && !nearWall && !across && spotIn && placed && !early);
  check.done();
});

// 165. Salvataggio: la strada si tiene; caselle sbagliate o mancanti ripartono dalla porta (anche i salvataggi della
// mappa a bivi); una casella che non si combatte è sempre fatta; un edificio salvato in un'area non conquistata torna
// nel villaggio
test('165. Salvataggio: la strada si tiene; caselle sbagliate o mancanti ripartono dalla port...', async (t) => {
  const check = checker(t);
  const battle = ROAD_TILES.find((tile) => tile.kind === 'battle');
  const p = onRoad(battle.index, false);
  const kept = profileFrom(JSON.parse(JSON.stringify(p))).road;
  const bad = [{ at: -1, done: true }, { at: 9999, done: true }, { at: 2.5 }, 'strada', null]
    .map((road) => profileFrom({ road }).road);
  const old = profileFrom({ map: { chapter: 2, seed: 5, position: 3, visited: [0, 1, 3], cleared: [0, 1] } });
  const neutral = ROAD_TILES.find((tile) => tile.kind === 'neutral' && tile.index > 0);
  const forced = profileFrom({ road: { at: neutral.index, done: false } }).road;
  const east = areaRect(conquestAreas()[0]);
  const farm = { col: east.col + 3, row: east.row + 1 };
  const save = (at) => profileFrom({ road: { at, done: true }, village: { levels: { farm: 1 }, positions: { farm } } });
  const home = save(0).village.positions.farm;
  const stays = save(lastOf(0).index).village.positions.farm;
  check(`strada salvata: tenuta ${JSON.stringify(kept)}; sbagliate ${JSON.stringify(bad)}; dalla mappa a bivi ${JSON.stringify(old.road)} (niente mappa ${old.map === undefined}); neutra fatta ${forced.done}; fattoria nell'area 1 senza conquista ${JSON.stringify(home)}, con la conquista ${JSON.stringify(stays)}`,
    JSON.stringify(kept) === JSON.stringify(p.road) && bad.every((road) => road.at === 0 && road.done) &&
    old.road.at === 0 && old.map === undefined && forced.done && hasCell(villageRect(), home) &&
    stays.col === farm.col && stays.row === farm.row);
  check.done();
});

// 166. La battaglia di una casella ha i nemici della casella (lo schieramento le dà le sue regole)
test('166. La battaglia di una casella ha i nemici della casella (lo schieramento le dà le su...', async (t) => {
  const check = checker(t);
  const tile = ROAD_TILES.filter((other) => other.kind === 'battle')[5];
  const p = onRoad(tile.index, false);
  const battle = newBattle(9, undefined, roadLoadout(p, tile.rules));
  const boss = lastOf(2);
  const bossBattle = newBattle(9, undefined, roadLoadout(p, boss.rules));
  check(`battaglie della strada: vita dei nemici ×${battle.spawner.hpScale.toFixed(2)} (casella ×${tile.rules.enemyHpScale.toFixed(2)}), boss dell'area 3 ×${bossBattle.spawner.hpScale.toFixed(2)}`,
    battle.spawner.hpScale === tile.rules.enemyHpScale && bossBattle.spawner.hpScale === boss.rules.enemyHpScale);
  check.done();
});

// 168. Revisione: la fattoria dice quando avrà le razioni che mancano (due, non solo la prossima); la strada non trova
// caselle fuori dal mondo; le raccolte di un'area non ripetono la stessa risorsa finché non sono uscite tutte
test('168. Revisione: la fattoria dice quando avrà le razioni che mancano (due, non solo la p...', async (t) => {
  const check = checker(t);
  const { nextRationIn } = villageModule;
  const p = createProfile();
  p.village.levels.farm = 1;
  p.village.farm = { stored: 0.5, since: 0 };
  const perHour = VILLAGE.buildings.farm.rationsPerHour[0];
  const one = nextRationIn(p);
  const two = nextRationIn(p, 2);
  const timesOk = Math.abs(one - (0.5 / perHour) * 3600000) < 1 && Math.abs(two - (1.5 / perHour) * 3600000) < 1;
  p.village.farm.stored = VILLAGE.buildings.farm.storage[0] - 0.5;
  const tooMany = nextRationIn(p, 2);
  const outside = [[-1, 0], [0, -1], [35, 3], [3, 35], [12, 35]].every(([col, row]) => roadTileAt(col, row) === null);
  let repeats = 0;
  const kinds = Object.keys(ROAD.collect).length;
  conquestAreas().forEach((_, area) => {
    const picks = ROAD_TILES.filter((tile) => tile.area === area && tile.kind === 'collect').map((tile) => tile.resource);
    if (new Set(picks).size < Math.min(picks.length, kinds)) repeats += 1;
  });
  check(`revisione della strada: prossima razione tra ${Math.round(one / 1000)} s, due tra ${Math.round(two / 1000)} s (${timesOk}), oltre il tetto ${tooMany}; fuori dal mondo nessuna casella ${outside}; aree con raccolte ripetute ${repeats}`,
    timesOk && tooMany === null && outside && repeats === 0);
  check.done();
});

// 182. Le durate sulla strada: ogni battaglia ne ha una; la prima area comincia piano (ROAD.opening); nelle altre la
// prima battaglia è corta e l'ultima, la più vicina al boss, non è lunga; ci sono tutte e tre le durate, più corte e
// medie che lunghe; il boss è sempre lungo; le caselle sono quelle del 4.8 (le durate hanno un seme loro)
test('182. Le durate sulla strada: ogni battaglia ne ha una; la prima area comincia piano (RO...', async (t) => {
  const check = checker(t);
  let missing = 0;
  let wrongFirst = 0;
  let longLast = 0;
  const counts = { short: 0, medium: 0, long: 0 };
  const firstArea = ROAD_TILES.filter((tile) => tile.area === 0 && tile.kind === 'battle').map((tile) => tile.rules.length);
  conquestAreas().forEach((_, area) => {
    const battles = ROAD_TILES.filter((tile) => tile.area === area && tile.kind === 'battle').map((tile) => tile.rules.length);
    if (battles.some((length) => !Object.hasOwn(LENGTHS, length))) missing += 1;
    if (area > 0 && battles[0] !== ROAD.firstLength) wrongFirst += 1;
    if (battles.length > 1 && battles.at(-1) === 'long') longLast += 1;
    for (const length of battles) counts[length] += 1;
  });
  const opening = firstArea.join(',') === ROAD.opening.slice(0, firstArea.length).join(',');
  const bosses = ROAD_TILES.filter((tile) => tile.kind === 'boss').every((tile) => tile.rules.length === ROAD.bossLength);
  const kinds = ROAD_TILES.filter((tile) => tile.area === 0).map((tile) => tile.kind).join(',');
  const same = kinds === 'neutral,collect,battle,collect,battle,collect,neutral,battle,neutral,boss';
  check(`durate sulla strada: ${JSON.stringify(counts)}; prima area ${firstArea.join(' ')} (${opening}); senza durata ${missing}, aree che non cominciano corte ${wrongFirst}, con una lunga prima del boss ${longLast}; boss lunghi ${bosses}; caselle come nel 4.8 ${same}`,
    missing === 0 && opening && wrongFirst === 0 && longLast === 0 && bosses && same && ROAD.bossLength === 'long' &&
    counts.long > 0 && counts.short > counts.long && counts.medium > counts.long);
  check.done();
});
