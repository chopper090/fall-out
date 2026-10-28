import { WEAPON_PATHS } from '../data/forge.js';

// La fucina: i livelli delle armi dei soldati (profile.weaponLevels, per arma da 0 al suo ultimo livello di
// data/forge.js WEAPON_PATHS) e quello che danno in battaglia

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
// range, pellets, radius, pierce, da 0) e gli effetti (armor e fuse, sì o no; gateHits, il più alto, da 1; aim,
// l'ultimo, null senza)
export function weaponPaths(levels) {
  const paths = {};
  for (const [weapon, level] of Object.entries(levels)) {
    if (level === 0) continue;
    const path = { damage: 0, fireRate: 0, range: 0, pellets: 0, radius: 0, pierce: 0 };
    Object.assign(path, { armor: false, fuse: false, gateHits: 1, aim: null });
    for (const step of WEAPON_PATHS[weapon].slice(0, level)) {
      for (const key of ['damage', 'fireRate', 'range', 'pellets', 'radius', 'pierce']) path[key] += step[key] ?? 0;
      path.armor ||= step.armor === true;
      path.fuse ||= step.fuse === true;
      path.gateHits = Math.max(path.gateHits, step.gateHits ?? 1);
      path.aim = step.aim ?? path.aim;
    }
    paths[weapon] = path;
  }
  return paths;
}
