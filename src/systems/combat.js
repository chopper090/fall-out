import { CHESTS, ENEMIES, SHOTS } from '../config/balance.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame, periodMs, secondsToMs } from '../core/time.js';
import { WEAPONS } from '../data/units.js';
import { ownSpeed } from './spawn.js';

const DEG_TO_RAD = Math.PI / 180;

// Combattimento: eroi e soldati sparano da soli, ognuno con il suo ritmo e con l'arma del suo posto nella folla
// (data/units.js; le élite e ogni eroe hanno la loro, ELITE e data/heroes.js). Fucile e raffica sparano colpi che
// volano dritti (quelli della raffica aperti a ventaglio) e si fermano sul primo bersaglio che incontrano. Il
// lanciatore tira
// granate che volano sopra tutto e scoppiano in fondo alla sua gittata, colpendo tutti i nemici vicini.
// Gli scrigni aperti alzano la cadenza di tutti (army.fireRateScale). Durante il fuoco rapido di un eroe
// (RAPID_FIRE_STARTED) lui e chi gli sta entro ability.radius sparano ability.fireRateScale volte più in fretta;
// finisce dopo ms o quando l'eroe muore.
// Eventi: ENEMY_HIT, CHEST_HIT, BLAST per lo scoppio di una granata ({ x, z, radius })
export function createCombat(bus) {
  const combat = {
    projectiles: [],
    grenades: [],
    blastVictims: [],
    pool: createPool(() => ({ x: 0, z: 0, vx: 0, vz: 0, damage: 0, weapon: null }), SHOTS.poolSize),
    grenadePool: createPool(
      () => ({ x: 0, z: 0, fromZ: 0, elapsedMs: 0, flightMs: 0, damage: 0, weapon: null }),
      SHOTS.grenadePoolSize,
    ),
    rapidFire: { hero: null, ms: 0 },
    bus,
  };
  bus.on(EVENTS.RAPID_FIRE_STARTED, ({ hero, ms }) => {
    combat.rapidFire.hero = hero;
    combat.rapidFire.ms = ms;
  });
  bus.on(EVENTS.HERO_KILLED, (hero) => {
    if (combat.rapidFire.hero === hero) combat.rapidFire.ms = 0;
  });
  return combat;
}

// targets = { enemies, chests }: ogni colpo dritto si ferma sul bersaglio con la faccia anteriore più vicina tra
// quelli che tocca; i cancelli i colpi li attraversano. Il nemico perde il danno del colpo meno la sua armatura, lo
// scrigno scende di uno (CHEST_HIT). scrollSpeed: velocità del campo, con cui i bersagli vengono incontro ai colpi
// (i nemici veloci più in fretta, il boss piantato e i tiratori fermi per niente)
export function updateCombat(combat, army, targets, deltaMs, scrollSpeed) {
  moveShots(combat, targets, deltaMs, scrollSpeed);
  moveGrenades(combat, targets.enemies, deltaMs);

  // Le riserve (reserveBonus) e gli scrigni (damageScale) alzano il danno di tutti i colpi. Sugli scrigni ogni colpo
  // dritto conta uno, anche ogni colpo della raffica (le granate ci volano sopra)
  const damageScale = army.damageScale * (1 + army.reserveBonus);
  combat.rapidFire.ms = Math.max(0, combat.rapidFire.ms - deltaMs);
  for (const hero of army.heroes) shoot(combat, army, hero, hero.weapon, deltaMs, damageScale);
  for (const soldier of army.soldiers) shoot(combat, army, soldier, WEAPONS[soldier.weapon], deltaMs, damageScale);
}

function shoot(combat, army, shooter, weapon, deltaMs, damageScale) {
  if (weapon.fireRate <= 0) return;
  const rate = weapon.fireRate * army.fireRateScale * fireScale(combat.rapidFire, shooter);
  fireFrom(combat, shooter, weapon, deltaMs / periodMs(rate), weapon.damage * damageScale);
}

// Quante volte più in fretta spara chi è entro il raggio del fuoco rapido in corso (1 se non c'è)
function fireScale({ hero, ms }, shooter) {
  if (ms <= 0) return 1;
  const { radius, fireRateScale } = hero.ability;
  return Math.hypot(shooter.x - hero.x, shooter.z - hero.z) <= radius ? fireRateScale : 1;
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
    const closing = step + perFrame(scrollSpeed, deltaMs);
    const enemy = firstEnemy(targets.enemies, shot, step, deltaMs, scrollSpeed);
    const chest = firstChest(targets.chests, shot, closing);
    // A pari distanza lo scrigno prima del nemico
    const chestFace = chest ? chest.z - CHESTS.depth / 2 : Infinity;
    const enemyFace = enemy ? enemy.z - enemy.size / 2 : Infinity;
    if (chestFace === Infinity && enemyFace === Infinity) continue;
    removeShot(combat, index);
    if (chestFace <= enemyFace) bus.emit(EVENTS.CHEST_HIT, { chest });
    else bus.emit(EVENTS.ENEMY_HIT, { enemy, damage: afterArmor(shot.damage, enemy.type.armor) });
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
function fireFrom(combat, shooter, weapon, elapsed, damage) {
  shooter.phase -= elapsed;
  while (shooter.phase <= 0) {
    const z = shooter.z + (shooter.size + weapon.size) / 2;
    if (weapon.kind === 'lob') throwGrenade(combat, shooter.x, z, weapon, damage);
    else if (weapon.kind === 'fan') fireFan(combat, shooter.x, z, weapon, damage);
    else addShot(combat, shooter.x, z, 0, weapon, damage);
    shooter.phase += 1;
  }
}

// I colpi della raffica si aprono a ventaglio, divisi in parti uguali tra -spreadDeg/2 e +spreadDeg/2
function fireFan(combat, x, z, weapon, damage) {
  const { pellets, spreadDeg } = weapon;
  for (let n = 0; n < pellets; n++) {
    const angle = pellets > 1 ? (n / (pellets - 1) - 0.5) * spreadDeg * DEG_TO_RAD : 0;
    addShot(combat, x, z, angle, weapon, damage);
  }
}

// Colpo dritto con angle radianti di apertura rispetto a davanti
function addShot({ projectiles, pool }, x, z, angle, weapon, damage) {
  const shot = pool.acquire();
  shot.x = x;
  shot.z = z;
  shot.vx = weapon.speed * Math.sin(angle);
  shot.vz = weapon.speed * Math.cos(angle);
  shot.damage = damage;
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
    const closing = step + perFrame(scrollSpeed + ownSpeed(enemy, scrollSpeed), deltaMs);
    if (!touches(shot, enemy, closing, enemy.size, enemy.size)) continue;
    if (first === null || enemy.z - enemy.size / 2 < first.z - first.size / 2) first = enemy;
  }
  return first;
}

// Il primo scrigno toccato dal colpo: gli scrigni non si sovrappongono, ne basta uno
function firstChest(chests, shot, closing) {
  for (const chest of chests) if (touches(shot, chest, closing, CHESTS.width, CHESTS.depth)) return chest;
  return null;
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
