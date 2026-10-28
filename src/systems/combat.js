import { CHESTS, ENEMIES, GATES, SHOTS } from '../config/balance.js';
import { DEG_TO_RAD } from '../core/angles.js';
import { EVENTS } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { perFrame, periodMs, secondsToMs } from '../core/time.js';
import { damageMultiplier } from './army.js';
import { stopsShots } from './gates.js';
import { closingSpeed, markedDamage } from './spawn.js';

// Combattimento: eroi e soldati sparano da soli, ognuno con il suo ritmo e con l'arma del suo posto nella folla
// (data/units.js, con i miglioramenti della fucina: army.arsenal, systems/arsenal.js; le élite e ogni eroe hanno la
// loro, ELITE e data/heroes.js). Fucile e raffica sparano colpi che volano dritti (quelli della raffica aperti a
// ventaglio) e si fermano sul primo bersaglio che incontrano, salvo i colpi che passano i nemici (weapon.pierce, la
// fucina); con weapon.gateHits contano di più su porte e scrigni, con weapon.armor passano la corazza. Il lanciatore
// tira granate che volano sopra tutto e scoppiano in fondo alla sua gittata, colpendo tutti i nemici vicini; con la
// spoletta della fucina (weapon.fuse) scoppiano prima, sul primo cancello o scrigno che sorvolano, e ci contano
// weapon.fuse colpi.
// Gli scrigni aperti alzano la cadenza di tutti (army.fireRateScale); la fucina del villaggio (army.weapons) il danno
// e la cadenza dei soldati, e con autoAim il loro lanciatore mira da solo: la granata va dove sarà il nemico più
// vicino davanti a lui, entro la gittata (se non ce n'è, in fondo alla gittata). Durante il fuoco rapido o la furia di
// un eroe (RAPID_FIRE_STARTED) lui e chi gli sta entro ability.radius sparano ability.fireRateScale volte più in
// fretta, con ability.damageBonus di danno in più e, con ability.pierceArmor, colpi che passano la corazza; finisce
// dopo ms o quando l'eroe muore. Ogni eroe ha il suo (rapidFire: { hero, ms } per ognuno acceso); chi è nel raggio di
// più d'uno prende il più forte di ognuno (boostOf). Durante un'adunata (RALLY_STARTED, rallies) tutti fanno
// damageBonus di danno in più e sparano fireRateBonus più in fretta: con più adunate insieme, la più forte. I soldati
// sparano con la crescita dell'eroe del loro posto (slot.growth, systems/army.js).
// Eventi: ENEMY_HIT (con hero, l'eroe del colpo, null per i soldati, e il danno che il nemico prende davvero, con il
// marchio), CHEST_HIT, GATE_HIT, BLAST per lo scoppio di una granata ({ x, z, radius })
export function createCombat(bus) {
  const combat = {
    projectiles: [],
    grenades: [],
    blastVictims: [],
    pool: createPool(
      () => ({
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        damage: 0,
        weapon: null,
        hero: null,
        pierceArmor: false,
        passes: 0,
        passed: null,
      }),
      SHOTS.poolSize,
    ),
    grenadePool: createPool(
      () => ({
        x: 0,
        z: 0,
        fromX: 0,
        fromZ: 0,
        toX: 0,
        toZ: 0,
        elapsedMs: 0,
        flightMs: 0,
        damage: 0,
        weapon: null,
        hero: null,
        pierceArmor: false,
      }),
      SHOTS.grenadePoolSize,
    ),
    rapidFire: [],
    rallies: [],
    // Quello che i fuochi rapidi danno a chi spara adesso (boostOf): uno solo, riusato
    boost: { rate: 1, damage: 1, pierceArmor: false },
    // Per la mira dei lanciatori: i nemici e la velocità del campo di questo frame, e il punto mirato
    enemies: [],
    scrollSpeed: 0,
    aim: { x: 0, z: 0 },
    bus,
  };
  bus.on(EVENTS.RAPID_FIRE_STARTED, ({ hero, ms }) => {
    const running = combat.rapidFire.find((entry) => entry.hero === hero);
    if (running) running.ms = ms;
    else combat.rapidFire.push({ hero, ms });
  });
  bus.on(EVENTS.RALLY_STARTED, (rally) => combat.rallies.push({ ...rally }));
  bus.on(EVENTS.HERO_KILLED, (hero) => {
    const index = combat.rapidFire.findIndex((entry) => entry.hero === hero);
    if (index >= 0) combat.rapidFire.splice(index, 1);
  });
  return combat;
}

