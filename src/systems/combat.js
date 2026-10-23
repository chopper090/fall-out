import { ENEMIES, GATES, SHOTS } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame, periodMs, secondsToMs } from '../core/time.js';
import { WEAPONS } from '../data/units.js';

const DEG_TO_RAD = Math.PI / 180;

// Combattimento: eroi e soldati sparano da soli, ognuno con il suo ritmo e con l'arma del suo posto nella folla
// (data/units.js; ogni eroe ha la sua, data/heroes.js). Fucile e raffica sparano colpi che volano dritti
// (quelli della raffica aperti a ventaglio) e si fermano sul primo bersaglio che incontrano. Il lanciatore tira
// granate che volano sopra tutto e scoppiano in fondo alla sua gittata, colpendo tutti i nemici vicini.
// Eventi: ENEMY_HIT, GATE_HIT, BLAST per lo scoppio di una granata ({ x, z, radius })
export function createCombat(bus) {
  return {
    projectiles: [],
    grenades: [],
    blastVictims: [],
    pool: createPool(() => ({ x: 0, z: 0, vx: 0, vz: 0, damage: 0, share: 0, weapon: null }), SHOTS.poolSize),
    grenadePool: createPool(
      () => ({ x: 0, z: 0, fromZ: 0, elapsedMs: 0, flightMs: 0, damage: 0, weapon: null }),
      SHOTS.grenadePoolSize,
    ),
    bus,
  };
}

// targets = { enemies, gates }: ogni colpo dritto si ferma sul bersaglio con la faccia anteriore più vicina tra
// quelli che tocca; i cancelli fissi (senza numero) i colpi li attraversano. Il nemico perde il danno del colpo
// meno la sua armatura, il cancello si carica della sua parte. scrollSpeed: velocità del campo, con cui
// i bersagli vengono incontro ai colpi (i nemici veloci più in fretta, il boss piantato e i tiratori fermi
// per niente)
export function updateCombat(combat, army, targets, deltaMs, scrollSpeed) {
  moveShots(combat, targets, deltaMs, scrollSpeed);
  moveGrenades(combat, targets.enemies, deltaMs);

  // Oltre i soldati disegnati il colpo vale in proporzione di più, e i cancelli di potenziamento aggiungono
  // la loro parte (damageScale). Per i cancelli ogni colpo dritto porta share, una raffica lo divide tra i suoi
  // colpi: un secondo di fuoco di tutto l'esercito vale 1, qualunque sia la sua grandezza o le sue armi
  // (le granate non caricano i cancelli)
  const units = army.soldiers.length + 1;
  const reserves = (army.size / units) * army.damageScale;
  let chargingPerSecond = 0;
  for (const hero of army.heroes) chargingPerSecond += chargingRate(hero.weapon);
  for (const soldier of army.soldiers) chargingPerSecond += chargingRate(WEAPONS[soldier.weapon]);
  const share = chargingPerSecond > 0 ? 1 / chargingPerSecond : 0;
  for (const hero of army.heroes) {
    const { weapon } = hero;
    if (weapon.fireRate <= 0) continue;
    fireFrom(combat, hero, weapon, deltaMs / periodMs(weapon.fireRate), weapon.damage * reserves, share);
  }
  for (const soldier of army.soldiers) {
    const weapon = WEAPONS[soldier.weapon];
    if (weapon.fireRate <= 0) continue;
    fireFrom(combat, soldier, weapon, deltaMs / periodMs(weapon.fireRate), weapon.damage * reserves, share);
  }
}

// Colpi al secondo di un soldato con quest'arma che possono caricare i cancelli (una raffica conta uno)
function chargingRate(weapon) {
  return weapon.kind === 'lob' ? 0 : weapon.fireRate;
}

function moveShots(combat, targets, deltaMs, scrollSpeed) {
  const { projectiles, bus } = combat;
  for (let index = projectiles.length - 1; index >= 0; index--) {
    const shot = projectiles[index];
    const step = perFrame(shot.vz, deltaMs);
    shot.x += perFrame(shot.vx, deltaMs);
    shot.z += step;
    if (shot.z > shot.weapon.range) {
      removeShot(combat, index);
      continue;
    }
    // In questo frame colpo e bersaglio si sono avvicinati di closing: si controlla tutto quel tratto
    const gateClosing = step + perFrame(scrollSpeed, deltaMs);
    const enemy = firstEnemy(targets.enemies, shot, step, deltaMs, scrollSpeed);
    const gate = targets.gates.find(
      (candidate) => candidate.kind.charged && touches(shot, candidate, gateClosing, GATES.width, GATES.depth),
    );
    if (!enemy && !gate) continue;
    removeShot(combat, index);
    if (gate && (!enemy || gate.z - GATES.depth / 2 <= enemy.z - enemy.size / 2)) {
      bus.emit(EVENTS.GATE_HIT, { gate, share: shot.share });
    } else {
      bus.emit(EVENTS.ENEMY_HIT, { enemy, damage: afterArmor(shot.damage, enemy.type.armor) });
    }
  }
}

