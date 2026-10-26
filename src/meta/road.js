import { createRng } from '../core/rng.js';
import { ROAD } from '../data/road.js';
import { DEFAULT_TYPE } from '../data/waves.js';
import { WORLD } from '../data/world.js';
import { levelPower } from '../systems/power.js';

// La difficoltà di prova che non cambia niente, per tarare le regole delle battaglie
const NO_TEST = { enemyHpScale: 1, enemyCountScale: 1 };
import { WORLD_CELLS, areaRect, gateCells } from './world.js';

// La strada unica (data/world.js, data/road.js) e il cammino del giocatore, nel profilo (meta/profile.js road: la
// casella dove si è, at, se è fatta, done, e se la sua battaglia è già stata persa almeno una volta, lost). Si va solo
// avanti, una casella alla volta: le neutre e le raccolte non costano (la raccolta dà subito il suo premio); in una
// battaglia si entra quando parte, pagando le sue razioni, e va vinta prima di proseguire (persa o lasciata a metà, si
// riprova senza pagare di nuovo); il boss in fondo a un'area la conquista, con il suo premio

// Le caselle della strada, in ordine dalla porta: { index, col, row, area (la sua posizione nell'ordine di conquista;
// -1 per la porta), kind (gate, neutral, collect, battle o boss), e per tipo resource e amount (raccolta) o rules
// (battaglie e boss, battleRules) }
export const ROAD_TILES = buildRoad();

const BY_CELL = new Map(ROAD_TILES.map((tile) => [tile.col * WORLD_CELLS + tile.row, tile]));

// La casella della strada nella cella (col, row), o null (anche fuori dal mondo)
export function roadTileAt(col, row) {
  if (col < 0 || row < 0 || col >= WORLD_CELLS || row >= WORLD_CELLS) return null;
  return BY_CELL.get(col * WORLD_CELLS + row) ?? null;
}

// La casella si combatte: battaglia o boss
export function isBattle(tile) {
  return tile.kind === 'battle' || tile.kind === 'boss';
}

// Razioni per entrare nella casella
export function stepCost(tile) {
  return ROAD.cost[tile.kind] ?? 0;
}

// Quante aree ha conquistato il cammino road (come profile.road): quelle prima della casella dove si è, più la sua se
// è il boss battuto. tiles: le caselle della strada
export function conqueredAreas({ at, done }, tiles = ROAD_TILES) {
  const tile = tiles[at];
  if (tile.area < 0) return 0;
  return tile.kind === 'boss' && done ? tile.area + 1 : tile.area;
}

// La casella dove si è
export function hereTile(profile) {
  return ROAD_TILES[profile.road.at];
}

// La prossima casella, null in fondo alla strada
export function nextTile(profile) {
  return ROAD_TILES[profile.road.at + 1] ?? null;
}

// Si può fare un passo: la casella dove si è è fatta, la strada continua e le razioni bastano
export function canStep(profile) {
  const next = nextTile(profile);
  return profile.road.done && next !== null && profile.resources.rations >= stepCost(next);
}

// Le razioni che servono per la prossima battaglia della strada: quelle della prima casella con una battaglia dopo
// quella dove si è; 0 se quella dove si è è ancora da vincere (si riprova senza pagare) o se la strada è finita
export function rationsNeeded(profile) {
  if (!profile.road.done) return 0;
  const ahead = ROAD_TILES.slice(profile.road.at + 1).find(isBattle);
  return ahead === undefined ? 0 : stepCost(ahead);
}

// Le razioni non bastano per la prossima casella, dove si è già pronti a fare il passo
export function rationsShort(profile) {
  const next = nextTile(profile);
  return profile.road.done && next !== null && profile.resources.rations < stepCost(next);
}

// Un passo avanti, se si può: si pagano le razioni della casella nuova; una raccolta dà subito il suo premio (gain:
// { kind, amount, hero }) ed è fatta come una neutra, una battaglia aspetta di essere vinta. Restituisce la casella
// nuova e il premio, o null se il passo non si può fare. Lo fanno walk ed enterBattle
export function step(profile) {
  if (!canStep(profile)) return null;
  const tile = nextTile(profile);
  profile.resources.rations -= stepCost(tile);
  profile.road = { at: tile.index, done: !isBattle(tile), lost: false };
  return { tile, gain: tile.kind === 'collect' ? grant(profile, tile) : null };
}

