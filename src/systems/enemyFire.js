import { ENEMIES, ENEMY_SHOT, LANES } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame, secondsToMs } from '../core/time.js';

// Che cosa sta facendo un tiratore: viene avanti con il campo (walk), è fermo a sparare (stop),
// ha finito e riparte come gli altri (go)
const SHOOTER_PHASES = {
  walk: 'walk',
  stop: 'stop',
  go: 'go',
};

// Nemici che sparano, cioè i tipi con fire (data/enemies.js). Arrivati a fire.stopZ si fermano davanti
// all'esercito per fire.stopSeconds e sparano ogni fire.interval secondi, poi ripartono con il campo.
// Ogni colpo vola dritto a ENEMY_SHOT.speed verso il punto dove stava uno degli eroi, a caso, quando è partito,
// e oltre; si ferma sulla prima pedina dell'esercito che incontra lungo il tratto percorso nel frame. Finché
// è alzato lo scudo del difensore (SHIELD_RAISED, shieldMs) i colpi che arrivano si fermano senza fare danno.
// Eventi: ENEMY_FIRED con il tiratore, poi SOLDIER_KILLED, HERO_HIT (con eroe e danno) o SHOT_BLOCKED
export function createEnemyFire(bus, rng) {
  const fire = {
    shooters: new Map(),
    shots: [],
    shieldMs: 0,
    rng,
    shooterPool: createPool(() => ({ phase: SHOOTER_PHASES.walk, elapsedMs: 0, nextShotMs: 0 }), ENEMIES.shooterPoolSize),
    pool: createPool(() => ({ x: 0, z: 0, vx: 0, vz: 0, damage: 0 }), ENEMY_SHOT.poolSize),
    bus,
  };
  // Il tiratore che lascia la strada non serve più seguirlo; i suoi colpi già partiti continuano
  const forget = (enemy) => {
    const state = fire.shooters.get(enemy);
    if (state === undefined) return;
    fire.shooters.delete(enemy);
    fire.shooterPool.release(state);
  };
  bus.on(EVENTS.ENEMY_KILLED, forget);
  bus.on(EVENTS.ENEMY_CLASHED, forget);
  bus.on(EVENTS.ENEMY_ESCAPED, ({ enemy }) => forget(enemy));
  bus.on(EVENTS.SHIELD_RAISED, ({ ms }) => {
    fire.shieldMs = ms;
  });
  return fire;
}

// Va chiamata dopo il movimento dei nemici. scrollSpeed: velocità del campo, che il tiratore fermo annulla
export function updateEnemyFire(fire, enemies, army, deltaMs, scrollSpeed) {
  fire.shieldMs = Math.max(0, fire.shieldMs - deltaMs);
  for (const enemy of enemies) {
    if (enemy.type.fire === undefined) continue;
    updateShooter(fire, enemy, stateOf(fire, enemy), army.heroes, deltaMs, scrollSpeed);
  }
  moveShots(fire, army, deltaMs);
}

function stateOf(fire, enemy) {
  let state = fire.shooters.get(enemy);
  if (state === undefined) {
    state = fire.shooterPool.acquire();
    state.phase = SHOOTER_PHASES.walk;
    state.elapsedMs = 0;
    fire.shooters.set(enemy, state);
  }
  return state;
}

// Si ferma dove si trova appena passa stopZ; il primo colpo parte dopo firstDelay, ognuno dei successivi
// interval dopo il precedente, finché resta fermo
function updateShooter(fire, enemy, state, heroes, deltaMs, scrollSpeed) {
  const spec = enemy.type.fire;
  if (state.phase === SHOOTER_PHASES.walk && enemy.z <= spec.stopZ) {
    state.phase = SHOOTER_PHASES.stop;
    state.nextShotMs = secondsToMs(spec.firstDelay);
  }
  if (state.phase !== SHOOTER_PHASES.stop) return;
  enemy.extraSpeed = -scrollSpeed;
  state.elapsedMs += deltaMs;
  const stopMs = secondsToMs(spec.stopSeconds);
  while (state.nextShotMs < stopMs && state.elapsedMs >= state.nextShotMs) {
    shoot(fire, enemy, heroes);
    state.nextShotMs += secondsToMs(spec.interval);
  }
  if (state.elapsedMs < stopMs) return;
  state.phase = SHOOTER_PHASES.go;
  enemy.extraSpeed = enemy.type.extraSpeed;
}

