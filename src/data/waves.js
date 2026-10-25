// Livello 1. maxArmy: soldati in campo al massimo, capo compreso; quelli in più restano dietro come riserve
// (ARMY.reserves in config/balance.js)
export const LIMITS = {
  maxArmy: 100,
};

// Ondate del livello, in ordine (una battaglia ne gioca le prime, quante ne dice la sua durata: LENGTHS). Per ognuna:
// duration, secondi di gioco; scrollSpeed, velocità del campo (unità/s), fissa per tutta l'ondata;
// enemyHp, vita dei nemici normali (gli altri tipi ne hanno una parte o un multiplo, data/enemies.js);
// spawnInterval, secondi tra un arrivo di nemici e il successivo.
// Ogni arrivo è uno sciame con probabilità swarmChance: swarm.count pedine (meglio un multiplo delle
// colonne) su swarm.lanes corsie vicine. Altrimenti è una fila di rowSize nemici affiancati su corsie
// diverse con probabilità rowChance, o un nemico solo. Ogni nemico di una fila o solo è di un tipo
// speciale con la probabilità scritta in specials, altrimenti è normale.
// gates: i cancelli dell'ondata (tipi in data/gates.js), fissi: ognuno dà o toglie sempre lo stesso numero di
// soldati, preso a caso tra quelli di plus (i +N) o di minus (i −N). Ogni arrivo di cancelli è una coppia in due
// corsie diverse con probabilità pairChance, con i tipi di una delle coppie in pairs (scelta secondo weight);
// altrimenti è un cancello solo, di un tipo scelto con le probabilità di singles. Numeri tarati con il simulatore
// sull'esercito che serve per arrivare in fondo: chi prende i +N ci arriva, chi prende i −N resta sotto. I cancelli
// danno truppe, gli scrigni potenza di fuoco, vita agli eroi e truppe élite.
// chests: gli scrigni dell'ondata (ricompense in data/chests.js): hits colpi per aprire uno scrigno che vale 1 (gli
// altri in proporzione al loro value), e la ricompensa si sceglie con le probabilità di rewards. Lo scrigno resta
// a tiro meno a lungo nelle ondate veloci: hits tiene conto di quanti colpi fa in tempo a sparare una folla
// centrata su di lui.
// Livello breve e fitto: i tipi entrano a poco a poco e nell'ultima ondata ci sono tutti. Il campo va quasi alla
// stessa velocità in tutte le ondate (pochi punti in più ogni volta, mai una corsa finale): a crescere sono i nemici,
// con arrivi più fitti e sciami più grandi. Vita dei nemici tarata su quattro eroi in campo (data/heroes.js)
export const WAVES = [
  {
    duration: 25,
    scrollSpeed: 270,
    enemyHp: 6,
    spawnInterval: 0.8,
    rowChance: 0.1,
    rowSize: 2,
    swarmChance: 0,
    swarm: { count: 0, lanes: 1 },
    specials: {},
    gates: {
      plus: [6, 8, 10],
      minus: [-4, -6],
      pairChance: 0.3,
      singles: { plus: 0.8, minus: 0.2 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.7 },
        { kinds: ['plus', 'plus'], weight: 0.3 },
      ],
    },
    chests: { hits: 35, rewards: { damage: 0.35, fireRate: 0.25, heal: 0.1, elite: 0.3 } },
  },
  {
    duration: 25,
    scrollSpeed: 280,
    enemyHp: 34,
    spawnInterval: 1.0,
    rowChance: 0.2,
    rowSize: 2,
    swarmChance: 0.3,
    swarm: { count: 10, lanes: 1 },
    specials: { fast: 0.2 },
    gates: {
      plus: [10, 12, 15],
      minus: [-8, -10],
      pairChance: 0.5,
      singles: { plus: 0.7, minus: 0.3 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.6 },
        { kinds: ['plus', 'plus'], weight: 0.4 },
      ],
    },
    chests: { hits: 90, rewards: { damage: 0.25, fireRate: 0.2, heal: 0.1, burst: 0.15, elite: 0.3 } },
  },
  {
    duration: 25,
    scrollSpeed: 290,
    enemyHp: 64,
    spawnInterval: 0.8,
    rowChance: 0.25,
    rowSize: 2,
    swarmChance: 0.28,
    swarm: { count: 20, lanes: 1 },
    specials: { fast: 0.15, armored: 0.2, shooter: 0.1 },
    gates: {
      plus: [15, 18, 22],
      minus: [-12, -15],
      pairChance: 0.5,
      singles: { plus: 0.65, minus: 0.35 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.65 },
        { kinds: ['plus', 'plus'], weight: 0.35 },
      ],
    },
    chests: {
      hits: 115,
      rewards: { damage: 0.2, bigDamage: 0.1, fireRate: 0.15, heal: 0.1, burst: 0.1, elite: 0.2, bigElite: 0.15 },
    },
  },
  {
    duration: 25,
    scrollSpeed: 300,
    enemyHp: 66,
    spawnInterval: 0.74,
    rowChance: 0.3,
    rowSize: 2,
    swarmChance: 0.18,
    swarm: { count: 30, lanes: 2 },
    specials: { fast: 0.15, armored: 0.15, elite: 0.12, shooter: 0.15 },
    gates: {
      plus: [18, 22, 26],
      minus: [-15, -20],
      pairChance: 0.6,
      singles: { plus: 0.6, minus: 0.4 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.7 },
        { kinds: ['plus', 'plus'], weight: 0.3 },
      ],
    },
    chests: {
      hits: 120,
      rewards: { damage: 0.2, bigDamage: 0.15, fireRate: 0.15, heal: 0.15, elite: 0.2, bigElite: 0.15 },
    },
  },
  {
    duration: 25,
    scrollSpeed: 310,
    enemyHp: 76,
    spawnInterval: 0.82,
    rowChance: 0.35,
    rowSize: 2,
    swarmChance: 0.28,
    swarm: { count: 30, lanes: 2 },
    specials: { fast: 0.15, armored: 0.18, elite: 0.14, shooter: 0.17 },
    gates: {
      plus: [22, 26, 30],
      minus: [-18, -24],
      pairChance: 0.6,
      singles: { plus: 0.6, minus: 0.4 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.7 },
        { kinds: ['plus', 'plus'], weight: 0.3 },
      ],
    },
    chests: {
      hits: 130,
      rewards: { damage: 0.2, bigDamage: 0.15, fireRate: 0.15, heal: 0.15, elite: 0.2, bigElite: 0.15 },
    },
  },
  {
    duration: 25,
    scrollSpeed: 320,
    enemyHp: 84,
    spawnInterval: 0.84,
    rowChance: 0.4,
    rowSize: 2,
    swarmChance: 0.3,
    swarm: { count: 30, lanes: 2 },
    specials: { fast: 0.15, armored: 0.2, elite: 0.16, shooter: 0.18 },
    gates: {
      plus: [26, 30, 34],
      minus: [-20, -28],
      pairChance: 0.6,
      singles: { plus: 0.6, minus: 0.4 },
      pairs: [
        { kinds: ['plus', 'minus'], weight: 0.7 },
        { kinds: ['plus', 'plus'], weight: 0.3 },
      ],
    },
    chests: {
      hits: 125,
      rewards: { damage: 0.2, bigDamage: 0.15, fireRate: 0.15, heal: 0.15, elite: 0.2, bigElite: 0.15 },
    },
  },
];

