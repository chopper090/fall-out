import { WEAPONS } from '../data/units.js';

// Le armi dei soldati in battaglia, con i miglioramenti della fucina (paths, per arma: meta/forge.js weaponPaths): per
// ogni arma di data/units.js WEAPONS la sua, con il danno e la cadenza in più, la gittata e i pallini in più e il
// raggio dello scoppio più largo; un'arma senza miglioramenti è quella di WEAPONS
export function createArsenal(paths = {}) {
  return Object.fromEntries(Object.entries(WEAPONS).map(([name, weapon]) => [name, upgraded(weapon, paths[name])]));
}

function upgraded(weapon, path) {
  if (path === undefined) return weapon;
  const better = {
    ...weapon,
    damage: weapon.damage * (1 + path.damage),
    fireRate: weapon.fireRate * (1 + path.fireRate),
    range: weapon.range + path.range,
  };
  if (weapon.pellets !== undefined) better.pellets = weapon.pellets + path.pellets;
  if (weapon.radius !== undefined) better.radius = weapon.radius + path.radius;
  return better;
}
