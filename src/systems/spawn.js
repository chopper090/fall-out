import { ENEMIES, FIELD, HERO } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';

// Nemici: compaiono in fondo alla strada in una corsia a caso e vengono avanti con il campo.
// Perdono vita quando sono colpiti; spariscono quando muoiono o quando arrivano al fronte dell'esercito
export function createSpawner(bus, rng, laneCenters) {
  const spawner = {
    enemies: [],
    pool: createPool(() => ({ x: 0, z: 0, hp: 0, maxHp: 0 }), ENEMIES.poolSize),
    spawnsDue: 0,
    bus,
    rng,
    laneCenters,
  };

  bus.on(EVENTS.ENEMY_HIT, ({ enemy, damage }) => {
    enemy.hp -= damage;
    if (enemy.hp > 0) return;
    bus.emit(EVENTS.ENEMY_KILLED, enemy);
    spawner.enemies.splice(spawner.enemies.indexOf(enemy), 1);
    spawner.pool.release(enemy);
  });

  return spawner;
}

// Muove i nemici con il campo e ne fa comparire di nuovi
export function updateSpawner(spawner, deltaMs) {
  const step = perFrame(FIELD.scrollSpeed, deltaMs);
  for (const enemy of spawner.enemies) enemy.z -= step;

  spawner.spawnsDue += perFrame(1 / ENEMIES.spawnInterval, deltaMs);
  while (spawner.spawnsDue >= 1) {
    spawnEnemy(spawner);
    spawner.spawnsDue -= 1;
  }
}

// Va chiamata dopo il combattimento: chi muore nel frame non arriva. I nemici sono in ordine di comparsa,
// quindi i più vecchi sono i più vicini. Chi tocca il fronte dell'esercito, in qualunque corsia,
// lo supera: sparisce e l'esercito perde energia
export function breachEnemies(spawner) {
  const { enemies, pool, bus } = spawner;
  const breachZ = (HERO.size + ENEMIES.size) / 2;
  while (enemies.length > 0 && enemies[0].z <= breachZ) {
    const enemy = enemies.shift();
    bus.emit(EVENTS.ENEMY_BREACHED, enemy);
    pool.release(enemy);
  }
}

function spawnEnemy(spawner) {
  const enemy = spawner.pool.acquire();
  enemy.x = spawner.laneCenters[spawner.rng.int(spawner.laneCenters.length)];
  enemy.z = ENEMIES.spawnDistance;
  enemy.hp = ENEMIES.hp;
  enemy.maxHp = ENEMIES.hp;
  spawner.enemies.push(enemy);
}
