import { minutesToMs } from '../core/time.js';
import { FORGE, WEAPON_PATHS } from '../data/forge.js';
import { BASE_SOLDIER, SOLDIER_TYPES } from '../data/units.js';
import { VILLAGE } from '../data/village.js';
import { trainableTypes } from './barracks.js';

// La fucina: i livelli delle armi dei soldati (profile.weaponLevels, per arma da 0 al suo ultimo livello di
// data/forge.js WEAPON_PATHS), quello che danno in battaglia e la coda che li fa salire (profile.forgeJob: il lavoro
// in corso, uno alla volta, con weapon, l'arma che sale di un livello; endsAt, quando finisce, in millisecondi di
// tempo vero; challenged, la sfida è già stata tentata; null senza lavori)

// Nessuna arma migliorata
export function createWeaponLevels() {
  return Object.fromEntries(Object.keys(WEAPON_PATHS).map((weapon) => [weapon, 0]));
}

// I livelli dai dati salvati: per ogni arma un intero da 0 al suo ultimo livello (0 se non torna)
export function weaponLevelsFrom(saved) {
  const levels = createWeaponLevels();
  for (const weapon of Object.keys(levels)) {
    const value = saved?.[weapon];
    const max = WEAPON_PATHS[weapon].length;
    levels[weapon] = Number.isInteger(value) && value > 0 ? Math.min(value, max) : 0;
  }
  return levels;
}

// Quello che i livelli levels danno alle armi, solo quelle migliorate: per arma i numeri sommati (damage, fireRate,
// range, pellets, radius, pierce, da 0) e gli effetti (armor e heavy, sì o no; gateHits, il più alto, da 1; fuse, il
// più alto, da 0; aim, l'ultimo, null senza)
export function weaponPaths(levels) {
  const paths = {};
  for (const [weapon, level] of Object.entries(levels)) {
    if (level === 0) continue;
    const path = { damage: 0, fireRate: 0, range: 0, pellets: 0, radius: 0, pierce: 0 };
    Object.assign(path, { armor: false, heavy: false, gateHits: 1, fuse: 0, aim: null });
    for (const step of WEAPON_PATHS[weapon].slice(0, level)) {
      for (const key of ['damage', 'fireRate', 'range', 'pellets', 'radius', 'pierce']) path[key] += step[key] ?? 0;
      path.armor ||= step.armor === true;
      path.heavy ||= step.heavy === true;
      path.gateHits = Math.max(path.gateHits, step.gateHits ?? 1);
      path.fuse = Math.max(path.fuse, step.fuse ?? 0);
      path.aim = step.aim ?? path.aim;
    }
    paths[weapon] = path;
  }
  return paths;
}

// Il lavoro dai dati salvati: un'arma della fucina non ancora al massimo (levels: i livelli già letti) e una fine che
// è un numero; null se non torna
export function forgeJobFrom(saved, levels) {
  const weapon = saved?.weapon;
  if (!Object.hasOwn(WEAPON_PATHS, weapon) || levels[weapon] >= WEAPON_PATHS[weapon].length) return null;
  if (!Number.isFinite(saved.endsAt)) return null;
  return { weapon, endsAt: saved.endsAt, challenged: saved.challenged === true };
}

// Costo e durata del prossimo livello dell'arma weapon: le scorte da pagare (resources, per tipo) e i minuti; null al
// livello massimo
export function forgeCost(profile, weapon) {
  const level = profile.weaponLevels[weapon];
  if (level >= WEAPON_PATHS[weapon].length) return null;
  return { resources: FORGE.costs[level], minutes: FORGE.minutes[level] };
}

// Cosa tiene fermo il prossimo livello dell'arma weapon, oltre alle scorte e alla coda: la fucina sotto quel livello
// ({ forge: il livello che serve }) o la caserma che non addestra ancora il suo tipo ({ barracks: il livello che
// serve; i fucilieri ci sono sempre }); null se niente, anche al livello massimo
export function forgeLock(profile, weapon) {
  const { levels } = profile.village;
  const next = profile.weaponLevels[weapon] + 1;
  if (next > WEAPON_PATHS[weapon].length) return null;
  if (levels.forge < next) return { forge: next };
  const trained = weapon === BASE_SOLDIER || trainableTypes(levels.barracks).includes(weapon);
  return trained ? null : { barracks: SOLDIER_TYPES[weapon].barracks };
}