// targets = { enemies, chests, gates }: ogni colpo dritto si ferma sul bersaglio con la faccia anteriore più vicina tra
// quelli che tocca, salvo quello che passa i nemici (shot.passes, dalla fucina: va avanti e non ricolpisce quello
// passato); i cancelli al loro massimo (e quelli già mancati) i colpi li attraversano. Il nemico perde il danno del
// colpo meno la sua armatura (di più se è marchiato), lo scrigno scende (CHEST_HIT) e il cancello sale (GATE_HIT) di
// weapon.gateHits (uno senza la fucina; lo scrigno aperto non ne prende altri). scrollSpeed: velocità del campo, con
// cui i bersagli vengono incontro ai colpi (i nemici veloci più in fretta, il boss piantato e i tiratori fermi per
// niente)
export function updateCombat(combat, army, targets, deltaMs, scrollSpeed) {
  moveShots(combat, targets, deltaMs, scrollSpeed);
  moveGrenades(combat, targets, deltaMs, scrollSpeed);

  // Le riserve e gli scrigni alzano il danno di tutti i colpi (damageMultiplier, systems/army.js). Sugli scrigni ogni
  // colpo dritto conta weapon.gateHits (uno senza la fucina), anche ogni colpo della raffica (le granate ci volano
  // sopra)
  for (const list of [combat.rapidFire, combat.rallies]) age(list, deltaMs);
  const rally = strongestRally(combat.rallies);
  const damageScale = damageMultiplier(army) * (1 + rally.damageBonus);
  const rallyRate = 1 + rally.fireRateBonus;
  combat.enemies = targets.enemies;
  combat.scrollSpeed = scrollSpeed;
  for (const hero of army.heroes) shoot(combat, army, hero, hero.weapon, deltaMs, damageScale, hero, rallyRate);
  const { weapons } = army;
  const soldierDamage = damageScale * (1 + weapons.damage);
  for (const soldier of army.soldiers) {
    const rate = (1 + weapons.fireRate) * rallyRate;
    shoot(
      combat,
      army,
      soldier,
      army.arsenal[soldier.weapon],
      deltaMs,
      soldierDamage * soldier.slot.growth,
      null,
      rate,
    );
  }
}

// Le voci ancora accese di list (fuochi rapidi, adunate) perdono deltaMs; quelle finite escono
function age(list, deltaMs) {
  for (let index = list.length - 1; index >= 0; index--) {
    list[index].ms -= deltaMs;
    if (list[index].ms <= 0) list.splice(index, 1);
  }
}

// L'adunata più forte in corso: il danno e la cadenza in più più alti (zero senza adunate)
function strongestRally(rallies) {
  let damageBonus = 0;
  let fireRateBonus = 0;
  for (const rally of rallies) {
    damageBonus = Math.max(damageBonus, rally.damageBonus);
    fireRateBonus = Math.max(fireRateBonus, rally.fireRateBonus);
  }
  return { damageBonus, fireRateBonus };
}

// hero: l'eroe che spara, null per i soldati; i suoi colpi lo portano con sé fino al nemico che colpiscono.
// rateScale: la cadenza in più di chi spara (la fucina per i soldati)
function shoot(combat, army, shooter, weapon, deltaMs, damageScale, hero, rateScale) {
  if (weapon.fireRate <= 0) return;
  const boost = boostOf(combat, shooter);
  const rate = weapon.fireRate * rateScale * army.fireRateScale * boost.rate;
  const aim = hero === null && army.weapons.autoAim;
  const damage = weapon.damage * damageScale * boost.damage;
  const pierceArmor = boost.pierceArmor || weapon.armor === true;
  fireFrom(combat, shooter, weapon, deltaMs / periodMs(rate), damage, hero, aim, pierceArmor);
}