// Il colpo parte davanti al tiratore, diretto dove sta adesso uno degli eroi, a caso
function shoot(fire, enemy, heroes) {
  if (heroes.length === 0) return;
  const hero = heroes[fire.rng.int(heroes.length)];
  const shot = fire.pool.acquire();
  shot.x = enemy.x;
  shot.z = enemy.z - (enemy.size + ENEMY_SHOT.size) / 2;
  const dx = hero.x - shot.x;
  const dz = hero.z - shot.z;
  const length = Math.hypot(dx, dz);
  shot.vx = (ENEMY_SHOT.speed * dx) / length;
  shot.vz = (ENEMY_SHOT.speed * dz) / length;
  shot.damage = enemy.type.heroDamage;
  fire.shots.push(shot);
  fire.bus.emit(EVENTS.ENEMY_FIRED, enemy);
}

function moveShots(fire, army, deltaMs) {
  const { shots, bus } = fire;
  for (let index = shots.length - 1; index >= 0; index--) {
    const shot = shots[index];
    const fromX = shot.x;
    const fromZ = shot.z;
    shot.x += perFrame(shot.vx, deltaMs);
    shot.z += perFrame(shot.vz, deltaMs);
    const target = firstTouched(army, shot, fromX, fromZ);
    const isHero = target !== null && army.heroes.includes(target);
    if (target !== null && fire.shieldMs > 0) bus.emit(EVENTS.SHOT_BLOCKED, { x: shot.x, z: shot.z });
    else if (isHero) bus.emit(EVENTS.HERO_HIT, { hero: target, damage: shot.damage });
    else if (target !== null) bus.emit(EVENTS.SOLDIER_KILLED, { soldier: target, x: target.x, z: target.z });
    const gone = shot.z < ENEMY_SHOT.despawnZ || shot.x < -ENEMY_SHOT.size || shot.x > LANES.fieldWidth + ENEMY_SHOT.size;
    if (target !== null || gone) removeShot(fire, index);
  }
}

// Tra gli eroi e i soldati, quello in cui il colpo entra per primo lungo il tratto da (fromX, fromZ) a dove
// è arrivato: così anche a pochi FPS il colpo non passa attraverso nessuno
function firstTouched(army, shot, fromX, fromZ) {
  const stepX = shot.x - fromX;
  const stepZ = shot.z - fromZ;
  const stepLength2 = stepX * stepX + stepZ * stepZ;
  let first = null;
  let firstT = Infinity;
  const check = (member) => {
    const reach = (ENEMY_SHOT.size + member.size) / 2;
    const t = entryTime(fromX - member.x, fromZ - member.z, stepX, stepZ, stepLength2, reach);
    if (t < firstT) {
      first = member;
      firstT = t;
    }
  };
  for (const hero of army.heroes) check(hero);
  for (const soldier of army.soldiers) check(soldier);
  return first;
}

// Frazione del tratto (da 0 a 1) a cui il colpo entra nel cerchio di raggio reach attorno a una pedina,
// Infinity se nel tratto non ci entra. (ox, oz): da dove parte il colpo rispetto alla pedina
function entryTime(ox, oz, stepX, stepZ, stepLength2, reach) {
  const inside = ox * ox + oz * oz - reach * reach;
  if (inside < 0) return 0;
  if (stepLength2 === 0) return Infinity;
  const half = ox * stepX + oz * stepZ;
  const discriminant = half * half - stepLength2 * inside;
  if (discriminant < 0) return Infinity;
  const t = (-half - Math.sqrt(discriminant)) / stepLength2;
  return t >= 0 && t <= 1 ? t : Infinity;
}

// I colpi non hanno un ordine: quello tolto lascia il posto all'ultimo della lista
function removeShot({ shots, pool }, index) {
  pool.release(shots[index]);
  shots[index] = shots[shots.length - 1];
  shots.pop();
}
