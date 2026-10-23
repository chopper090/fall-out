import { ENEMIES, LEVEL } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';
import { ENEMY_TYPES, SWARM } from '../data/enemies.js';

// Nemici: durante le ondate compaiono in fondo alla strada e vengono avanti con il campo.
// Ogni arrivo è, con le probabilità dell'ondata, uno sciame di pedine piccole, una fila di nemici affiancati
// su corsie diverse o un nemico solo; in file e arrivi singoli ogni nemico può essere di un tipo speciale
// (data/enemies.js). Nessuno attraversa chi ha davanti nella sua corsia: i veloci, che corrono di più, e chi
// arriva dietro a un nemico fermo (un tiratore che spara, il boss) gli restano in coda e ripartono quando la
// strada si libera.
// Perdono vita quando sono colpiti; spariscono quando muoiono, quando si scontrano con l'esercito
// o quando lo superano. Uno sciame che supera l'esercito conta come un nemico solo.
// La prima ondata della partita trova la strada già popolata (headStart).
// Dopo le ondate arriva il boss, un nemico in più nella stessa lista (come si muove lo decide systems/boss.js):
// compare con BOSS_SPAWNED, BOSS_ENDED quando lascia la strada. La sua scorta esce da lui quando la chiama
// (BOSS_ESCORT), non dal fondo della strada
export function createSpawner(bus, rng, laneCenters) {
  const spawner = {
    enemies: [],
    // extraSpeed: unità/s in più del campo, all'inizio quella del tipo (la cambiano il boss quando si pianta
    // e il tiratore quando si ferma a sparare)
    pool: createPool(
      () => ({ type: null, x: 0, z: 0, size: 0, hp: 0, maxHp: 0, extraSpeed: 0, swarm: null }),
      ENEMIES.poolSize,
    ),
    // alive: pedine dello sciame ancora in strada; escaped: uno di loro ha già superato l'esercito
    swarmPool: createPool(() => ({ alive: 0, escaped: false }), ENEMIES.swarmPoolSize),
    wave: null,
    spawnsDue: 0,
    victims: [],
    freeLanes: [],
    headStart: true,
    boss: null,
    bossData: null,
    bus,
    rng,
    laneCenters,
  };

  bus.on(EVENTS.WAVE_STARTED, ({ wave }) => {
    spawner.wave = wave;
    spawner.spawnsDue = 0;
    if (spawner.headStart) fillRoad(spawner, wave);
    spawner.headStart = false;
  });
  bus.on(EVENTS.WAVE_ENDED, () => {
    spawner.wave = null;
  });
  bus.on(EVENTS.BOSS_STARTED, ({ boss }) => spawnBoss(spawner, boss));
  bus.on(EVENTS.BOSS_ESCORT, ({ lane, front }) => spawnEscort(spawner, lane, front));

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
  // Prima chi è più lento del campo (chi è fermo davanti all'esercito), poi gli altri, ognuno in coda
  // a chi ha davanti
  const step = perFrame(scrollSpeed, deltaMs);
  for (const enemy of enemies) if (enemy.extraSpeed < 0) enemy.z -= step + perFrame(enemy.extraSpeed, deltaMs);
  for (const enemy of enemies) if (enemy.extraSpeed >= 0) advance(enemies, enemy, step + perFrame(enemy.extraSpeed, deltaMs));

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
    if (hitsHero) bus.emit(EVENTS.HERO_HIT, enemy.type.heroDamage);
    bus.emit(EVENTS.ENEMY_CLASHED, enemy);
    removeEnemy(spawner, index);
  }
}

// Lo sciame torna nella sua pool quando la sua ultima pedina lascia la strada
function removeEnemy(spawner, index) {
  const { enemies, pool, swarmPool } = spawner;
  const enemy = enemies[index];
  enemies.splice(index, 1);
  if (enemy.swarm !== null) {
    enemy.swarm.alive -= 1;
    if (enemy.swarm.alive === 0) swarmPool.release(enemy.swarm);
  }
  if (enemy === spawner.boss) {
    spawner.boss = null;
    spawner.bus.emit(EVENTS.BOSS_ENDED, enemy);
  }
  pool.release(enemy);
}

function killSoldier(bus, soldier) {
  bus.emit(EVENTS.SOLDIER_KILLED, { soldier, x: soldier.x, z: soldier.z });
}

// Nemico e membro dell'esercito (ingombri quadrati con base centrata in x, z) si toccano
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

// Partenza rapida: sulla strada ci sono già gli arrivi degli ultimi secondi, come se l'ondata fosse
// in corso da un po', ognuno dove sarebbe arrivato, da LEVEL.headStartZ fino al fondo, dove ne compare
// uno proprio adesso; i successivi arrivano al ritmo dell'ondata
function fillRoad(spawner, wave) {
  const spacing = wave.spawnInterval * wave.scrollSpeed;
  const count = Math.floor((ENEMIES.spawnDistance - LEVEL.headStartZ) / spacing);
  for (let n = count; n >= 0; n--) spawnArrival(spawner, wave, ENEMIES.spawnDistance - n * spacing);
}

// z: distanza da cui parte l'arrivo, di solito il fondo della strada
function spawnArrival(spawner, wave, z = ENEMIES.spawnDistance) {
  const { rng, laneCenters } = spawner;
  if (rng.float() < wave.swarmChance) {
    const lanes = Math.min(wave.swarm.lanes, laneCenters.length);
    const firstLane = rng.int(laneCenters.length - lanes + 1);
    spawnSwarm(spawner, wave.swarm.count, firstLane, lanes, z, enemyHp(wave.enemyHp, ENEMY_TYPES.swarm));
  } else {
    spawnRow(spawner, wave, z);
  }
}