// Quello che i fuochi rapidi in corso danno a chi spara entro il loro raggio: la cadenza (rate, volte) e il danno
// (damage, volte) più alti, e se i colpi passano la corazza; 1, 1 e no se nessuno lo raggiunge
function boostOf({ rapidFire, boost }, shooter) {
  boost.rate = 1;
  boost.damage = 1;
  boost.pierceArmor = false;
  for (const { hero } of rapidFire) {
    const { radius, fireRateScale, damageBonus = 0, pierceArmor = false } = hero.ability;
    if (Math.hypot(shooter.x - hero.x, shooter.z - hero.z) > radius) continue;
    boost.rate = Math.max(boost.rate, fireRateScale);
    boost.damage = Math.max(boost.damage, 1 + damageBonus);
    boost.pierceArmor ||= pierceArmor;
  }
  return boost;
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
    const gate = firstGate(targets.gates, shot, closing);
    // A pari distanza il cancello, poi lo scrigno, poi il nemico
    const gateFace = gate ? gate.z - GATES.depth / 2 : Infinity;
    const chestFace = chest ? chest.z - CHESTS.depth / 2 : Infinity;
    const enemyFace = enemy ? enemy.z - enemy.size / 2 : Infinity;
    const nearest = Math.min(gateFace, chestFace, enemyFace);
    if (nearest === Infinity) continue;
    // Un colpo che passa i nemici (shot.passes) va avanti dopo averne colpito uno, e quello non lo colpisce di nuovo
    const passes = enemyFace === nearest && gateFace !== nearest && chestFace !== nearest && shot.passes > 0;
    const hits = shot.weapon.gateHits ?? 1;
    if (gateFace === nearest) strike(bus, gate, null, hits);
    else if (chestFace === nearest) strike(bus, null, chest, hits);
    else {
      const damage = markedDamage(enemy, afterArmor(shot.damage, shot.pierceArmor ? 0 : enemy.type.armor));
      bus.emit(EVENTS.ENEMY_HIT, { enemy, damage, hero: shot.hero });
    }
    // Un nemico morto lascia la lista: non serve ricordarlo, e il suo oggetto può tornare con un nemico nuovo
    if (passes) {
      shot.passes -= 1;
      shot.passed = enemy.hp > 0 ? enemy : null;
    } else removeShot(combat, index);
  }
}

// hits colpi sul cancello gate o, se è null, sullo scrigno chest (lo scrigno aperto non ne prende altri)
function strike(bus, gate, chest, hits) {
  if (gate !== null) for (let n = 0; n < hits; n++) bus.emit(EVENTS.GATE_HIT, { gate });
  else for (let n = 0; n < hits && chest.hits > 0; n++) bus.emit(EVENTS.CHEST_HIT, { chest });
}

// La granata vola in linea retta da dov'è partita fino al punto mirato (toX, toZ); lì scoppia, o prima con la
// spoletta (fused)
function moveGrenades(combat, targets, deltaMs, scrollSpeed) {
  const { grenades, grenadePool } = combat;
  for (let index = grenades.length - 1; index >= 0; index--) {
    const grenade = grenades[index];
    grenade.elapsedMs += deltaMs;
    const progress = Math.min(1, grenade.elapsedMs / grenade.flightMs);
    const fromZ = grenade.z;
    grenade.x = grenade.fromX + (grenade.toX - grenade.fromX) * progress;
    grenade.z = grenade.fromZ + (grenade.toZ - grenade.fromZ) * progress;
    const closing = grenade.z - fromZ + perFrame(scrollSpeed, deltaMs);
    if (!fused(combat, targets, grenade, closing) && progress < 1) continue;
    blast(combat, targets.enemies, grenade);
    grenadePool.release(grenade);
    grenades[index] = grenades[grenades.length - 1];
    grenades.pop();
  }
}

// La granata con la spoletta (weapon.fuse colpi) scoppia sul primo cancello che ferma ancora i colpi che sorvola, se
// no sul primo scrigno, e ci conta i suoi colpi; closing: quanto si sono avvicinati in questo frame
function fused({ bus }, targets, grenade, closing) {
  const hits = grenade.weapon.fuse ?? 0;
  if (hits === 0) return false;
  const gate = firstGate(targets.gates, grenade, closing);
  const chest = gate === null ? firstChest(targets.chests, grenade, closing) : null;
  if (gate === null && chest === null) return false;
  strike(bus, gate, chest, hits);
  return true;
}

// Tutti i nemici la cui base tocca il cerchio dello scoppio perdono il danno della granata meno la loro armatura (di
// più i marchiati).
// Prima si raccolgono, poi si colpiscono: chi muore lascia la lista dei nemici
function blast({ bus, blastVictims }, enemies, { x, z, damage, weapon, hero, pierceArmor }) {
  const { radius } = weapon;
  blastVictims.length = 0;
  for (const enemy of enemies) {
    if (Math.hypot(enemy.x - x, enemy.z - z) < radius + enemy.size / 2) blastVictims.push(enemy);
  }
  for (const enemy of blastVictims) {
    const hit = markedDamage(enemy, afterArmor(damage, pierceArmor ? 0 : enemy.type.armor));
    bus.emit(EVENTS.ENEMY_HIT, { enemy, damage: hit, hero });
  }
  bus.emit(EVENTS.BLAST, { x, z, radius });
}

