import { createRng } from '../core/rng.js';
import { MAP } from '../data/map.js';
import { shareOf } from './rewards.js';

// Mappa del giocatore, nel profilo (meta/profile.js map: capitolo, seme, la casella dove si è, quelle visitate e
// quelle fatte). Il capitolo si genera dal suo seme (data/map.js): righe di caselle dalla partenza (riga 0) al boss
// (riga MAP.rows), ognuna legata ad almeno una della riga sopra e raggiunta da almeno una della riga sotto, senza
// strade che si incrociano. Si va solo avanti, un passo alla volta, pagando le razioni. Una casella di risorse dà
// il suo premio appena ci si arriva; una battaglia va vinta prima di proseguire (persa si riprova senza pagare di
// nuovo il passo) e vinta non si rigioca

// Caselle di un capitolo: { id, row, index, x (da 0 a 1 nella larghezza), kind, next: id della riga sopra, e per
// tipo amount (risorse, frammenti), event ({ kind, amount }) o rules (battaglie: { enemyHpScale }) }. Lo stesso seme
// dà lo stesso capitolo; l'ultimo generato si tiene da parte
let cached = null;

export function chapterOf(profile) {
  const { seed, chapter } = profile.map;
  if (cached?.seed !== seed || cached.chapter !== chapter) {
    cached = { seed, chapter, nodes: createChapter(seed, chapter) };
  }
  return cached.nodes;
}

// Il capitolo ha bisogno di un seme: la prima volta lo prende da now
export function ensureChapter(profile, now) {
  if (profile.map.seed === 0) profile.map.seed = now;
}

// Le caselle dove si può andare con il prossimo passo: quelle sopra la casella dove si è, se è fatta
export function reachable(profile) {
  const { position, cleared } = profile.map;
  if (!cleared.includes(position)) return [];
  return chapterOf(profile)[position].next;
}

// Quanto si vede della casella id: 'known' (visitata, raggiungibile, o il boss, la meta), 'fog' (a due passi, o sopra
// la battaglia da vincere: si sa che c'è, non cosa), 'hidden'
export function visibility(profile, id) {
  const nodes = chapterOf(profile);
  const near = reachable(profile);
  if (profile.map.visited.includes(id) || near.includes(id) || nodes[id].kind === 'boss') return 'known';
  const { position, cleared } = profile.map;
  const frontier = cleared.includes(position) ? near : [position];
  if (frontier.some((other) => nodes[other].next.includes(id))) return 'fog';
  return 'hidden';
}

// Un passo verso la casella id, se è raggiungibile e ci sono le razioni: le paga e ci arriva. Una casella di premio
// lo dà subito (gain: { kind, amount, hero }) ed è fatta; una battaglia aspetta di essere vinta (battle true).
// Restituisce null se il passo non si può fare
export function step(profile, id) {
  if (!reachable(profile).includes(id) || profile.resources.rations < MAP.stepCost) return null;
  const node = chapterOf(profile)[id];
  profile.resources.rations -= MAP.stepCost;
  profile.map.position = id;
  profile.map.visited.push(id);
  if (node.kind === 'battle' || node.kind === 'boss') return { node, battle: true };
  profile.map.cleared.push(id);
  return { node, battle: false, gain: grant(profile, node) };
}

// La battaglia della casella dove si è è stata vinta: la casella è fatta (e con il boss il capitolo)
export function winTile(profile, id) {
  if (!profile.map.cleared.includes(id)) profile.map.cleared.push(id);
}

export function chapterDone(profile) {
  const nodes = chapterOf(profile);
  return profile.map.cleared.includes(nodes.length - 1);
}

// Capitolo nuovo, con un seme nuovo e le battaglie più dure di MAP.battle.chapterStep
export function nextChapter(profile, now) {
  profile.map = { chapter: profile.map.chapter + 1, seed: now, position: 0, visited: [0], cleared: [0] };
}

