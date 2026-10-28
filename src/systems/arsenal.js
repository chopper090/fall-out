import { WEAPONS } from '../data/units.js';

// Le armi dei soldati in battaglia, con i miglioramenti della fucina (paths, per arma: meta/forge.js weaponPaths): per
// ogni arma di data/units.js WEAPONS la sua, con il danno e la cadenza in più, la gittata e i pallini in più e il
// raggio dello scoppio più largo; e quello che fanno i suoi colpi (systems/combat.js): pierce, quanti nemici passano
// prima di fermarsi; armor, se passano la corazza; gateHits, quante volte contano su porte e scrigni. Un'arma senza
// miglioramenti è quella di WEAPONS
export function createArsenal(paths = {}) {
  return Object.fromEntries(Object.entries(WEAPONS).map(([name, weapon]) => [name, upgraded(weapon, paths[name])]));
}

// L'arma migliorata legge i numeri di weapon ogni volta (getter sopra di lei): i ritocchi del pannello valgono anche
// in una battaglia già partita
function upgraded(weapon, path) {
  if (path === undefined) return weapon;
  const numbers = {
    damage: () => weapon.damage * (1 + path.damage),
    fireRate: () => weapon.fireRate * (1 + path.fireRate),
    range: () => weapon.range + path.range,
  };
  if (weapon.pellets !== undefined) numbers.pellets = () => weapon.pellets + path.pellets;
  if (weapon.radius !== undefined) numbers.radius = () => weapon.radius + path.radius;
  const getters = Object.fromEntries(Object.entries(numbers).map(([key, get]) => [key, { get, enumerable: true }]));
  const effects = { pierce: path.pierce, armor: path.armor, gateHits: path.gateHits };
  const values = Object.fromEntries(Object.entries(effects).map(([key, value]) => [key, { value, enumerable: true }]));
  return Object.create(weapon, { ...getters, ...values });
}
