// Livello 1. maxArmy: soldati in campo al massimo, capo compreso; quelli in più restano dietro come riserve
// (ARMY.reserves in config/battle.js)
export const LIMITS = {
  maxArmy: 100,
};

// Ondate del livello, in ordine (una battaglia ne gioca le prime, quante ne dice il suo tipo: BATTLE_TYPES). Per
// ognuna: duration, secondi di gioco; scrollSpeed, velocità del campo (unità/s), fissa per tutta l'ondata; enemyHp,
// vita dei nemici normali (gli altri tipi ne hanno una parte o un multiplo, data/enemies.js); spawnInterval, secondi
// tra un arrivo di nemici e il successivo. Ogni arrivo è uno sciame con probabilità swarmChance: swarm.count pedine
// (meglio un multiplo delle colonne) su swarm.lanes corsie vicine. Altrimenti è una fila di rowSize nemici affiancati
// su corsie diverse con probabilità rowChance, o un nemico solo. Ogni nemico di una fila o solo è di un tipo speciale
// con la probabilità scritta in specials, altrimenti è normale. gates: i cancelli dell'ondata (tipi in data/gates.js):
// ognuno parte da un numero preso a caso tra quelli del suo tipo (plus i +N, minus i −N, deep i −N delle battaglie con
// le porte tutte negative) e sale a ogni colpo fino al massimo (plusMax per plus e deep, minusMax per minus). Ogni
// arrivo di cancelli è una coppia in due corsie diverse con probabilità pairChance, con i tipi di una delle
// coppie in pairs (scelta secondo weight); altrimenti è un cancello solo, di un tipo scelto con le probabilità di
// singles. Numeri tarati con il simulatore sull'esercito che serve per arrivare in fondo: chi prende i +N ci arriva,
// chi prende i −N resta sotto. I cancelli danno truppe, gli scrigni potenza di fuoco, vita agli eroi e truppe élite.
// chests: gli scrigni dell'ondata (ricompense in data/chests.js): hits colpi per aprire uno scrigno che vale 1 (gli
// altri in proporzione al loro value), e la ricompensa si sceglie con le probabilità di rewards. Lo scrigno resta a
// tiro meno a lungo nelle ondate veloci: hits tiene conto di quanti colpi fa in tempo a sparare una folla centrata su
// di lui, e dei colpi che gli tolgono i nemici fitti che gli passano davanti. Livello breve e fitto: i tipi entrano a
// poco a poco, e dalla terza ondata (la fine di una battaglia normale, 45 s) ci sono quasi tutti. Le cose scendono
// quasi alla stessa velocità in tutte le ondate (pochi punti in più ogni volta, mai una corsa finale): a crescere sono
// i nemici, con arrivi più fitti e sciami più grandi. Ondate da 14 s: le battaglie lunghe (data/waves.js BATTLE_TYPES)
// arrivano fino alla nona, con i nemici sempre più duri e fitti. La vita non sale sempre: dove l'orda si allarga
// (gli sciami su due corsie dall'ondata 4, gli arrivi più fitti della 6) i normali sono un po' più deboli. Vita dei
// nemici tarata su quattro eroi in campo (data/heroes.js)
export const WAVES = [
  {
    duration: 14,
    scrollSpeed: 270,
    enemyHp: 6,
    spawnInterval: 0.53,
    rowChance: 0.1,
    rowSize: 2,
    swarmChance: 0,
    swarm: { count: 0, lanes: 1 },
    specials: {},
    gates: {
      plus: [5, 6, 8],
      plusMax: 18,
      minus: [-6, -9],
      minusMax: 8,
      deep: [-15, -20],
      pairChance: 0.3,
      singles: { plus: 0.8, minus: 0.2 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.7 },
        { kinds: ['plus', 'plus'], weight: 0.3 },
      ],
    },
    chests: { hits: 30, rewards: { damage: 0.35, fireRate: 0.25, heal: 0.1, elite: 0.3 } },
  },
  {
    duration: 14,
    scrollSpeed: 280,
    enemyHp: 30,
    spawnInterval: 0.78,
    rowChance: 0.2,
    rowSize: 2,
    swarmChance: 0.3,
    swarm: { count: 10, lanes: 1 },
    specials: { fast: 0.2 },
    gates: {
      plus: [8, 9, 11],
      plusMax: 26,
      minus: [-12, -15],
      minusMax: 12,
      deep: [-30, -36],
      pairChance: 0.5,
      singles: { plus: 0.7, minus: 0.3 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.6 },
        { kinds: ['plus', 'plus'], weight: 0.4 },
      ],
    },
    chests: { hits: 72, rewards: { damage: 0.25, fireRate: 0.2, heal: 0.1, burst: 0.15, elite: 0.3 } },
  },
  {
    duration: 14,
    scrollSpeed: 290,
    enemyHp: 60,
    spawnInterval: 0.59,
    rowChance: 0.25,
    rowSize: 2,
    swarmChance: 0.28,
    swarm: { count: 20, lanes: 1 },
    specials: { fast: 0.15, armored: 0.2, shooter: 0.1 },
    gates: {
      plus: [11, 13, 16],
      plusMax: 38,
      minus: [-18, -22],
      minusMax: 16,
      deep: [-44, -52],
      pairChance: 0.5,
      singles: { plus: 0.65, minus: 0.35 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.65 },
        { kinds: ['plus', 'plus'], weight: 0.35 },
      ],
    },
    chests: {
      hits: 92,
      rewards: { damage: 0.2, bigDamage: 0.1, fireRate: 0.15, heal: 0.1, burst: 0.1, elite: 0.2, bigElite: 0.15 },
    },
  },
  {
    duration: 14,
    scrollSpeed: 300,
    enemyHp: 50,
    spawnInterval: 0.55,
    rowChance: 0.3,
    rowSize: 2,
    swarmChance: 0.18,
    swarm: { count: 30, lanes: 2 },
    specials: { fast: 0.15, armored: 0.15, elite: 0.12, shooter: 0.15 },
    gates: {
      plus: [13, 16, 19],
      plusMax: 44,
      minus: [-22, -30],
      minusMax: 18,
      deep: [-56, -66],
      pairChance: 0.6,
      singles: { plus: 0.6, minus: 0.4 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.7 },
        { kinds: ['plus', 'plus'], weight: 0.3 },
      ],
    },
    chests: {
      hits: 96,
      rewards: { damage: 0.2, bigDamage: 0.15, fireRate: 0.15, heal: 0.15, elite: 0.2, bigElite: 0.15 },
    },
  },
  {
    duration: 14,
    scrollSpeed: 310,
    enemyHp: 64,
    spawnInterval: 0.61,
    rowChance: 0.35,
    rowSize: 2,
    swarmChance: 0.28,
    swarm: { count: 30, lanes: 2 },
    specials: { fast: 0.15, armored: 0.18, elite: 0.14, shooter: 0.17 },
    gates: {
      plus: [16, 19, 22],
      plusMax: 52,
      minus: [-26, -35],
      minusMax: 22,
      deep: [-66, -78],
      pairChance: 0.6,
      singles: { plus: 0.6, minus: 0.4 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.7 },
        { kinds: ['plus', 'plus'], weight: 0.3 },
      ],
    },
    chests: {
      hits: 104,
      rewards: { damage: 0.2, bigDamage: 0.15, fireRate: 0.15, heal: 0.15, elite: 0.2, bigElite: 0.15 },
    },
  },
  {
    duration: 14,
    scrollSpeed: 320,
    enemyHp: 55,
    spawnInterval: 0.62,
    rowChance: 0.4,
    rowSize: 2,
    swarmChance: 0.3,
    swarm: { count: 30, lanes: 2 },
    specials: { fast: 0.15, armored: 0.2, elite: 0.16, shooter: 0.18 },
    gates: {
      plus: [19, 22, 25],
      plusMax: 58,
      minus: [-30, -40],
      minusMax: 25,
      deep: [-75, -88],
      pairChance: 0.6,
      singles: { plus: 0.6, minus: 0.4 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.7 },
        { kinds: ['plus', 'plus'], weight: 0.3 },
      ],
    },
    chests: {
      hits: 100,
      rewards: { damage: 0.2, bigDamage: 0.15, fireRate: 0.15, heal: 0.15, elite: 0.2, bigElite: 0.15 },
    },
  },
  {
    duration: 14,
    scrollSpeed: 321,
    enemyHp: 62,
    spawnInterval: 0.6,
    rowChance: 0.45,
    rowSize: 2,
    swarmChance: 0.3,
    swarm: { count: 30, lanes: 2 },
    specials: { fast: 0.15, armored: 0.22, elite: 0.18, shooter: 0.2 },
    gates: {
      plus: [22, 25, 28],
      plusMax: 66,
      minus: [-34, -44],
      minusMax: 28,
      deep: [-85, -98],
      pairChance: 0.6,
      singles: { plus: 0.6, minus: 0.4 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.7 },
        { kinds: ['plus', 'plus'], weight: 0.3 },
      ],
    },
    chests: {
      hits: 106,
      rewards: { damage: 0.2, bigDamage: 0.15, fireRate: 0.15, heal: 0.15, elite: 0.2, bigElite: 0.15 },
    },
  },
  {
    duration: 14,
    scrollSpeed: 322,
    enemyHp: 70,
    spawnInterval: 0.58,
    rowChance: 0.5,
    rowSize: 2,
    swarmChance: 0.32,
    swarm: { count: 30, lanes: 2 },
    specials: { fast: 0.15, armored: 0.24, elite: 0.2, shooter: 0.22 },
    gates: {
      plus: [25, 28, 31],
      plusMax: 74,
      minus: [-38, -48],
      minusMax: 31,
      deep: [-95, -108],
      pairChance: 0.6,
      singles: { plus: 0.6, minus: 0.4 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.7 },
        { kinds: ['plus', 'plus'], weight: 0.3 },
      ],
    },
    chests: {
      hits: 110,
      rewards: { damage: 0.2, bigDamage: 0.15, fireRate: 0.15, heal: 0.15, elite: 0.2, bigElite: 0.15 },
    },
  },
  {
    duration: 14,
    scrollSpeed: 323,
    enemyHp: 78,
    spawnInterval: 0.56,
    rowChance: 0.55,
    rowSize: 2,
    swarmChance: 0.34,
    swarm: { count: 40, lanes: 2 },
    specials: { fast: 0.15, armored: 0.26, elite: 0.22, shooter: 0.24 },
    gates: {
      plus: [28, 31, 34],
      plusMax: 82,
      minus: [-42, -52],
      minusMax: 34,
      deep: [-105, -118],
      pairChance: 0.6,
      singles: { plus: 0.6, minus: 0.4 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.7 },
        { kinds: ['plus', 'plus'], weight: 0.3 },
      ],
    },
    chests: {
      hits: 114,
      rewards: { damage: 0.2, bigDamage: 0.15, fireRate: 0.15, heal: 0.15, elite: 0.2, bigElite: 0.15 },
    },
  },
];

