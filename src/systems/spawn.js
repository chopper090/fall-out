import { ENEMIES } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';
import { ENEMY_TYPES, SWARM } from '../data/enemies.js';

// Nemici: compaiono in fondo alla strada e vengono avanti con il campo, solo durante le ondate.
// Ogni arrivo è, con le probabilità dell'ondata, uno sciame di cubetti, una fila di nemici affiancati
// su corsie diverse o un nemico solo; in file e arrivi singoli ogni nemico può essere di un tipo speciale
// (data/enemies.js). I veloci corrono di più, ma non attraversano gli altri nemici: se ne trovano uno
// davanti nella loro corsia gli restano in coda e ripartono quando la strada si libera.
// Perdono vita quando sono colpiti; spariscono quando muoiono, quando si scontrano con l'esercito
// o quando lo superano. Uno sciame che supera l'esercito conta come un nemico solo
export function createSpawner(bus, rng, laneCenters) {
  const spawner = {
    enemies: [],
    pool: createPool(() => ({ type: null, x: 0, z: 0, size: 0, hp: 0, maxHp: 0, swarm: null }), ENEMIES.poolSize),
    // alive: cubetti dello sciame ancora in strada; escaped: uno di loro ha già superato l'esercito
    swarmPool: createPool(() => ({ alive: 0, escaped: false }), ENEMIES.swarmPoolSize),
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
    removeEnemy(spawner, spawner.enemies.indexOf(enemy));
  });

  return spawner;
}

// Muove i nemici con il campo (scrollSpeed unità/s) e, durante un'ondata, ne fa arrivare di nuovi
export function updateSpawner(spawner, deltaMs, scrollSpeed) {
  const { enemies } = spawner;
  const step = perFrame(scrollSpeed, deltaMs);
  for (const enemy of enemies) enemy.z -= step;
  for (const enemy of enemies) {
    if (enemy.type.extraSpeed > 0) rush(enemies, enemy, perFrame(enemy.type.extraSpeed, deltaMs));
  }

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
// Chi passa senza toccare nessuno supera l'esercito e sparisce a despawnZ: conta (counted) se è
// un nemico solo o il primo del suo sciame
export function clashEnemies(spawner, army) {
  const { enemies, bus, victims } = spawner;
  for (let index = enemies.length - 1; index >= 0; index--) {
    const enemy = enemies[index];
    if (enemy.z < ENEMIES.despawnZ) {
      const counted = enemy.swarm === null || !enemy.swarm.escaped;
      if (enemy.swarm !== null) enemy.swarm.escaped = true;
      bus.emit(EVENTS.ENEMY_ESCAPED, { enemy, counted });
      removeEnemy(spawner, index);
      continue;
    }
    victims.length = 0;
    for (const soldier of army.soldiers) if (overlaps(enemy, soldier)) victims.push(soldier);
    const hitsHero = overlaps(enemy, army.hero);
    if (victims.length === 0 && !hitsHero) continue;
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
    removeEnemy(spawner, index);
  }
}

// Lo sciame torna nella sua pool quando l'ultimo cubetto lascia la strada
function removeEnemy({ enemies, pool, swarmPool }, index) {
  const enemy = enemies[index];
  enemies.splice(index, 1);
  if (enemy.swarm !== null) {
    enemy.swarm.alive -= 1;
    if (enemy.swarm.alive === 0) swarmPool.release(enemy.swarm);
  }
  pool.release(enemy);
}

function killSoldier(bus, soldier) {
  bus.emit(EVENTS.SOLDIER_KILLED, { soldier, x: soldier.x, z: soldier.z });
}

// Nemico e membro dell'esercito (cubi con base centrata in x, z) si toccano
function overlaps(enemy, member) {
  const reach = (enemy.size + member.size) / 2;
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

function spawnArrival(spawner, wave) {
  if (spawner.rng.float() < wave.swarmChance) spawnSwarm(spawner, wave);
  else spawnRow(spawner, wave);
}

// Un nemico solo o una fila: le corsie della fila si pescano a caso tra quelle ancora libere
function spawnRow(spawner, wave) {
  const { rng, laneCenters, freeLanes } = spawner;
  const count = rng.float() < wave.rowChance ? Math.min(wave.rowSize, laneCenters.length) : 1;
  freeLanes.length = 0;
  for (const center of laneCenters) freeLanes.push(center);
  for (let n = 0; n < count; n++) {
    const [x] = freeLanes.splice(rng.int(freeLanes.length), 1);
    spawnEnemy(spawner, pickType(rng, wave.specials), x, ENEMIES.spawnDistance, wave, null);
  }
}

// Griglia di cubetti su lanes corsie vicine, columnsPerLane colonne per corsia, fila dopo fila verso il fondo
function spawnSwarm(spawner, wave) {
  const { rng, laneCenters } = spawner;
  const { count } = wave.swarm;
  const lanes = Math.min(wave.swarm.lanes, laneCenters.length);
  const firstLane = rng.int(laneCenters.length - lanes + 1);
  const columns = lanes * SWARM.columnsPerLane;
  const swarm = spawner.swarmPool.acquire();
  swarm.alive = count;
  swarm.escaped = false;
  for (let n = 0; n < count; n++) {
    const column = n % columns;
    const lane = firstLane + Math.floor(column / SWARM.columnsPerLane);
    const offset = (column % SWARM.columnsPerLane) - (SWARM.columnsPerLane - 1) / 2;
    const x = laneCenters[lane] + offset * SWARM.spacing;
    const z = ENEMIES.spawnDistance + Math.floor(n / columns) * SWARM.spacing;
    spawnEnemy(spawner, ENEMY_TYPES.swarm, x, z, wave, swarm);
  }
}

// Tipo speciale con le probabilità dell'ondata, altrimenti normale
function pickType(rng, specials) {
  let roll = rng.float();
  for (const [name, chance] of Object.entries(specials)) {
    if (roll < chance) return ENEMY_TYPES[name];
    roll -= chance;
  }
  return ENEMY_TYPES.grunt;
}

// Il veloce avanza di extra in più del campo, ma si ferma a queueGap dal nemico più vicino davanti a lui
// nella sua corsia
function rush(enemies, runner, extra) {
  let limit = -Infinity;
  for (const other of enemies) {
    if (other === runner || other.z >= runner.z) continue;
    if (Math.abs(other.x - runner.x) >= (other.size + runner.size) / 2) continue;
    limit = Math.max(limit, other.z + (other.size + runner.size) / 2 + ENEMIES.queueGap);
  }
  runner.z = Math.max(Math.min(limit, runner.z), runner.z - extra);
}

function spawnEnemy(spawner, type, x, z, wave, swarm) {
  const enemy = spawner.pool.acquire();
  const hp = Math.max(1, Math.round(wave.enemyHp * type.hpScale));
  enemy.type = type;
  enemy.x = x;
  enemy.z = z;
  enemy.size = type.size;
  enemy.hp = hp;
  enemy.maxHp = hp;
  enemy.swarm = swarm;
  spawner.enemies.push(enemy);
}
