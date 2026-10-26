import { EVENTS } from '../core/events.js';
import { perFrame, secondsToMs } from '../core/time.js';

// Gli strati si contano con un minimo margine: la vita divisa per strato porta piccoli arrotondamenti
const LAYER_TOLERANCE = 1e-9;

// Fasi del boss in strada: cammina verso gli eroi a campo fermo (walk), si pianta e aspetta (rest), segna a terra
// la zona che sta per schiacciare (warn), dopo lo schiacciamento cambia corsia (move) e ricomincia ad aspettare
export const BOSS_PHASES = {
  walk: 'walk',
  rest: 'rest',
  warn: 'warn',
  move: 'move',
};

// I boss in strada (list: uno per boss, anche due o tre insieme nelle battaglie lunghe), ognuno con i suoi numeri
// (data, cioè BOSS in data/waves.js; la vita la scala il tipo della battaglia) e la sua corsia. A campo fermo cammina
// verso gli eroi a walkSpeed fino a holdZ e lì si pianta davanti all'esercito, a tiro: non si scontra mai, si batte
// solo abbattendolo. Da piantato ripete: pausa, avviso con la zona tonda segnata a terra dove sta il capo,
// schiacciamento (i soldati dentro perdono una vita, gli eroi dentro la vita del tipo boss), passaggio lento in
// un'altra corsia, mai in quella di un altro boss né attraverso. Finché non cambia corsia chiama la sua scorta
// (BOSS_ESCORT, la fa uscire il sistema dei nemici). La sua vita è divisa in strati uguali, che la barra in alto mostra
// uno alla volta: layer sono gli strati ancora pieni o in parte pieni, e quando uno si svuota segnala
// BOSS_LAYER_BROKEN. Lascia la lista quando lascia la strada (BOSS_ENDED)
export function createBosses(bus, rng, laneCenters) {
  const bosses = { list: [], bus, rng, laneCenters };
  bus.on(EVENTS.BOSS_SPAWNED, ({ enemy, data, lane }) => {
    enemy.extraSpeed = data.walkSpeed;
    bosses.list.push({
      enemy,
      data,
      layers: data.layers,
      layer: data.layers,
      phase: BOSS_PHASES.walk,
      phaseMs: 0,
      lane,
      targetLane: lane,
      zone: { x: 0, z: 0, radius: 0 },
      escortsDue: 0,
      victims: [],
      heroVictims: [],
    });
  });
  // Il colpo che lo abbatte non rompe uno strato: il boss lascia la strada prima
  bus.on(EVENTS.ENEMY_HIT, ({ enemy }) => {
    const boss = bosses.list.find((one) => one.enemy === enemy);
    if (boss === undefined) return;
    const left = layersLeft(boss);
    if (left >= boss.layer) return;
    boss.layer = left;
    bus.emit(EVENTS.BOSS_LAYER_BROKEN, boss);
  });
  bus.on(EVENTS.BOSS_ENDED, (enemy) => {
    bosses.list = bosses.list.filter((boss) => boss.enemy !== enemy);
  });
  return bosses;
}

// Va chiamata dopo il movimento dei nemici
export function updateBosses(bosses, deltaMs, army) {
  for (const boss of bosses.list) updateBoss(bosses, boss, deltaMs, army);
}

function updateBoss(bosses, boss, deltaMs, army) {
  const { enemy, data } = boss;
  boss.phaseMs += deltaMs;
  if (boss.phase === BOSS_PHASES.walk && enemy.z <= data.holdZ) {
    enemy.z = data.holdZ;
    enemy.extraSpeed = 0;
    startPhase(boss, BOSS_PHASES.rest);
  }

  const restMs = secondsToMs(data.restSeconds);
  if (boss.phase === BOSS_PHASES.rest && boss.phaseMs >= restMs) {
    markZone(boss, army.leader);
    startPhase(boss, BOSS_PHASES.warn, boss.phaseMs - restMs);
  } else if (boss.phase === BOSS_PHASES.warn && boss.phaseMs >= secondsToMs(data.smash.warnSeconds)) {
    smash(bosses.bus, boss, army);
    boss.targetLane = otherLane(bosses, boss);
    startPhase(boss, BOSS_PHASES.move);
  } else if (boss.phase === BOSS_PHASES.move) {
    moveSideways(bosses, boss, deltaMs);
  }
  if (boss.phase !== BOSS_PHASES.move) callEscort(bosses, boss, deltaMs);
}

