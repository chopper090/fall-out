import { ENEMIES, LEVEL } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame } from '../core/time.js';
import { ENEMY_TYPES, SWARM } from '../data/enemies.js';

// Nemici: durante le ondate compaiono in fondo alla strada e vengono avanti con il campo. Ogni arrivo è, con le
// probabilità dell'ondata, uno sciame di pedine piccole, una fila di nemici affiancati su corsie diverse o un nemico
// solo; in file e arrivi singoli ogni nemico può essere di un tipo speciale (data/enemies.js). Nessuno attraversa chi
// ha davanti nella sua corsia, tranne il boss, che passa sopra la sua scorta: i veloci, che corrono di più, e chi
// arriva dietro a un nemico fermo (un tiratore che spara, il boss) gli restano in coda e ripartono quando la strada si
// libera. Perdono vita quando sono colpiti; spariscono quando muoiono, quando si scontrano con l'esercito o quando lo
// superano. Ogni colpo li spinge indietro (knock, unità/s lungo la strada, verso il fondo: ENEMIES.knockback, in
// proporzione alla parte di vita tolta e al knockback del tipo), finché non tocca chi ha dietro nella sua corsia, e la
// spinta cala da sola. A campo fermo ogni colpo frena anche chi cammina da solo, il boss in marcia e la scorta (brake,
// da 0 a maxBrake del tipo; ENEMIES.brake), e il freno cala da solo. Uno sciame che supera l'esercito conta come un
// nemico solo. La prima ondata della partita trova la strada già popolata (headStart). Dopo le ondate, se la battaglia
// li ha, arrivano i boss, un gruppo alla volta (anche due insieme): nemici in più nella stessa lista (come si muovono
// lo decide systems/boss.js), ognuno compare con BOSS_SPAWNED e lascia la strada con BOSS_ENDED; non si scontrano mai
// con l'esercito. La scorta esce dal suo boss quando la chiama (BOSS_ESCORT), non dal fondo della strada, e a campo
// fermo cammina da sola. hpScale: la vita di tutti i
// nemici, boss compreso, è hpScale volte quella dei dati (le regole della battaglia, una casella della strada o la
// sfida, e la difficoltà di prova li fanno più duri); countScale: gli arrivi sono countScale volte quelli dell'ondata
// (le regole e la difficoltà di prova); specialsScale: per tipo speciale, quante volte più spesso arriva
export function createSpawner(bus, rng, laneCenters, hpScale = 1, countScale = 1, specialsScale = {}) {
  const spawner = {
    enemies: [],
    hpScale,
    countScale,
    specialsScale,
    // extraSpeed: unità/s in più del campo, all'inizio quella del tipo (la scorta e il boss camminano da soli a campo
    // fermo; il boss quando si pianta e il tiratore quando si ferma a sparare stanno fermi)
    pool: createPool(
      () => ({ type: null, x: 0, z: 0, size: 0, hp: 0, maxHp: 0, extraSpeed: 0, brake: 0, knock: 0, swarm: null }),
      ENEMIES.poolSize,
    ),
    // alive: pedine dello sciame ancora in strada; escaped: uno di loro ha già superato l'esercito
    swarmPool: createPool(() => ({ alive: 0, escaped: false }), ENEMIES.swarmPoolSize),
    // stopped: il campo è fermo, i colpi frenano
    stopped: false,
    wave: null,
    spawnsDue: 0,
    victims: [],
    heroVictims: [],
    freeLanes: [],
    headStart: true,
    bosses: new Set(),
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
  bus.on(EVENTS.BOSS_STARTED, ({ boss, group }) => spawnBosses(spawner, boss, group));
  bus.on(EVENTS.BOSS_ESCORT, ({ lane, front, enemy }) => spawnEscort(spawner, lane, front, enemy));

  bus.on(EVENTS.ENEMY_HIT, ({ enemy, damage }) => {
    const { strength, maxSpeed } = ENEMIES.knockback;
    enemy.knock = Math.min(maxSpeed, enemy.knock + (strength * enemy.type.knockback * damage) / enemy.maxHp);
    if (spawner.stopped && enemy.extraSpeed > 0) {
      const brake = enemy.brake + (ENEMIES.brake.strength * damage) / enemy.maxHp;
      enemy.brake = Math.min(enemy.type.maxBrake, brake);
    }
    enemy.hp -= damage;
    if (enemy.hp > 0) return;
    bus.emit(EVENTS.ENEMY_KILLED, enemy);
    removeEnemy(spawner, spawner.enemies.indexOf(enemy));
  });

  return spawner;
}

// Muove i nemici con il campo (scrollSpeed unità/s) e, durante un'ondata, ne fa arrivare di nuovi. Prima i colpi
// del frame passato li spingono indietro; a campo fermo ognuno cammina frenato dal suo freno. Spinta e freno
// intanto calano
export function updateSpawner(spawner, deltaMs, scrollSpeed) {
  const { enemies } = spawner;
  spawner.stopped = scrollSpeed === 0;
  const keep = 0.5 ** (deltaMs / ENEMIES.brake.halfLifeMs);
  const knockKeep = 0.5 ** (deltaMs / ENEMIES.knockback.halfLifeMs);
  for (const enemy of enemies) {
    // Il freno c'è solo a campo fermo: a campo in moto è zero, così ownSpeed non deve guardare la velocità del campo
    enemy.brake = spawner.stopped ? enemy.brake * keep : 0;
    retreat(enemies, enemy, perFrame(enemy.knock, deltaMs));
    enemy.knock *= knockKeep;
  }
  // Prima chi è più lento del campo (chi è fermo davanti all'esercito) e i boss, che passano sopra la loro scorta, poi
  // gli altri, ognuno in coda a chi ha davanti
  const step = perFrame(scrollSpeed, deltaMs);
  const { bosses } = spawner;
  for (const enemy of enemies) {
    if (enemy.extraSpeed < 0 || bosses.has(enemy)) enemy.z -= step + perFrame(ownSpeed(enemy), deltaMs);
  }
  for (const enemy of enemies) {
    if (enemy.extraSpeed >= 0 && !bosses.has(enemy)) {
      advance(enemies, enemy, step + perFrame(ownSpeed(enemy), deltaMs));
    }
  }

  const { wave } = spawner;
  if (wave === null) return;
  spawner.spawnsDue += perFrame(spawner.countScale / wave.spawnInterval, deltaMs);
  while (spawner.spawnsDue >= 1) {
    spawnArrival(spawner, wave);
    spawner.spawnsDue -= 1;
  }
}

// Va chiamata dopo il combattimento: chi muore nel frame non arriva. Il nemico che tocca l'esercito
// si scontra e sparisce. Lo scontro costa caro: toglie tante vite di soldato quanta vita gli resta, almeno una a
// ognuno di quelli che tocca, prima a quelli che tocca e poi ai più vicini (un soldato ne ha una, un'élite di più);
// a ogni eroe che tocca toglie vita.
// Chi passa senza toccare nessuno supera l'esercito e sparisce a despawnZ: conta (counted) se è
// un nemico solo o il primo del suo sciame
export function clashEnemies(spawner, army) {
  const { enemies, bus, victims, heroVictims } = spawner;
  for (let index = enemies.length - 1; index >= 0; index--) {
    const enemy = enemies[index];
    if (enemy.z < ENEMIES.despawnZ) {
      const counted = enemy.swarm === null || !enemy.swarm.escaped;
      if (enemy.swarm !== null) enemy.swarm.escaped = true;
      bus.emit(EVENTS.ENEMY_ESCAPED, { enemy, counted });
      removeEnemy(spawner, index);
      continue;
    }
    if (spawner.bosses.has(enemy)) continue;
    victims.length = 0;
    heroVictims.length = 0;
    for (const soldier of army.soldiers) if (overlaps(enemy, soldier)) victims.push(soldier);
    for (const hero of army.heroes) if (overlaps(enemy, hero)) heroVictims.push(hero);
    if (victims.length === 0 && heroVictims.length === 0) continue;
    if (victims.length > 0) {
      let losses = Math.max(victims.length, Math.ceil(enemy.hp));
      for (const soldier of victims) {
        hitSoldier(bus, soldier);
        losses -= 1;
      }
      for (; losses > 0 && army.soldiers.length > 0; losses--) hitSoldier(bus, nearest(army.soldiers, enemy));
    }
    for (const hero of heroVictims) bus.emit(EVENTS.HERO_HIT, { hero, damage: enemy.type.heroDamage });
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
  if (spawner.bosses.has(enemy)) {
    spawner.bosses.delete(enemy);
    spawner.bus.emit(EVENTS.BOSS_ENDED, enemy);
  }
  pool.release(enemy);
}

function hitSoldier(bus, soldier) {
  bus.emit(EVENTS.SOLDIER_HIT, { soldier });
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
  const spacing = (wave.spawnInterval / spawner.countScale) * wave.scrollSpeed;
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
// e in ogni corsia il nemico entra in un punto a caso; in una fila ognuno fino a ENEMIES.rowStagger più indietro
function spawnRow(spawner, wave, z) {
  const { rng, laneCenters, freeLanes } = spawner;
  const count = rng.float() < wave.rowChance ? Math.min(wave.rowSize, laneCenters.length) : 1;
  freeLanes.length = 0;
  for (const center of laneCenters) freeLanes.push(center);
  for (let n = 0; n < count; n++) {
    const [center] = freeLanes.splice(rng.int(freeLanes.length), 1);
    const type = pickType(rng, wave.specials, spawner.specialsScale);
    const back = count > 1 ? rng.float() * ENEMIES.rowStagger : 0;
    spawnEnemy(spawner, type, center + laneOffset(spawner, type.size), z + back, enemyHp(wave.enemyHp, type), null);
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
// così ogni blocco resta nella sua corsia, e ogni pedina in più di poco (SWARM.jitter), così non stanno in riga.
// extraSpeed: unità/s in più del campo di ogni pedina
function spawnSwarm(spawner, count, firstLane, lanes, z, hp, extraSpeed = ENEMY_TYPES.swarm.extraSpeed) {
  const { laneCenters, rng } = spawner;
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
    const x = laneCenters[lane] + shift + offset * SWARM.spacing + (rng.float() * 2 - 1) * SWARM.jitter;
    const rowZ = z + Math.floor(n / columns) * SWARM.spacing + (rng.float() * 2 - 1) * SWARM.jitter;
    const pawn = spawnEnemy(spawner, ENEMY_TYPES.swarm, x, rowZ, hp, swarm);
    pawn.extraSpeed = extraSpeed;
  }
}

// I boss del gruppo group, insieme: ognuno entra a data.spawnZ al centro della sua corsia (lane), con la vita di data
// (BOSS, data/waves.js) per il suo hpScale (il tipo della battaglia); spawner.bosses sono quelli in strada
function spawnBosses(spawner, data, group) {
  spawner.bossData = data;
  for (const { lane, hpScale } of group) {
    const x = spawner.laneCenters[lane];
    const enemy = spawnEnemy(spawner, ENEMY_TYPES.boss, x, data.spawnZ, Math.round(data.hp * hpScale), null);
    spawner.bosses.add(enemy);
    spawner.bus.emit(EVENTS.BOSS_SPAWNED, { enemy, data, lane });
  }
}

// Sciame di scorta del boss nella corsia lane, che cammina verso gli eroi a escort.walkSpeed: davanti al boss (front,
// la sua corsia) le sue file finiscono escort.gap prima di lui, nelle altre corsie il blocco è al suo fianco, alla sua
// stessa distanza. Se la sua prima fila fosse più vicina di escort.minZ non esce: arriverebbe all'esercito senza
// dare il tempo di reagire
function spawnEscort(spawner, lane, front, boss) {
  const { bossData } = spawner;
  const { count, gap, minZ, walkSpeed } = bossData.escort;
  const rowsDepth = (Math.ceil(count / SWARM.columnsPerLane) - 1) * SWARM.spacing;
  const z = front ? boss.z - boss.size / 2 - gap - ENEMY_TYPES.swarm.size / 2 - rowsDepth : boss.z - rowsDepth / 2;
  if (z < minZ) return;
  spawnSwarm(spawner, count, lane, 1, z, enemyHp(bossData.enemyHp, ENEMY_TYPES.swarm), walkSpeed);
}

// Tipo a caso con le quote dell'ondata
function pickType(rng, specials, scales) {
  let roll = rng.float();
  for (const [type, share] of typeShares(specials, scales)) {
    if (roll < share) return type;
    roll -= share;
  }
  return ENEMY_TYPES.grunt;
}

// Quote dei tipi in file e arrivi singoli, [[tipo, quota], …]: ogni tipo speciale ha la probabilità scritta in
// specials (per scales del tipo, se c'è), il resto va ai normali; se insieme passano 1 si stringono tutte nella stessa
// proporzione, e normali non ce ne sono
export function typeShares(specials, scales = {}) {
  const shares = Object.entries(specials).map(([name, chance]) => [ENEMY_TYPES[name], chance * (scales[name] ?? 1)]);
  const total = shares.reduce((sum, [, share]) => sum + share, 0);
  const fit = total > 1 ? 1 / total : 1;
  return [...shares.map(([type, share]) => [type, share * fit]), [ENEMY_TYPES.grunt, Math.max(0, 1 - total * fit)]];
}

// Unità/s con cui il nemico cammina da solo, oltre al campo, frenato dal suo freno: il freno c'è solo a campo fermo
// (updateSpawner lo azzera quando il campo corre)
export function ownSpeed(enemy) {
  return enemy.extraSpeed * (1 - enemy.brake);
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

// Il nemico spinto indietro di distance si ferma contro il più vicino dietro di lui nella sua corsia (anche il boss):
// arriva a toccarlo, senza lo spazio della coda, così anche chi ha qualcuno in coda sente il colpo
function retreat(enemies, runner, distance) {
  let limit = Infinity;
  for (const other of enemies) {
    if (other === runner || other.z <= runner.z) continue;
    if (Math.abs(other.x - runner.x) >= (other.size + runner.size) / 2) continue;
    limit = Math.min(limit, other.z - (other.size + runner.size) / 2);
  }
  runner.z = Math.min(Math.max(limit, runner.z), runner.z + distance);
}

// Vita di un nemico del tipo type, se quella dei nemici normali è baseHp
export function enemyHp(baseHp, type) {
  return Math.max(1, Math.round(baseHp * type.hpScale));
}

function spawnEnemy(spawner, type, x, z, hp, swarm) {
  const enemy = spawner.pool.acquire();
  enemy.type = type;
  enemy.x = x;
  enemy.z = z;
  enemy.size = type.size;
  enemy.hp = Math.max(1, Math.round(hp * spawner.hpScale));
  enemy.maxHp = enemy.hp;
  enemy.extraSpeed = type.extraSpeed;
  enemy.brake = 0;
  enemy.knock = 0;
  enemy.swarm = swarm;
  spawner.enemies.push(enemy);
  return enemy;
}