// Il premio di una casella entra nel profilo: risorse, frammenti dell'eroe schierato della casella (a caso con il
// seme), esperienza divisa tra gli schierati come quella delle battaglie
function grant(profile, node) {
  const { kind, amount } = node.kind === 'event' ? node.event : node;
  const lineup = profile.lineup.filter((id) => id !== null);
  if (kind === 'fragments') {
    const hero = lineup[createRng(profile.map.seed + node.id).int(lineup.length)];
    profile.heroes[hero].fragments += amount;
    return { kind, amount, hero };
  }
  if (kind === 'xp') {
    lineup.forEach((id, index) => {
      profile.heroes[id].xp += shareOf(amount, lineup.length, index);
    });
    return { kind, amount, hero: null };
  }
  profile.resources[kind] += amount;
  return { kind, amount, hero: null };
}

function createChapter(seed, chapter) {
  const rng = createRng(seed);
  const rows = [[{ kind: 'start' }]];
  for (let row = 1; row <= MAP.rows; row++) {
    const [least, most] = MAP.width;
    const count = row === MAP.rows ? 1 : least + rng.int(most - least + 1);
    rows.push(Array.from({ length: count }, () => (row === MAP.rows ? { kind: 'boss' } : tile(rng, row))));
  }
  const nodes = [];
  rows.forEach((tiles, row) => {
    tiles.forEach((data, index) => {
      const jitter = (rng.float() * 2 - 1) * MAP.jitter;
      const x = (index + 1) / (tiles.length + 1) + (tiles.length > 1 ? jitter : 0);
      nodes.push({ ...data, id: nodes.length, row, index, x, next: [] });
    });
  });
  const byRow = rows.map((_, row) => nodes.filter((node) => node.row === row));
  for (let row = 0; row < MAP.rows; row++) link(rng, byRow[row], byRow[row + 1]);
  const scale = MAP.battle.hpScale + MAP.battle.chapterStep * (chapter - 1);
  for (const node of nodes) {
    if (node.kind === 'battle') node.rules = { enemyHpScale: scale + MAP.battle.perRow * node.row };
    if (node.kind === 'boss') node.rules = { enemyHpScale: (scale + MAP.battle.perRow * node.row) * MAP.boss.hpScale };
  }
  return nodes;
}

// Una casella tra la partenza e il boss: il tipo per peso, e il suo premio
function tile(rng, row) {
  const kind = rng.pick(Object.entries(MAP.kinds).map(([name, { weight }]) => [name, weight]));
  if (kind === 'event') return { kind, event: rng.pick(MAP.events.map((event) => [event, event.weight])) };
  if (kind === 'battle') return { kind };
  const { min, max, perRow = 0 } = MAP.kinds[kind];
  return { kind, amount: min + rng.int(max - min + 1) + Math.floor(perRow * row) };
}

// Le strade tra due righe, da sinistra a destra: ogni casella va a quella della riga sopra nella stessa parte della
// larghezza e, a volte, anche a quella dopo (se la vicina di destra non va più in là) o a quella prima (se la vicina di
// sinistra non arriva fin lì): le strade non si incrociano; chi sopra resta senza strade ne prende una dalla casella
// sotto più vicina
function link(rng, below, above) {
  const target = (index) => (below.length === 1 ? 0 : Math.round((index * (above.length - 1)) / (below.length - 1)));
  below.forEach((node, index) => {
    if (below.length === 1) {
      node.next = above.map((other) => other.id);
      return;
    }
    const first = target(index);
    node.next.push(above[first].id);
    const room = index === below.length - 1 || target(index + 1) > first;
    if (first + 1 < above.length && room && rng.float() < MAP.branchChance) node.next.push(above[first + 1].id);
    const indexOf = (id) => above.findIndex((other) => other.id === id);
    const reach = index === 0 ? -1 : Math.max(...below[index - 1].next.map(indexOf));
    if (first > 0 && reach < first && rng.float() < MAP.branchChance) node.next.unshift(above[first - 1].id);
  });
  above.forEach((node, index) => {
    if (below.some((other) => other.next.includes(node.id))) return;
    const from = above.length === 1 ? 0 : Math.round((index * (below.length - 1)) / (above.length - 1));
    below[from].next.push(node.id);
    below[from].next.sort((a, b) => a - b);
  });
}