// Tipi di battaglia (rules.type, le regole della battaglia: una casella della strada; senza, la normale): quante
// ondate si giocano (waves, le prime di WAVES) e i boss alla fine (bosses: gruppi che arrivano uno dopo l'altro, ognuno
// a strada libera; nel gruppo i boss arrivano insieme, ognuno nella sua corsia lane e con hpScale volte la vita di
// BOSS). La normale (circa 45 s) non ha boss: orde, porte e scrigni; quella da circa 90 s finisce con un boss, quella
// da 135 s con due insieme, quella da 180 s con due insieme e poi il più grande da solo. Quale tipo ha ogni battaglia
// della strada lo dice il suo numero (data/road.js ROAD.cadence). powerScale: quanto pesa la potenza del livello
// (systems/power.js), tarato con il bot perché a rapporto 1 si vinca metà delle partite (abbassando la vita dei
// nemici; la tripla resta intorno a metà anche con nemici deboli: lì si perde per l'orda che passa)
export const BATTLE_TYPES = {
  normal: { waves: 3, bosses: [], powerScale: 1.44 },
  boss: { waves: 5, bosses: [[{ lane: 1, hpScale: 1 }]], powerScale: 0.76 },
  double: {
    waves: 7,
    bosses: [
      [
        { lane: 0, hpScale: 1.2 },
        { lane: 2, hpScale: 1.2 },
      ],
    ],
    powerScale: 0.69,
  },
  triple: {
    waves: 9,
    bosses: [
      [
        { lane: 0, hpScale: 1.4 },
        { lane: 2, hpScale: 1.4 },
      ],
      [{ lane: 1, hpScale: 3 }],
    ],
    powerScale: 0.5,
  },
};
export const DEFAULT_TYPE = 'normal';