// La granata vola in linea retta da dov'è partita fino in fondo alla gittata; lì scoppia
function moveGrenades(combat, enemies, deltaMs) {
  const { grenades, grenadePool } = combat;
  for (let index = grenades.length - 1; index >= 0; index--) {
    const grenade = grenades[index];
    grenade.elapsedMs += deltaMs;
    const progress = Math.min(1, grenade.elapsedMs / grenade.flightMs);
    grenade.z = grenade.fromZ + (grenade.weapon.range - grenade.fromZ) * progress;
    if (progress < 1) continue;
    blast(combat, enemies, grenade);
    grenadePool.release(grenade);
    grenades[index] = grenades[grenades.length - 1];
    grenades.pop();
  }
}

// Tutti i nemici la cui base tocca il cerchio dello scoppio perdono il danno della granata meno la loro armatura.
// Prima si raccolgono, poi si colpiscono: chi muore lascia la lista dei nemici
function blast({ bus, blastVictims }, enemies, { x, z, damage, weapon }) {
  const { radius } = weapon;
  blastVictims.length = 0;
  for (const enemy of enemies) if (Math.hypot(enemy.x - x, enemy.z - z) < radius + enemy.size / 2) blastVictims.push(enemy);
  for (const enemy of blastVictims) bus.emit(EVENTS.ENEMY_HIT, { enemy, damage: afterArmor(damage, enemy.type.armor) });
  bus.emit(EVENTS.BLAST, { x, z, radius });
}

// La fase di chi spara scende di elapsed (frazione dell'intervallo di tiro): a zero parte un colpo,
// appena davanti a lui. Se la cadenza cambia, ognuno resta allo stesso punto del suo ritmo
function fireFrom(combat, shooter, weapon, elapsed, damage, share) {
  shooter.phase -= elapsed;
  while (shooter.phase <= 0) {
    const z = shooter.z + (shooter.size + weapon.size) / 2;
    if (weapon.kind === 'lob') throwGrenade(combat, shooter.x, z, weapon, damage);
    else if (weapon.kind === 'fan') fireFan(combat, shooter.x, z, weapon, damage, share);
    else addShot(combat, shooter.x, z, 0, weapon, damage, share);
    shooter.phase += 1;
  }
}

// I colpi della raffica si aprono a ventaglio, divisi in parti uguali tra -spreadDeg/2 e +spreadDeg/2,
// e si dividono la parte di carica della raffica
function fireFan(combat, x, z, weapon, damage, share) {
  const { pellets, spreadDeg } = weapon;
  for (let n = 0; n < pellets; n++) {
    const angle = pellets > 1 ? (n / (pellets - 1) - 0.5) * spreadDeg * DEG_TO_RAD : 0;
    addShot(combat, x, z, angle, weapon, damage, share / pellets);
  }
}

// Colpo dritto con angle radianti di apertura rispetto a davanti
function addShot({ projectiles, pool }, x, z, angle, weapon, damage, share) {
  const shot = pool.acquire();
  shot.x = x;
  shot.z = z;
  shot.vx = weapon.speed * Math.sin(angle);
  shot.vz = weapon.speed * Math.cos(angle);
  shot.damage = damage;
  shot.share = share;
  shot.weapon = weapon;
  projectiles.push(shot);
}

function throwGrenade({ grenades, grenadePool }, x, z, weapon, damage) {
  const grenade = grenadePool.acquire();
  grenade.x = x;
  grenade.z = z;
  grenade.fromZ = z;
  grenade.elapsedMs = 0;
  grenade.flightMs = secondsToMs(Math.max(0, weapon.range - z) / weapon.speed);
  grenade.damage = damage;
  grenade.weapon = weapon;
  grenades.push(grenade);
}

// Altezza della granata da terra: un arco che sale fino a arcHeight a metà volo e ridiscende
// (una granata nata già in fondo alla gittata è subito a terra)
export function grenadeHeight(grenade) {
  const progress = grenade.flightMs > 0 ? Math.min(1, grenade.elapsedMs / grenade.flightMs) : 1;
  return 4 * grenade.weapon.arcHeight * progress * (1 - progress);
}

// Tra i nemici toccati dal colpo, quello con la faccia anteriore più vicina
function firstEnemy(enemies, shot, step, deltaMs, scrollSpeed) {
  let first = null;
  for (const enemy of enemies) {
    const closing = step + perFrame(scrollSpeed + enemy.extraSpeed, deltaMs);
    if (!touches(shot, enemy, closing, enemy.size, enemy.size)) continue;
    if (first === null || enemy.z - enemy.size / 2 < first.z - first.size / 2) first = enemy;
  }
  return first;
}

// L'armatura toglie armor a ogni colpo, ma una parte del danno (minDamageShare) passa sempre
export function afterArmor(damage, armor) {
  return Math.max(damage * ENEMIES.minDamageShare, damage - armor);
}

// I colpi non hanno un ordine: quello tolto lascia il posto all'ultimo della lista
function removeShot({ projectiles, pool }, index) {
  pool.release(projectiles[index]);
  projectiles[index] = projectiles[projectiles.length - 1];
  projectiles.pop();
}

// Contatto se colpo e bersaglio (largo width, profondo depth) si sono sovrapposti in un punto qualsiasi
// del tratto: così anche a pochi FPS o con colpi molto veloci il colpo non attraversa il bersaglio
function touches(shot, target, closing, width, depth) {
  const { size } = shot.weapon;
  const reachZ = (size + depth) / 2;
  const gap = shot.z - target.z;
  return Math.abs(shot.x - target.x) < (size + width) / 2 && gap > -reachZ && gap - closing < reachZ;
}