// Un passo verso una casella senza battaglia (come step): in una battaglia si entra solo quando parte (enterBattle)
export function walk(profile) {
  const next = nextTile(profile);
  return next === null || isBattle(next) ? null : step(profile);
}

// La battaglia della casella index può partire: è quella dove si è, ancora da vincere (si riprova senza pagare), o
// la prossima, se si può fare il passo (le razioni bastano)
export function canFight(profile, index) {
  const tile = ROAD_TILES[index];
  if (tile === undefined || !isBattle(tile)) return false;
  const { at, done } = profile.road;
  return index === at ? !done : index === at + 1 && canStep(profile);
}

// La battaglia della casella index parte, se può (canFight): nella prossima si entra adesso con un passo, che paga le
// sue razioni; in quella dove si è non si paga di nuovo. Restituisce se parte (ready) e il passo fatto (moved, come
// step; null se non c'è stato)
export function enterBattle(profile, index) {
  if (!canFight(profile, index)) return { ready: false, moved: null };
  return { ready: true, moved: index === profile.road.at ? null : step(profile) };
}

// La casella da toccare per andare avanti: quella dove si è se è una battaglia da vincere, se no la prossima (null in
// fondo alla strada)
export function targetTile(profile) {
  return profile.road.done ? nextTile(profile) : hereTile(profile);
}

// La battaglia della casella index, dove si è, è stata vinta: la casella è fatta e, se è il boss, l'area è conquistata
// e il suo premio entra nelle risorse. Restituisce la conquista ({ area, reward }), o null
export function winRoadTile(profile, index) {
  const tile = ROAD_TILES[index];
  if (index !== profile.road.at || profile.road.done || !isBattle(tile)) return null;
  profile.road.done = true;
  if (tile.kind !== 'boss') return null;
  const reward = conquestReward(tile.area);
  for (const [kind, amount] of Object.entries(reward)) profile.resources[kind] += amount;
  return { area: tile.area, reward };
}

// La battaglia della casella index, dove si è, è stata persa: dice se è la prima volta su quella casella (la
// consolazione della sconfitta si dà una volta sola), e da adesso non lo è più
export function loseRoadTile(profile, index) {
  const { road } = profile;
  if (index !== road.at || road.done || road.lost || !isBattle(ROAD_TILES[index])) return false;
  road.lost = true;
  return true;
}

// Il premio della conquista dell'area numero area (da 0)
export function conquestReward(area) {
  const { perArea, ...base } = ROAD.conquest;
  const grown = Object.entries(base).map(([kind, amount]) => [kind, amount + Math.floor(perArea[kind] * area)]);
  return Object.fromEntries(grown);
}

// L'area da conquistare: il suo numero (area, da 0), quante caselle ha (count), quante se ne sono già raggiunte
// (reached) e il suo boss; null quando sono tutte conquistate
export function areaProgress(profile) {
  const area = conqueredAreas(profile.road);
  if (area >= WORLD.road.length) return null;
  const tiles = ROAD_TILES.filter((tile) => tile.area === area);
  return { area, count: tiles.length, reached: Math.max(0, profile.road.at - tiles[0].index + 1), boss: tiles.at(-1) };
}

// Si sa di che tipo è la casella: è già raggiunta, è tra le prossime ROAD.sight o è il boss dell'area da conquistare
// (mai oltre quell'area)
export function kindKnown(profile, tile) {
  const area = conqueredAreas(profile.road);
  if (tile.area > area) return false;
  return tile.index <= profile.road.at + ROAD.sight || (tile.kind === 'boss' && tile.area === area);
}