// Boss di fine battaglia, nei tipi che ce l'hanno (BATTLE_TYPES): arriva dopo l'ultima ondata, finita la pausa di
// LEVEL.breakSeconds e a strada libera, a spawnZ nella sua corsia (quella del suo gruppo, BATTLE_TYPES), già quasi a
// tiro del cecchino: niente attesa a strada vuota. hp, vita totale (per l'hpScale del tipo), divisa in layers strati
// uguali. Al suo arrivo il campo si ferma: il boss cammina verso gli eroi a walkSpeed unità/s fino a holdZ, davanti
// all'esercito, e lì si pianta: non si scontra mai. Da piantato ripete: pausa di restSeconds; avviso di
// smash.warnSeconds con una zona tonda di raggio smash.radius segnata a terra dove sta il capo; schiacciamento (i
// soldati dentro perdono una vita, gli eroi dentro la vita del tipo boss); passaggio in un'altra corsia a caso a
// moveSpeed unità/s. Scorta: finché il boss è sulla strada e non sta cambiando corsia, ogni escort.interval secondi gli
// esce uno sciame di escort.count pedine in una corsia a caso: davanti a lui (a escort.gap unità) nella sua corsia, al
// suo fianco nelle altre; cammina verso gli eroi a escort.walkSpeed. Non esce se la sua prima fila sarebbe più vicina
// di escort.minZ, cioè troppo vicina all'esercito per dare il tempo di reagire. enemyHp: vita dei nemici normali in
// questa fase, da cui viene quella della scorta (8, con la vita degli sciami di data/enemies.js)
export const BOSS = {
  hp: 6200,
  layers: 6,
  spawnZ: 1700,
  walkSpeed: 220,
  holdZ: 550,
  restSeconds: 1.5,
  moveSpeed: 160,
  smash: { warnSeconds: 1.2, radius: 120 },
  enemyHp: 32,
  escort: { interval: 3, count: 10, gap: 30, minZ: 350, walkSpeed: 300 },
};