// La fase di chi spara scende di elapsed (frazione dell'intervallo di tiro): a zero parte un colpo,
// appena davanti a lui. Se la cadenza cambia, ognuno resta allo stesso punto del suo ritmo. aim: il lanciatore mira;
// pierceArmor: i colpi passano la corazza
function fireFrom(combat, shooter, weapon, elapsed, damage, hero, aim, pierceArmor) {
  shooter.phase -= elapsed;
  while (shooter.phase <= 0) {
    const z = shooter.z + (shooter.size + weapon.size) / 2;
    if (weapon.kind === 'lob') throwGrenade(combat, shooter.x, z, weapon, damage, hero, aim, pierceArmor);
    else if (weapon.kind === 'fan') fireFan(combat, shooter.x, z, weapon, damage, hero, pierceArmor);
    else addShot(combat, shooter.x, z, 0, weapon, damage, hero, pierceArmor);
    shooter.phase += 1;
  }
}

// I colpi della raffica si aprono a ventaglio, divisi in parti uguali tra -spreadDeg/2 e +spreadDeg/2
function fireFan(combat, x, z, weapon, damage, hero, pierceArmor) {
  const { pellets, spreadDeg } = weapon;
  for (let n = 0; n < pellets; n++) {
    const angle = pellets > 1 ? (n / (pellets - 1) - 0.5) * spreadDeg * DEG_TO_RAD : 0;
    addShot(combat, x, z, angle, weapon, damage, hero, pierceArmor);
  }
}

// Colpo dritto con angle radianti di apertura rispetto a davanti
function addShot({ projectiles, pool }, x, z, angle, weapon, damage, hero, pierceArmor) {
  const shot = pool.acquire();
  shot.x = x;
  shot.z = z;
  shot.vx = weapon.speed * Math.sin(angle);
  shot.vz = weapon.speed * Math.cos(angle);
  shot.damage = damage;
  shot.weapon = weapon;
  shot.hero = hero;
  shot.pierceArmor = pierceArmor;
  shot.passes = weapon.pierce ?? 0;
  shot.passed = null;
  projectiles.push(shot);
}

function throwGrenade(combat, x, z, weapon, damage, hero, aim, pierceArmor) {
  const { grenades, grenadePool } = combat;
  const target = aim ? aimAt(combat, x, z, weapon) : null;
  const grenade = grenadePool.acquire();
  grenade.x = x;
  grenade.z = z;
  grenade.fromX = x;
  grenade.fromZ = z;
  grenade.toX = target === null ? x : target.x;
  grenade.toZ = target === null ? weapon.range : target.z;
  grenade.elapsedMs = 0;
  grenade.flightMs = secondsToMs(Math.hypot(grenade.toX - x, Math.max(0, grenade.toZ - z)) / weapon.speed);
  grenade.damage = damage;
  grenade.weapon = weapon;
  grenade.hero = hero;
  grenade.pierceArmor = pierceArmor;
  grenades.push(grenade);
}

// Dove mirare con il lanciatore da (x, z): il nemico più vicino davanti, entro la gittata, avanzato di quanto viene
// incontro mentre la granata vola (con il campo e con il suo passo). null se non c'è nessuno
function aimAt(combat, x, z, weapon) {
  let target = null;
  let nearest = Infinity;
  for (const enemy of combat.enemies) {
    if (enemy.z <= z || enemy.z > weapon.range) continue;
    const distance = Math.hypot(enemy.x - x, enemy.z - z);
    if (distance < nearest) {
      nearest = distance;
      target = enemy;
    }
  }
  if (target === null) return null;
  const closing = closingSpeed(target, combat.scrollSpeed);
  combat.aim.x = target.x;
  combat.aim.z = Math.max(z, target.z - (closing * nearest) / (weapon.speed + closing));
  return combat.aim;
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
    if (enemy === shot.passed) continue;
    const closing = step + perFrame(closingSpeed(enemy, scrollSpeed), deltaMs);
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

// Il primo cancello che ferma ancora i colpi toccato dal colpo: anche i cancelli non si sovrappongono
function firstGate(gates, shot, closing) {
  for (const gate of gates) if (stopsShots(gate) && touches(shot, gate, closing, GATES.width, GATES.depth)) return gate;
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
// del tratto: così anche a pochi FPS o con colpi molto veloci il colpo non attraversa il bersaglio. Vale anche per la
// granata, che lo sorvola
function touches(shot, target, closing, width, depth) {
  const { size } = shot.weapon;
  const reachZ = (size + depth) / 2;
  const gap = shot.z - target.z;
  return Math.abs(shot.x - target.x) < (size + width) / 2 && gap > -reachZ && gap - closing < reachZ;
}
