import { ENEMIES } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';

// Nemici: compaiono in fondo alla strada e vengono avanti con il campo, solo durante le ondate.
// Ogni arrivo è un nemico in una corsia a caso o, con la probabilità dell'ondata, una fila di nemici
// affiancati su corsie diverse. Perdono vita quando sono colpiti; spariscono quando muoiono,
// quando si scontrano con l'esercito o quando lo superano
export function createSpawner(bus, rng, laneCenters) {
  const spawner = {
    enemies: [],
    pool: createPool(() => ({ x: 0, z: 0, hp: 0, maxHp: 0 }), ENEMIES.poolSize),
    wave: null,
    spawnsDue: 0,
    victims: [],
    freeLanes: [],
    bus,
    rng,
    laneCenters,
  };

  bus.on(EVENTS.WAVE_STARTED, ({ wave }) => {
    spawner.wave = wave;
    spawner.spawnsDue = 0;
  });
  bus.on(EVENTS.WAVE_ENDED, () => {
    spawner.wave = null;
  });

  bus.on(EVENTS.ENEMY_HIT, ({ enemy, damage }) => {
    enemy.hp -= damage;
    if (enemy.hp > 0) return;
    bus.emit(EVENTS.ENEMY_KILLED, enemy);
    spawner.enemies.splice(spawner.enemies.indexOf(enemy), 1);
    spawner.pool.release(enemy);
  });

  return spawner;
}

// Muove i nemici con il campo (scrollSpeed unità/s) e, durante un'ondata, ne fa arrivare di nuovi
export function updateSpawner(spawner, deltaMs, scrollSpeed) {
  const step = perFrame(scrollSpeed, deltaMs);
  for (const enemy of spawner.enemies) enemy.z -= step;

  const { wave } = spawner;
  if (wave === null) return;
  spawner.spawnsDue += perFrame(1 / wave.spawnInterval, deltaMs);
  while (spawner.spawnsDue >= 1) {
    spawnArrival(spawner, wave);
    spawner.spawnsDue -= 1;
  }
}

// Va chiamata dopo il combattimento: chi muore nel frame non arriva. Il nemico che tocca l'esercito
// si scontra e sparisce. Lo scontro costa caro: elimina tanti soldati quanta vita gli resta, almeno quelli
// che tocca, prima quelli che tocca e poi i più vicini; se tocca l'eroe, gli toglie vita.
// Chi passa senza toccare nessuno supera l'esercito e sparisce a despawnZ
export function clashEnemies(spawner, army) {
  const { enemies, pool, bus, victims } = spawner;
  for (let index = enemies.length - 1; index >= 0; index--) {
    const enemy = enemies[index];
    if (enemy.z < ENEMIES.despawnZ) {
      enemies.splice(index, 1);
      bus.emit(EVENTS.ENEMY_ESCAPED, enemy);
      pool.release(enemy);
      continue;
    }
    victims.length = 0;
    for (const soldier of army.soldiers) if (overlaps(enemy, soldier)) victims.push(soldier);
    const hitsHero = overlaps(enemy, army.hero);
    if (victims.length === 0 && !hitsHero) continue;
    enemies.splice(index, 1);
    if (victims.length > 0) {
      let losses = Math.max(victims.length, Math.ceil(enemy.hp));
      for (const soldier of victims) {
        killSoldier(bus, soldier);
        losses -= 1;
      }
      for (; losses > 0 && army.soldiers.length > 0; losses--) killSoldier(bus, nearest(army.soldiers, enemy));
    }
    if (hitsHero) bus.emit(EVENTS.HERO_HIT, enemy);
    bus.emit(EVENTS.ENEMY_CLASHED, enemy);
    pool.release(enemy);
  }
}

function killSoldier(bus, soldier) {
  bus.emit(EVENTS.SOLDIER_KILLED, { soldier, x: soldier.x, z: soldier.z });
}

// Nemico e membro dell'esercito (cubi con base centrata in x, z) si toccano
function overlaps(enemy, member) {
  const reach = (ENEMIES.size + member.size) / 2;
  return Math.abs(enemy.x - member.x) < reach && Math.abs(enemy.z - member.z) < reach;
}

function nearest(soldiers, enemy) {
  let best = soldiers[0];
  let bestDistance = Infinity;
  for (const soldier of soldiers) {
    const distance = (soldier.x - enemy.x) ** 2 + (soldier.z - enemy.z) ** 2;
    if (distance < bestDistance) {
      best = soldier;
      bestDistance = distance;
    }
  }
  return best;
}

// Un nemico solo o una fila: le corsie della fila si pescano a caso tra quelle ancora libere
function spawnArrival(spawner, wave) {
  const { rng, laneCenters, freeLanes } = spawner;
  const count = rng.float() < wave.rowChance ? Math.min(wave.rowSize, laneCenters.length) : 1;
  freeLanes.length = 0;
  for (const center of laneCenters) freeLanes.push(center);
  for (let n = 0; n < count; n++) {
    const [x] = freeLanes.splice(rng.int(freeLanes.length), 1);
    spawnEnemy(spawner, x, wave.enemyHp);
  }
}

function spawnEnemy(spawner, x, hp) {
  const enemy = spawner.pool.acquire();
  enemy.x = x;
  enemy.z = ENEMIES.spawnDistance;
  enemy.hp = hp;
  enemy.maxHp = hp;
  spawner.enemies.push(enemy);
}