// elapsedMs: tempo già passato nella nuova fase, così l'avviso dura giusto anche a pochi FPS
function startPhase(boss, phase, elapsedMs = 0) {
  boss.phase = phase;
  boss.phaseMs = elapsedMs;
}

// La zona resta dove stava il capo quando è partito l'avviso: c'è il tempo di uscirne
function markZone({ zone, data }, hero) {
  zone.x = hero.x;
  zone.z = hero.z;
  zone.radius = data.smash.radius;
}

function smash(bus, boss, army) {
  const { zone, victims } = boss;
  victims.length = 0;
  for (const soldier of army.soldiers) if (inZone(zone, soldier)) victims.push(soldier);
  for (const soldier of victims) bus.emit(EVENTS.SOLDIER_HIT, { soldier });
  // Prima si raccolgono anche gli eroi: chi muore lascia la lista degli eroi
  const { heroVictims } = boss;
  const { heroDamage } = boss.enemy.type;
  heroVictims.length = 0;
  for (const hero of army.heroes) if (inZone(zone, hero)) heroVictims.push(hero);
  for (const hero of heroVictims) bus.emit(EVENTS.HERO_HIT, { hero, damage: heroDamage });
  bus.emit(EVENTS.BOSS_SMASHED, zone);
}

// Dentro la zona chi ha il centro della base dentro il cerchio
function inZone(zone, member) {
  return Math.hypot(member.x - zone.x, member.z - zone.z) < zone.radius;
}

// Una corsia a caso tra le altre, senza un altro boss dentro, in arrivo o da attraversare per arrivarci; se non ce n'è
// nessuna il boss resta dov'è
function otherLane({ rng, laneCenters, list }, boss) {
  const blocked = (lane) => {
    const from = Math.min(boss.lane, lane);
    const to = Math.max(boss.lane, lane);
    const crossed = (at) => at >= from && at <= to;
    return list.some((other) => other !== boss && (crossed(other.lane) || crossed(other.targetLane)));
  };
  const free = laneCenters.map((_, lane) => lane).filter((lane) => lane !== boss.lane && !blocked(lane));
  return free.length === 0 ? boss.lane : free[rng.int(free.length)];
}

function moveSideways({ laneCenters }, boss, deltaMs) {
  const { enemy, targetLane } = boss;
  const targetX = laneCenters[targetLane];
  const step = perFrame(boss.data.moveSpeed, deltaMs);
  if (Math.abs(targetX - enemy.x) > step) {
    enemy.x += Math.sign(targetX - enemy.x) * step;
    return;
  }
  enemy.x = targetX;
  boss.lane = targetLane;
  startPhase(boss, BOSS_PHASES.rest);
}

// Ogni escort.interval secondi uno sciame in una corsia a caso: se nella corsia c'è un boss (lui o un altro, anche in
// arrivo) esce davanti a quel boss (front), così non nasce dentro un altro boss
function callEscort({ bus, rng, laneCenters, list }, boss, deltaMs) {
  boss.escortsDue += perFrame(1 / boss.data.escort.interval, deltaMs);
  while (boss.escortsDue >= 1) {
    const lane = rng.int(laneCenters.length);
    const owner = lane === boss.lane ? boss : list.find((other) => other.lane === lane || other.targetLane === lane);
    bus.emit(EVENTS.BOSS_ESCORT, { lane, front: owner !== undefined, enemy: (owner ?? boss).enemy });
    boss.escortsDue -= 1;
  }
}

// A che punto è l'avviso: da 0 (zona appena segnata) a 1 (schiacciamento adesso)
export function warnProgress(boss) {
  return Math.min(1, boss.phaseMs / secondsToMs(boss.data.smash.warnSeconds));
}

// Strati ancora pieni o in parte pieni
export function layersLeft({ enemy, layers }) {
  return Math.max(0, Math.ceil((enemy.hp / enemy.maxHp) * layers - LAYER_TOLERANCE));
}

// Quanto è pieno lo strato in cima, da 0 a 1
export function layerFill(boss) {
  const left = layersLeft(boss);
  if (left === 0) return 0;
  return (boss.enemy.hp / boss.enemy.maxHp) * boss.layers - (left - 1);
}
