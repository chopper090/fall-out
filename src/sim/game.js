import { SIM } from '../config/balance.js';
import { createEventBus, EVENTS } from '../core/events.js';
import { periodMs, secondsToMs } from '../core/time.js';
import { STARTING_LOADOUT } from '../data/loadout.js';
import { WEAPONS } from '../data/units.js';
import { createBattle, updateBattle } from '../systems/battle.js';
import { soldiersFrom } from '../systems/gates.js';
import { battlePlan } from '../systems/waves.js';
import { createBot, updateBot } from './bot.js';

// Una battaglia giocata dal bot senza grafica, con il seme seed e quello che il meta-gioco porta in battaglia
// (loadout, data/loadout.js); bus: il bus degli eventi della battaglia, per chi li vuole sentire prima dei sistemi.
// Restituisce la battaglia com'è finita (over falso: non è finita entro SIM.maxSeconds)
export function playBattle(seed, loadout, bus = createEventBus()) {
  return playOut(createBattle(seed, bus, loadout));
}

// Una partita giocata dal bot per misurare il livello (playOut), fino alla fine della missione o a SIM.maxSeconds.
// Ritorna l'esito (why: 'hero' se muore il capo, 'escaped' se passano troppi nemici, 'time' se non finisce),
// il tratto in cui è finita, quando il primo bersaglio è arrivato a tiro e le misure di ogni tratto del livello:
// le ondate della sua durata in ordine e per ultimo il boss (dopo l'ultima ondata); un tratto mai raggiunto resta
// vuoto (anche le ondate saltate con LEVEL.startWave o LEVEL.startWithBoss). rules: le regole della battaglia, con la
// durata (systems/waves.js battlePlan); senza, la media (DEFAULT_LENGTH) con lo schieramento di partenza
export function playGame(seed, rules = null) {
  const bus = createEventBus();
  const record = { current: null, segment: null, segments: [], firstTargetMs: null };
  const loadout = rules === null ? STARTING_LOADOUT : { ...STARTING_LOADOUT, rules };
  const waveCount = battlePlan(rules).waves;
  // Le misure vogliono la battaglia già dal primo evento: la si crea qui, e il bot la gioca come le altre
  const battle = createBattle(seed, measure(bus, record, () => battle, waveCount), loadout);
  playOut(battle, (frameMs) => tick(record, battle, frameMs));
  const { mission, army, ms } = battle;
  const why = mission.completed ? null : !mission.failed ? 'time' : army.leader.hp === 0 ? 'hero' : 'escaped';
  close(record, army);
  const { segment, segments, firstTargetMs } = record;
  return { seed, win: mission.completed, why, ms, endedIn: segment, firstTargetMs, segments };
}

// Il bot gioca la battaglia battle a frame fissi di SIM.fps fino alla fine della missione o a SIM.maxSeconds di gioco;
// afterFrame(frameMs) dopo ogni frame. Restituisce la battaglia
function playOut(battle, afterFrame = () => {}) {
  const frameMs = periodMs(SIM.fps);
  const bot = createBot(frameMs);
  while (!battle.over && battle.ms < secondsToMs(SIM.maxSeconds)) {
    updateBot(bot, battle);
    updateBattle(battle, frameMs);
    afterFrame(frameMs);
  }
  return battle;
}

// Misure di ogni tratto: soldati persi contro i nemici, presi ai cancelli ed élite avute dagli scrigni, vita persa
// dal capo, eroi caduti, nemici passati, scrigni aperti e arrivati alla fine, schiacciamenti del boss, tempo senza
// niente a tiro.
// Gli ascoltatori sentono ogni evento prima dei sistemi, quindi con l'esercito com'era prima. Prima del primo
// tratto (la partita che parte dal boss lo aspetta a strada libera) non si misura niente. waveCount: le ondate della
// battaglia, il boss è il tratto dopo
function measure(bus, record, getBattle, waveCount) {
  const start = (index) => {
    const { army } = getBattle();
    close(record, army);
    record.segment = index;
    record.current = {
      ms: 0,
      armyStart: army.size,
      armyEnd: army.size,
      soldiersLost: 0,
      gateSoldiers: 0,
      elites: 0,
      leaderHpLost: 0,
      heroesLost: 0,
      escaped: 0,
      chestsOpened: 0,
      chestsGone: 0,
      smashes: 0,
      idleMs: 0,
    };
    record.segments[index] = record.current;
  };
  const add = (key, amount = 1) => {
    if (record.current !== null) record.current[key] += amount;
  };
  bus.on(EVENTS.WAVE_ANNOUNCED, ({ index }) => start(index));
  bus.on(EVENTS.BOSS_STARTED, () => start(waveCount));
  bus.on(EVENTS.GATE_PASSED, (gate) => add('gateSoldiers', soldiersFrom(gate, getBattle().army.size)));
  bus.on(EVENTS.HERO_HIT, ({ hero, damage }) => {
    if (hero.leader && hero.hp > 0) add('leaderHpLost', Math.min(hero.hp, damage));
  });
  bus.on(EVENTS.HERO_KILLED, (hero) => {
    if (!hero.leader) add('heroesLost');
  });
  bus.on(EVENTS.ENEMY_ESCAPED, ({ counted }) => {
    if (counted) add('escaped');
  });
  bus.on(EVENTS.CHEST_OPENED, ({ kind }) => {
    add('chestsOpened');
    if (kind.effect === 'elite') add('elites', kind.count);
  });
  bus.on(EVENTS.CHEST_REMOVED, () => add('chestsGone'));
  bus.on(EVENTS.BOSS_SMASHED, () => add('smashes'));
  return bus;
}

function tick(record, battle, frameMs) {
  const busy = somethingInRange(battle);
  if (busy) record.firstTargetMs ??= battle.ms;
  if (record.current === null) return;
  record.current.ms += frameMs;
  if (!busy) record.current.idleMs += frameMs;
}

// L'esercito cambia solo ai cancelli, con le élite degli scrigni e quando muore un soldato: quelli che mancano sono
// persi contro i nemici
function close({ current }, army) {
  if (current === null) return;
  current.armyEnd = army.size;
  current.soldiersLost = current.armyStart + current.gateSoldiers + current.elites - army.size;
}

// Qualcosa da colpire a tiro del fucile, l'arma di riferimento: un nemico o uno scrigno davanti alla folla (i
// cancelli i colpi li attraversano)
function somethingInRange({ army, spawner, chests }) {
  const { range } = WEAPONS.rifle;
  const ahead = (item) => item.z > army.front && item.z <= range;
  return spawner.enemies.some(ahead) || chests.list.some(ahead);
}