// Il cammino road (come profile.road) come si salva sul telefono: l'area della casella (-1 la porta), il suo posto
// nell'area (offset, da 0), se è fatta, se è già stata persa e il suo tipo (kind). Il numero della casella dalla porta
// no: cambia quando cambiano le caselle di un'area prima, e il cammino finirebbe in un'altra area. tiles: le caselle
// della strada
export function storedRoad({ at, done, lost }, tiles = ROAD_TILES) {
  const { area, kind } = tiles[at];
  return { area, offset: at - areaStart(area, tiles), done, lost, kind };
}

// Il cammino ({ at, done, lost }) da quello salvato da storedRoad, sulla strada tiles; null se area e offset non sono
// numeri interi o l'area viene prima della porta. Il posto si tiene dentro le caselle dell'area; un'area dopo l'ultima
// (la strada si è accorciata) è l'ultima casella, fatta. Una casella fatta finita su una battaglia (o un boss) che non
// era la sua, perché le caselle dell'area sono cambiate, va combattuta: non si vince una battaglia senza farla; anche
// la sconfitta vale solo sulla sua. Senza il tipo salvato (kind) vale come la sua solo la casella allo stesso posto. Un
// boss torna sempre sul boss della sua area, l'ultima casella, anche se l'area ha cambiato lunghezza
export function restoredRoad({ area, offset, done, lost, kind }, tiles = ROAD_TILES) {
  if (!Number.isInteger(area) || !Number.isInteger(offset) || area < -1) return null;
  const last = tiles.length - 1;
  if (area > tiles[last].area) return { at: last, done: true, lost: false };
  const count = tiles.filter((tile) => tile.area === area).length;
  const kept = kind === 'boss' ? count - 1 : Math.min(Math.max(offset, 0), count - 1);
  const at = areaStart(area, tiles) + kept;
  const same = kind === undefined ? kept === offset : kind === tiles[at].kind;
  return { at, done: done === true && (same || !isBattle(tiles[at])), lost: lost === true && same };
}

// La porta, poi le aree una dopo l'altra lungo i loro punti di svolta, con il tipo di ogni casella. Le battaglie si
// contano dalla porta, e il numero dice il tipo e quanto sono forti i nemici; le raccolte di un'area scelgono la
// risorsa per peso senza ripeterla, finché non le hanno date tutte
function buildRoad() {
  const { inside } = gateCells();
  const tiles = [{ index: 0, col: inside.col, row: inside.row, area: -1, kind: 'gate' }];
  const rng = createRng(ROAD.seed);
  let number = 0;
  WORLD.road.forEach(({ area, turns }, order) => {
    const rect = areaRect({ col: area[0], row: area[1] });
    const cells = alongTurns(turns.map(([col, row]) => ({ col: rect.col + col, row: rect.row + row })));
    const kinds = areaKinds(rng, cells.length);
    const pool = [];
    cells.forEach((cell, slot) => {
      const tile = { index: tiles.length, ...cell, area: order, kind: kinds[slot] };
      if (isBattle(tile)) {
        number += 1;
        tile.rules = battleRules(number, order);
      }
      if (tile.kind === 'collect') {
        if (pool.length === 0) pool.push(...Object.keys(ROAD.collect));
        tile.resource = rng.pick(pool.map((kind) => [kind, ROAD.collect[kind].weight]));
        pool.splice(pool.indexOf(tile.resource), 1);
        const { amount, perArea } = ROAD.collect[tile.resource];
        tile.amount = amount + Math.floor(perArea * order);
      }
      tiles.push(tile);
    });
  });
  return tiles;
}

// Le celle da un punto di svolta al successivo, in linea dritta
function alongTurns(turns) {
  const cells = [turns[0]];
  for (let index = 1; index < turns.length; index++) {
    const to = turns[index];
    let { col, row } = cells.at(-1);
    while (col !== to.col || row !== to.row) {
      col += Math.sign(to.col - col);
      row += Math.sign(to.row - row);
      cells.push({ col, row });
    }
  }
  return cells;
}

