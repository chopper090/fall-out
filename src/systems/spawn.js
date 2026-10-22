import { ENEMIES, FIELD } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';

// Nemici: compaiono in fondo alla strada in una corsia a caso e vengono avanti con il campo.
// Perdono vita quando sono colpiti; spariscono quando muoiono o dopo aver superato l'eroe
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

// I nemici sono in ordine di comparsa: i più vecchi sono i più vicini e passano l'eroe per primi
export function updateSpawner(spawner, deltaMs) {
  const { enemies, pool, bus } = spawner;
  const step = perFrame(FIELD.scrollSpeed, deltaMs);
  for (const enemy of enemies) enemy.z -= step;
  while (enemies.length > 0 && enemies[0].z < ENEMIES.despawnDistance) {
    const enemy = enemies.shift();
    bus.emit(EVENTS.ENEMY_DESPAWNED, enemy);
    pool.release(enemy);
  }

  spawner.spawnsDue += perFrame(1 / ENEMIES.spawnInterval, deltaMs);
  while (spawner.spawnsDue >= 1) {
    spawnEnemy(spawner);
    spawner.spawnsDue -= 1;
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