// Durate delle battaglie (rules.length, le regole della battaglia: una casella della strada; senza, la media): quante
// ondate si giocano (waves, le prime di WAVES) e se alla fine arriva il boss (boss), con bossHpScale volte la sua vita.
// La corta è una scaramuccia senza boss, la lunga arriva al boss con l'esercito più grande ed è dura apposta: è lì che
// servono il villaggio e gli eroi potenziati. powerScale: quanto pesa la potenza del livello (systems/power.js), tarato
// con il bot perché a rapporto uguale si vinca come nella media (col bot: corta circa 85%, media 50%, lunga 35%)
export const LENGTHS = {
  short: { waves: 2, boss: false, powerScale: 4.4 },
  medium: { waves: 4, boss: true, bossHpScale: 1, powerScale: 1 },
  long: { waves: 6, boss: true, bossHpScale: 1.8, powerScale: 0.6 },
};
export const DEFAULT_LENGTH = 'medium';

// Boss di fine battaglia, nelle durate che ce l'hanno (LENGTHS): arriva dopo l'ultima ondata, finita la pausa di
// LEVEL.breakSeconds e a strada libera, a spawnZ nella corsia lane, già quasi a tiro del cecchino: niente attesa a
// strada vuota. hp, vita totale (per il bossHpScale della durata), divisa in layers strati uguali. Al suo arrivo il
// campo si ferma: il boss cammina verso gli eroi a walkSpeed unità/s fino a holdZ, davanti all'esercito, e lì si
// pianta: non si scontra mai. Da piantato ripete: pausa di restSeconds; avviso di smash.warnSeconds con una zona tonda
// di raggio smash.radius segnata a terra dove sta il capo; schiacciamento (i soldati dentro perdono una vita, gli eroi
// dentro la vita del tipo boss); passaggio in un'altra corsia a caso a moveSpeed unità/s. Scorta: finché il boss è
// sulla strada e non sta cambiando corsia, ogni escort.interval secondi gli esce uno sciame di escort.count pedine in
// una corsia a caso: davanti a lui (a escort.gap unità) nella sua corsia, al suo fianco nelle altre; cammina verso gli
// eroi a escort.walkSpeed. Non esce se la sua prima fila sarebbe più vicina di escort.minZ, cioè troppo vicina
// all'esercito per dare il tempo di reagire. enemyHp: vita dei nemici normali in questa fase, da cui viene quella della
// scorta (8, con la vita degli sciami di data/enemies.js)
export const BOSS = {
  hp: 8000,
  layers: 6,
  lane: 1,
  spawnZ: 1700,
  walkSpeed: 220,
  holdZ: 550,
  restSeconds: 1.5,
  moveSpeed: 160,
  smash: { warnSeconds: 1.2, radius: 120 },
  enemyHp: 32,
  escort: { interval: 3, count: 10, gap: 30, minZ: 350, walkSpeed: 300 },
};