// Un nemico solo o una fila: le corsie della fila si pescano a caso tra quelle ancora libere,
// e in ogni corsia il nemico entra in un punto a caso
function spawnRow(spawner, wave, z) {
  const { rng, laneCenters, freeLanes } = spawner;
  const count = rng.float() < wave.rowChance ? Math.min(wave.rowSize, laneCenters.length) : 1;
  freeLanes.length = 0;
  for (const center of laneCenters) freeLanes.push(center);
  for (let n = 0; n < count; n++) {
    const [center] = freeLanes.splice(rng.int(freeLanes.length), 1);
    const type = pickType(rng, wave.specials);
    spawnEnemy(spawner, type, center + laneOffset(spawner, type.size), z, enemyHp(wave.enemyHp, type), null);
  }
}

// Spostamento a caso dal centro della corsia per qualcosa largo width: resta tutto dentro la corsia
function laneOffset({ rng, laneCenters }, width) {
  const halfLane = (laneCenters[1] - laneCenters[0]) / 2;
  const room = Math.max(0, halfLane - width / 2 - ENEMIES.laneMargin);
  return (rng.float() * 2 - 1) * room;
}

// Griglia di count pedine su lanes corsie vicine a partire da firstLane, columnsPerLane colonne per corsia,
// fila dopo fila verso il fondo a partire da z. Tutto lo sciame è spostato dello stesso tratto a caso,
// così ogni blocco resta nella sua corsia
function spawnSwarm(spawner, count, firstLane, lanes, z, hp) {
  const { laneCenters } = spawner;
  const columns = lanes * SWARM.columnsPerLane;
  const blockWidth = (SWARM.columnsPerLane - 1) * SWARM.spacing + ENEMY_TYPES.swarm.size;
  const shift = laneOffset(spawner, blockWidth);
  const swarm = spawner.swarmPool.acquire();
  swarm.alive = count;
  swarm.escaped = false;
  for (let n = 0; n < count; n++) {
    const column = n % columns;
    const lane = firstLane + Math.floor(column / SWARM.columnsPerLane);
    const offset = (column % SWARM.columnsPerLane) - (SWARM.columnsPerLane - 1) / 2;
    const x = laneCenters[lane] + shift + offset * SWARM.spacing;
    spawnEnemy(spawner, ENEMY_TYPES.swarm, x, z + Math.floor(n / columns) * SWARM.spacing, hp, swarm);
  }
}

// Il boss entra in fondo alla strada, al centro della sua corsia
// data: i numeri del boss del livello (BOSS, data/waves.js); spawner.boss è il nemico in strada
function spawnBoss(spawner, data) {
  const x = spawner.laneCenters[data.lane];
  spawner.boss = spawnEnemy(spawner, ENEMY_TYPES.boss, x, ENEMIES.spawnDistance, data.hp, null);
  spawner.bossData = data;
  spawner.bus.emit(EVENTS.BOSS_SPAWNED, { enemy: spawner.boss, data });
}

// Sciame di scorta nella corsia lane: davanti al boss (front, la sua corsia) le sue file finiscono escort.gap
// prima di lui, nelle altre corsie il blocco è al suo fianco, alla sua stessa distanza. Se la sua prima fila
// fosse più vicina di escort.minZ non esce: arriverebbe all'esercito senza dare il tempo di reagire
function spawnEscort(spawner, lane, front) {
  const { boss, bossData } = spawner;
  const { count, gap, minZ } = bossData.escort;
  const rowsDepth = (Math.ceil(count / SWARM.columnsPerLane) - 1) * SWARM.spacing;
  const z = front
    ? boss.z - boss.size / 2 - gap - ENEMY_TYPES.swarm.size / 2 - rowsDepth
    : boss.z - rowsDepth / 2;
  if (z < minZ) return;
  spawnSwarm(spawner, count, lane, 1, z, enemyHp(bossData.enemyHp, ENEMY_TYPES.swarm));
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

// Il nemico avanza di distance, ma si ferma a queueGap dal nemico più vicino davanti a lui nella sua corsia
function advance(enemies, runner, distance) {
  let limit = -Infinity;
  for (const other of enemies) {
    if (other === runner || other.z >= runner.z) continue;
    if (Math.abs(other.x - runner.x) >= (other.size + runner.size) / 2) continue;
    limit = Math.max(limit, other.z + (other.size + runner.size) / 2 + ENEMIES.queueGap);
  }
  runner.z = Math.max(Math.min(limit, runner.z), runner.z - distance);
}

// Vita di un nemico del tipo type, se quella dei nemici normali è baseHp
function enemyHp(baseHp, type) {
  return Math.max(1, Math.round(baseHp * type.hpScale));
}

function spawnEnemy(spawner, type, x, z, hp, swarm) {
  const enemy = spawner.pool.acquire();
  enemy.type = type;
  enemy.x = x;
  enemy.z = z;
  enemy.size = type.size;
  enemy.hp = hp;
  enemy.maxHp = hp;
  enemy.extraSpeed = type.extraSpeed;
  enemy.swarm = swarm;
  spawner.enemies.push(enemy);
  return enemy;
}
