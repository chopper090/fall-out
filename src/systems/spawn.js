import { ENEMIES, FIELD } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';

// Nemici: compaiono in fondo alla strada in una corsia a caso e vengono avanti con il campo.
// Perdono vita quando sono colpiti; spariscono quando muoiono, quando si scontrano con l'esercito
// o quando lo superano
export function createSpawner(bus, rng, laneCenters) {
  const spawner = {
    enemies: [],
    pool: createPool(() => ({ x: 0, z: 0, hp: 0, maxHp: 0 }), ENEMIES.poolSize),
    spawnsDue: 0,
    victims: [],
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

// Va chiamata dopo il combattimento: chi muore nel frame non arriva. Il nemico che tocca l'esercito
// si scontra e sparisce: elimina i soldati che tocca e, se tocca l'eroe, gli toglie vita.
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
    for (const soldier of victims) bus.emit(EVENTS.SOLDIER_KILLED, { soldier, x: soldier.x, z: soldier.z });
    if (hitsHero) bus.emit(EVENTS.HERO_HIT, enemy);
    bus.emit(EVENTS.ENEMY_CLASHED, enemy);
    pool.release(enemy);
  }
}

// Nemico e membro dell'esercito (cubi con base centrata in x, z) si toccano
function overlaps(enemy, member) {
  const reach = (ENEMIES.size + member.size) / 2;
  return Math.abs(enemy.x - member.x) < reach && Math.abs(enemy.z - member.z) < reach;
}

function spawnEnemy(spawner) {
  const enemy = spawner.pool.acquire();
  enemy.x = spawner.laneCenters[spawner.rng.int(spawner.laneCenters.length)];
  enemy.z = ENEMIES.spawnDistance;
  enemy.hp = ENEMIES.hp;
  enemy.maxHp = ENEMIES.hp;
  spawner.enemies.push(enemy);
}