// Si può portare l'arma weapon al livello dopo: nessun lavoro in corso, non al massimo, niente che la tiene ferma
// (forgeLock), scorte che bastano
export function canForge(profile, weapon) {
  const cost = forgeCost(profile, weapon);
  if (profile.forgeJob !== null || cost === null || forgeLock(profile, weapon) !== null) return false;
  return Object.entries(cost.resources).every(([kind, amount]) => profile.resources[kind] >= amount);
}

// Parte all'ora now il lavoro che porta l'arma weapon al livello dopo, pagando: finisce dopo i suoi minuti. Dice se è
// partito
export function startForge(profile, weapon, now) {
  if (!canForge(profile, weapon)) return false;
  const { resources, minutes } = forgeCost(profile, weapon);
  for (const [kind, amount] of Object.entries(resources)) profile.resources[kind] -= amount;
  profile.forgeJob = { weapon, endsAt: now + minutesToMs(minutes), challenged: false };
  return true;
}

// Millisecondi che mancano alla fine del lavoro in corso all'ora now, 0 senza
export function forgeTimeLeft(profile, now) {
  return profile.forgeJob === null ? 0 : Math.max(0, profile.forgeJob.endsAt - now);
}

// L'orologio del telefono tornato indietro lascia nel futuro la fine del lavoro: non dura mai più dei minuti del suo
// livello, e se la fine è più lontana riparte da adesso (come i cantieri, meta/village.js). Dice se l'ha rimessa a
// posto
export function clampForge(profile, now) {
  const job = profile.forgeJob;
  if (job === null) return false;
  const full = minutesToMs(forgeCost(profile, job.weapon).minutes);
  if (job.endsAt - now <= full) return false;
  job.endsAt = now + full;
  return true;
}

// Il lavoro finito entro l'ora now: la sua arma sale di un livello (mai oltre l'ultimo). Restituisce { weapon, level
// }, o null se non ce n'è uno finito
export function finishForge(profile, now) {
  const job = profile.forgeJob;
  if (job === null || now < job.endsAt) return null;
  const { weapon } = job;
  profile.weaponLevels[weapon] = Math.min(WEAPON_PATHS[weapon].length, profile.weaponLevels[weapon] + 1);
  profile.forgeJob = null;
  return { weapon, level: profile.weaponLevels[weapon] };
}

// Una gemma toglie VILLAGE.gemMinutes al lavoro in corso (se basta, finishForge lo finisce). Dice se è stata usata
export function rushForge(profile) {
  if (profile.forgeJob === null || profile.resources.gems < 1) return false;
  profile.resources.gems -= 1;
  profile.forgeJob.endsAt -= minutesToMs(VILLAGE.gemMinutes);
  return true;
}

// La sfida del lavoro in corso, come quella dei cantieri (meta/village.js canChallenge): una sola per lavoro e solo se
// all'ora now mancano almeno VILLAGE.challenge.minMinutes minuti; partendo la si spende
export function canChallengeForge(profile, now) {
  const job = profile.forgeJob;
  return job !== null && !job.challenged && forgeTimeLeft(profile, now) >= minutesToMs(VILLAGE.challenge.minMinutes);
}

// La sfida del lavoro in corso si spende. Dice se si poteva
export function startForgeChallenge(profile, now) {
  if (!canChallengeForge(profile, now)) return false;
  profile.forgeJob.challenged = true;
  return true;
}

// Sfida vinta: il lavoro in corso, se è quello sfidato, perde VILLAGE.challenge.timeShare del tempo che resta all'ora
// now. Restituisce i millisecondi tolti (0 se nel frattempo è finito, anche se intanto ne è partito un altro)
export function winForgeChallenge(profile, now) {
  if (profile.forgeJob?.challenged !== true) return 0;
  const saved = forgeTimeLeft(profile, now) * VILLAGE.challenge.timeShare;
  if (saved > 0) profile.forgeJob.endsAt -= saved;
  return saved;
}
