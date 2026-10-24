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

// Boss in strada, con i numeri del livello (data, cioè BOSS in data/waves.js). A campo fermo cammina verso gli eroi
// a walkSpeed fino a holdZ e lì si pianta davanti all'esercito, a tiro: non si scontra mai, si batte solo
// abbattendolo.
// Da piantato ripete: pausa, avviso con la zona tonda segnata a terra dove sta il capo, schiacciamento
// (i soldati dentro perdono una vita, gli eroi dentro la vita del tipo boss), passaggio lento in un'altra corsia.
// Finché non cambia corsia chiama la sua scorta (BOSS_ESCORT, la fa uscire il sistema dei nemici).
// La sua vita è divisa in strati uguali, che la barra in alto mostra uno alla volta: layer sono gli strati
// ancora pieni o in parte pieni, e quando uno si svuota segnala BOSS_LAYER_BROKEN.
// enemy è null quando il boss non c'è
export function createBoss(bus, rng, laneCenters) {
  const boss = {
    enemy: null,
    data: null,
    layers: 0,
    layer: 0,
    phase: BOSS_PHASES.walk,
    phaseMs: 0,
    lane: 0,
    targetLane: 0,
    zone: { x: 0, z: 0, radius: 0 },
    escortsDue: 0,
    victims: [],
    heroVictims: [],
    bus,
    rng,
    laneCenters,
  };
  bus.on(EVENTS.BOSS_SPAWNED, ({ enemy, data }) => {
    boss.enemy = enemy;
    boss.data = data;
    boss.layers = data.layers;
    boss.layer = data.layers;
    boss.lane = data.lane;
    boss.escortsDue = 0;
    enemy.extraSpeed = data.walkSpeed;
    startPhase(boss, BOSS_PHASES.walk);
  });
  // Il colpo che lo abbatte non rompe uno strato: il boss lascia la strada prima
  bus.on(EVENTS.ENEMY_HIT, ({ enemy }) => {
    if (enemy !== boss.enemy) return;
    const left = layersLeft(boss);
    if (left >= boss.layer) return;
    boss.layer = left;
    bus.emit(EVENTS.BOSS_LAYER_BROKEN, boss);
  });
  bus.on(EVENTS.BOSS_ENDED, () => {
    boss.enemy = null;
  });
  return boss;
}

// Va chiamata dopo il movimento dei nemici
export function updateBoss(boss, deltaMs, army) {
  const { enemy, data } = boss;
  if (enemy === null) return;
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
    smash(boss, army);
    boss.targetLane = otherLane(boss);
    startPhase(boss, BOSS_PHASES.move);
  } else if (boss.phase === BOSS_PHASES.move) {
    moveSideways(boss, deltaMs);
  }
  if (boss.phase !== BOSS_PHASES.move) callEscort(boss, deltaMs);
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

function smash(boss, army) {
  const { bus, zone, victims } = boss;
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

// Una corsia a caso tra le altre
function otherLane({ rng, laneCenters, lane }) {
  const pick = rng.int(laneCenters.length - 1);
  return pick >= lane ? pick + 1 : pick;
}

function moveSideways(boss, deltaMs) {
  const { enemy, laneCenters, targetLane } = boss;
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

// Ogni escort.interval secondi uno sciame in una corsia a caso: front se è quella del boss
function callEscort(boss, deltaMs) {
  const { bus, rng, laneCenters, data } = boss;
  boss.escortsDue += perFrame(1 / data.escort.interval, deltaMs);
  while (boss.escortsDue >= 1) {
    const lane = rng.int(laneCenters.length);
    bus.emit(EVENTS.BOSS_ESCORT, { lane, front: lane === boss.lane });
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
