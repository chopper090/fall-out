import { createRng } from '../core/rng.js';
import { ROAD } from '../data/road.js';
import { WORLD } from '../data/world.js';
import { WORLD_CELLS, areaRect, gateCells } from './world.js';

// La strada unica (data/world.js, data/road.js) e il cammino del giocatore, nel profilo (meta/profile.js road: la
// casella dove si è, at, e se è fatta, done). Si va solo avanti, una casella alla volta: le neutre e le raccolte non
// costano (la raccolta dà subito il suo premio), una battaglia costa le razioni entrando e va vinta prima di
// proseguire (persa, si riprova senza pagare di nuovo); il boss in fondo a un'area la conquista, con il suo premio

// Le caselle della strada, in ordine dalla porta: { index, col, row, area (la sua posizione nell'ordine di conquista;
// -1 per la porta), kind (gate, neutral, collect, battle o boss), e per tipo resource e amount (raccolta) o rules
// ({ enemyHpScale, length }: battaglie e boss, con la durata) }
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

// Le razioni non bastano per la prossima casella, dove si è già pronti a fare il passo
export function rationsShort(profile) {
  const next = nextTile(profile);
  return profile.road.done && next !== null && profile.resources.rations < stepCost(next);
}

// Un passo avanti, se si può: si pagano le razioni della casella nuova; una raccolta dà subito il suo premio (gain:
// { kind, amount, hero }) ed è fatta come una neutra, una battaglia aspetta di essere vinta. Restituisce la casella
// nuova e il premio, o null se il passo non si può fare
export function step(profile) {
  if (!canStep(profile)) return null;
  const tile = nextTile(profile);
  profile.resources.rations -= stepCost(tile);
  profile.road = { at: tile.index, done: !isBattle(tile) };
  return { tile, gain: tile.kind === 'collect' ? grant(profile, tile) : null };
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
// nell'area (offset, da 0) e se è fatta. Il numero della casella dalla porta no: cambia quando cambiano le caselle di
// un'area prima, e il cammino finirebbe in un'altra area. tiles: le caselle della strada
export function storedRoad({ at, done }, tiles = ROAD_TILES) {
  const { area } = tiles[at];
  return { area, offset: at - areaStart(area, tiles), done };
}

// Il cammino ({ at, done }) da quello salvato da storedRoad, sulla strada tiles; null se area e offset non sono numeri
// interi o l'area viene prima della porta. Il posto si tiene dentro le caselle dell'area; un'area dopo l'ultima (la
// strada si è accorciata) è l'ultima casella, fatta
export function restoredRoad({ area, offset, done }, tiles = ROAD_TILES) {
  if (!Number.isInteger(area) || !Number.isInteger(offset) || area < -1) return null;
  const last = tiles.length - 1;
  if (area > tiles[last].area) return { at: last, done: true };
  const count = tiles.filter((tile) => tile.area === area).length;
  return { at: areaStart(area, tiles) + Math.min(Math.max(offset, 0), count - 1), done: done === true };
}

// La porta, poi le aree una dopo l'altra lungo i loro punti di svolta, con il tipo di ogni casella. Le raccolte di
// un'area scelgono la risorsa per peso senza ripeterla, finché non le hanno date tutte; le battaglie hanno le durate
// di battleLengths, scelte con un seme loro (ROAD.lengthSeed)
function buildRoad() {
  const { inside } = gateCells();
  const tiles = [{ index: 0, col: inside.col, row: inside.row, area: -1, kind: 'gate' }];
  const rng = createRng(ROAD.seed);
  const lengthRng = createRng(ROAD.lengthSeed);
  WORLD.road.forEach(({ area, turns }, order) => {
    const rect = areaRect({ col: area[0], row: area[1] });
    const cells = alongTurns(turns.map(([col, row]) => ({ col: rect.col + col, row: rect.row + row })));
    const kinds = areaKinds(rng, cells.length);
    const lengths = battleLengths(lengthRng, kinds.filter((kind) => kind === 'battle').length, order);
    const pool = [];
    let battles = 0;
    cells.forEach((cell, slot) => {
      const tile = { index: tiles.length, ...cell, area: order, kind: kinds[slot] };
      const scale = ROAD.battle.hpScale + ROAD.battle.perArea * order + ROAD.battle.perBattle * battles;
      if (tile.kind === 'battle') {
        tile.rules = { enemyHpScale: scale, length: lengths[battles] };
        battles += 1;
      }
      if (tile.kind === 'boss') tile.rules = { enemyHpScale: scale * ROAD.boss.hpScale, length: ROAD.bossLength };
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

// I tipi delle count caselle di un'area: l'ingresso neutro, il boss in fondo e in mezzo battaglie, raccolte e neutre.
// Le battaglie prendono posti a caso mai vicini né subito prima del boss (scelti tra quelli rimasti con un posto
// libero dopo ognuna), le raccolte e le neutre si mescolano negli altri
function areaKinds(rng, count) {
  const middle = count - 2;
  const battles = Math.min(Math.round(middle * ROAD.battleShare), Math.floor(middle / 2));
  const collects = Math.min(Math.round(middle * ROAD.collectShare), middle - battles);
  const slots = shuffle(rng, [...Array(middle - battles).keys()]).slice(0, battles).sort((a, b) => a - b);
  const kinds = Array(middle).fill(null);
  slots.forEach((slot, index) => {
    kinds[slot + index] = 'battle';
  });
  const others = Array.from({ length: middle - battles }, (_, index) => (index < collects ? 'collect' : 'neutral'));
  const rest = shuffle(rng, others);
  return ['neutral', ...kinds.map((kind) => kind ?? rest.pop()), 'boss'];
}

// Le durate delle count battaglie dell'area numero area: nella prima quelle di ROAD.opening; nelle altre la prima è
// ROAD.firstLength e le altre si pescano dal sacchetto ROAD.lengthBag (rimescolato quando finisce), ma l'ultima, la
// più vicina al boss, non ha la sua durata (ROAD.bossLength) se ce n'è un'altra da scambiare
function battleLengths(rng, count, area) {
  const { opening } = ROAD;
  if (area === 0) return Array.from({ length: count }, (_, index) => opening[Math.min(index, opening.length - 1)]);
  const picks = [ROAD.firstLength];
  const bag = [];
  while (picks.length < count) {
    if (bag.length === 0) bag.push(...shuffle(rng, [...ROAD.lengthBag]));
    picks.push(bag.pop());
  }
  const last = picks.length - 1;
  const swap = picks.findIndex((length, index) => index > 0 && index < last && length !== ROAD.bossLength);
  if (last > 0 && picks[last] === ROAD.bossLength && swap > 0) [picks[last], picks[swap]] = [picks[swap], picks[last]];
  return picks;
}

// Dove comincia l'area numero area tra le caselle tiles
function areaStart(area, tiles) {
  return tiles.findIndex((tile) => tile.area === area);
}

function shuffle(rng, items) {
  for (let index = items.length - 1; index > 0; index--) {
    const other = rng.int(index + 1);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
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