// I tipi delle count caselle di un'area: l'ingresso neutro, la battaglia del boss in fondo e in mezzo le altre
// ROAD.battlesPerArea - 1 battaglie (o quante ce ne stanno) e raccolte nei posti che restano, mescolate
function areaKinds(rng, count) {
  const middle = count - 2;
  const battles = Math.min(ROAD.battlesPerArea - 1, middle);
  const kinds = [...Array(battles).fill('battle'), ...Array(middle - battles).fill('collect')];
  return ['neutral', ...rng.shuffle(kinds), 'boss'];
}

// Le regole della battaglia numero number (da 1, dalla porta), nell'area area (data/road.js): il tipo (type), quanta
// vita e quanti arrivi in più hanno i nemici (enemyHpScale, enemyCountScale) perché la squadra che ci si aspetta lì
// abbia il rapporto di potenza del tipo, quanto più spesso arrivano i tipi di ROAD.variety (specialsScale, per tipo),
// quanti colpi chiedono scrigni e cancelli (hitScale), se i cancelli sono tutti negativi (minusOnly) e quanto sono
// profondi (deepScale) e il numero. Le
// sfide del giorno (data/daily.js) cambiano il tipo, il rapporto (ratio), gli arrivi (countScale volte) e i tipi
// speciali (specials, per tipo quante volte più spesso)
export function battleRules(number, area, { type = battleType(number), ratio, countScale = 1, specials = {} } = {}) {
  const { strength, variety, hits } = ROAD;
  const expected = expectedStrength(number);
  const growth = expected / strength.expected[0];
  const enemyCountScale = Math.min(strength.maxCount, growth ** strength.countShare) * countScale;
  const scale = Math.min(variety.max, 1 + variety.perBattle * (number - 1));
  const kinds = [...new Set([...variety.kinds, ...Object.keys(specials)])];
  const specialsScale = Object.fromEntries(
    kinds.map((kind) => [kind, (variety.kinds.includes(kind) ? scale : 1) * (specials[kind] ?? 1)]),
  );
  const wanted = (ratio ?? strength.ratio[type]) * (strength.ease[area] ?? 1);
  // Senza la difficoltà di prova, che vale una volta sola, in battaglia
  const enemyHpScale = expected / wanted / levelPower({ type, enemyCountScale, specialsScale }, NO_TEST);
  const hitScale = hits.scale + hits.perBattle * (number - 1);
  const { minusOnlyFrom, deep } = ROAD.gates;
  const minusOnly = area >= minusOnlyFrom;
  const deepScale = minusOnly ? Math.min(1, deep.from + deep.perArea * (area - minusOnlyFrom)) : 1;
  return { enemyHpScale, enemyCountScale, specialsScale, hitScale, minusOnly, deepScale, type, number };
}

// La forza che ci si aspetta dalla squadra alla battaglia numero number: quella dell'inizio della sua area, cresciuta
// di battaglia in battaglia verso quella dell'area dopo (l'ultima resta)
function expectedStrength(number) {
  const { expected } = ROAD.strength;
  const area = Math.floor((number - 1) / ROAD.battlesPerArea);
  const from = expected[Math.min(area, expected.length - 1)];
  const to = expected[Math.min(area + 1, expected.length - 1)];
  return from + ((to - from) * ((number - 1) % ROAD.battlesPerArea)) / ROAD.battlesPerArea;
}

// Il tipo della battaglia numero number (da 1, dalla porta): il primo di ROAD.cadence che lo divide, se no la normale
export function battleType(number) {
  return ROAD.cadence.find(({ every }) => number % every === 0)?.type ?? DEFAULT_TYPE;
}

// Dove comincia l'area numero area tra le caselle tiles
function areaStart(area, tiles) {
  return tiles.findIndex((tile) => tile.area === area);
}

// Il premio di una raccolta entra nel profilo: una risorsa, o frammenti di un eroe schierato scelto con il seme della
// strada e la casella
function grant(profile, { index, resource, amount }) {
  if (resource !== 'fragments') {
    profile.resources[resource] += amount;
    return { kind: resource, amount, hero: null };
  }
  const lineup = profile.lineup.filter((id) => id !== null);
  const hero = lineup[createRng(ROAD.seed + index).int(lineup.length)];
  profile.heroes[hero].fragments += amount;
  return { kind: resource, amount, hero };
}
