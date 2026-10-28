import { WEAPONS } from './units.js';

// Categorie degli eroi: ognuna ha il suo ruolo, la sua vita (maxHp), un'arma sua e un'abilità automatica con ricarica,
// uguali per tutti gli eroi della categoria; cambia la forza, che viene dalla rarità (RARITIES). L'arma parte da una di
// quelle dei soldati (data/units.js) con numeri propri: i posti della folla più vicini all'eroe partono con la stessa
// arma. I numeri qui sono quelli di un eroe comune al livello 1 con una stella: livelli, stelle e rarità li alzano
// (data/growth.js, meta/heroes.js). La loro potenza si calcola dalle armi, dalle abilità e dalla vita
// (systems/power.js). Abilità (ability.kind, systems/powers.js): shockwave, onda d'urto che colpisce tutti i nemici
// entro radius dall'eroe, quando ce n'è almeno uno; pierce, colpo che perfora la colonna davanti all'eroe fino a range
// colpendo tutti, quando c'è qualcuno. Il loro danno è una quota (share) della vita di ogni nemico colpito, meno su
// élite e boss (HERO_POWERS in config/battle.js), che cresce con la forza dell'eroe; shield, scudo che ferma i colpi
// nemici per seconds, alzato reactSeconds prima che uno arrivi; rapidFire, fuoco rapido: per seconds chi spara entro
// radius da lui (lui, gli altri eroi e i soldati) spara fireRateScale volte più in fretta; parte quando un nemico è
// davanti a lui, a tiro della sua arma ed entro radius di lato. Ogni abilità si ricarica in cooldownSeconds. detail: il
// segno sulla pedina (collare, elmo, pennacchio, fascia, bocca da fuoco o corona, PAWNS in config/battle.js); colors:
// le facce della pedina
export const CATEGORIES = {
  command: {
    role: 'Comando',
    maxHp: 5,
    detail: 'collar',
    colors: { top: 0x7aa6ff, front: 0x3d7bff, side: 0x2a56b8 },
    weapon: { ...WEAPONS.rifle, fireRate: 3, damage: 3 },
    ability: { kind: 'shockwave', cooldownSeconds: 12, radius: 220, share: 0.24 },
  },
  assault: {
    role: 'Assalto',
    maxHp: 4,
    detail: 'band',
    colors: { top: 0x8fb4ff, front: 0x2f62d9, side: 0x1f3f94 },
    weapon: { ...WEAPONS.rifle, fireRate: 3, damage: 3 },
    ability: { kind: 'rapidFire', cooldownSeconds: 12, seconds: 3, fireRateScale: 2, radius: 160 },
  },
  defense: {
    role: 'Difesa',
    maxHp: 6,
    detail: 'helmet',
    colors: { top: 0xb8a9ff, front: 0x6a52e6, side: 0x3e2fa6 },
    weapon: { ...WEAPONS.launcher, fireRate: 0.5, damage: 8, radius: 110 },
    ability: { kind: 'shield', cooldownSeconds: 14, seconds: 2, reactSeconds: 0.8 },
  },
  shortRange: {
    role: 'Corto raggio',
    maxHp: 4,
    detail: 'muzzle',
    colors: { top: 0xa3c8ff, front: 0x4a86e8, side: 0x2c5aa8 },
    weapon: { ...WEAPONS.burst, fireRate: 1.6, damage: 1.6 },
    ability: { kind: 'shockwave', cooldownSeconds: 10, radius: 170, share: 0.18 },
  },
  longRange: {
    role: 'Lungo raggio',
    maxHp: 3,
    detail: 'plume',
    colors: { top: 0x9ad0ff, front: 0x2f8fe6, side: 0x1f5fa8 },
    weapon: { ...WEAPONS.rifle, fireRate: 1, damage: 3.3, speed: 2200, range: 1400 },
    ability: { kind: 'pierce', cooldownSeconds: 10, share: 0.3, range: 1600, width: 40 },
  },
  siege: {
    role: 'Assedio',
    maxHp: 5,
    detail: 'helmet',
    colors: { top: 0x9fb8ff, front: 0x3e63c9, side: 0x27408a },
    weapon: { ...WEAPONS.launcher, fireRate: 0.6, damage: 10, radius: 130 },
    ability: { kind: 'shockwave', cooldownSeconds: 14, radius: 260, share: 0.22 },
  },
  protection: {
    role: 'Protezione',
    maxHp: 7,
    detail: 'collar',
    colors: { top: 0xc4b8ff, front: 0x7b5cf0, side: 0x4a35b0 },
    weapon: { ...WEAPONS.launcher, fireRate: 0.6, damage: 9, radius: 120 },
    ability: { kind: 'shield', cooldownSeconds: 12, seconds: 3, reactSeconds: 0.8 },
  },
  precision: {
    role: 'Precisione',
    maxHp: 4,
    detail: 'plume',
    colors: { top: 0xe6f6ff, front: 0x8fd8ff, side: 0x4aa3d6 },
    weapon: { ...WEAPONS.rifle, fireRate: 1.4, damage: 4.5, speed: 2400, range: 1500 },
    ability: { kind: 'pierce', cooldownSeconds: 7, share: 1.4, range: 1800, width: 50 },
  },
  fury: {
    role: 'Furia',
    maxHp: 6,
    detail: 'crown',
    colors: { top: 0x8aa0ff, front: 0x3346d1, side: 0x202d8f },
    weapon: { ...WEAPONS.burst, fireRate: 2, damage: 2 },
    ability: { kind: 'rapidFire', cooldownSeconds: 12, seconds: 4, fireRateScale: 2.5, radius: 220 },
  },
};

// Gli eroi: nome, categoria e rarità, uno per ogni rarità di ogni categoria. leader: il capo, il personaggio del
// giocatore, sempre in campo; se muore lui la missione fallisce. Gli altri, morti, spariscono con la loro abilità per
// il resto del livello. starter: ce l'ha già chi comincia. I numeri (role, maxHp, detail, colors, weapon, ability) un
// eroe li legge dalla sua categoria: cambiandoli lì (pannello di sviluppo, simulatore) cambiano per tutti i suoi eroi
const ROSTER = {
  leader: { name: 'Capo', category: 'command', rarity: 'common', leader: true, starter: true },
  sergeant: { name: 'Sergente', category: 'command', rarity: 'uncommon' },
  captain: { name: 'Capitano', category: 'command', rarity: 'rare' },
  commander: { name: 'Comandante', category: 'command', rarity: 'epic' },
  general: { name: 'Generale', category: 'command', rarity: 'legendary' },
  warlord: { name: 'Condottiero', category: 'command', rarity: 'mythic' },

  rifleman: { name: 'Fuciliere', category: 'assault', rarity: 'common', starter: true },
  assaulter: { name: 'Assaltatore', category: 'assault', rarity: 'uncommon' },
  raider: { name: 'Incursore', category: 'assault', rarity: 'rare' },
  ram: { name: 'Ariete', category: 'assault', rarity: 'epic' },
  lightning: { name: 'Lampo', category: 'assault', rarity: 'legendary' },
  tempest: { name: 'Tempesta', category: 'assault', rarity: 'mythic' },

  defender: { name: 'Difensore', category: 'defense', rarity: 'common', starter: true },
  sentinel: { name: 'Sentinella', category: 'defense', rarity: 'uncommon' },
  bastion: { name: 'Bastione', category: 'defense', rarity: 'rare' },
  bulwark: { name: 'Baluardo', category: 'defense', rarity: 'epic' },
  rampart: { name: 'Muraglia', category: 'defense', rarity: 'legendary' },
  fortress: { name: 'Roccaforte', category: 'defense', rarity: 'mythic' },

  scout: { name: 'Esploratore', category: 'shortRange', rarity: 'common' },
  marauder: { name: 'Predone', category: 'shortRange', rarity: 'uncommon' },
  hound: { name: 'Segugio', category: 'shortRange', rarity: 'rare' },
  wolf: { name: 'Lupo', category: 'shortRange', rarity: 'epic' },
  viper: { name: 'Vipera', category: 'shortRange', rarity: 'legendary' },
  scorpion: { name: 'Scorpione', category: 'shortRange', rarity: 'mythic' },

  sniper: { name: 'Cecchino', category: 'longRange', rarity: 'common', starter: true },
  lookout: { name: 'Vedetta', category: 'longRange', rarity: 'uncommon' },
  falcon: { name: 'Falco', category: 'longRange', rarity: 'rare' },
  eagle: { name: 'Aquila', category: 'longRange', rarity: 'epic' },
  lynx: { name: 'Lince', category: 'longRange', rarity: 'legendary' },
  goshawk: { name: 'Astore', category: 'longRange', rarity: 'mythic' },

  sapper: { name: 'Artificiere', category: 'siege', rarity: 'common' },
  bombardier: { name: 'Bombardiere', category: 'siege', rarity: 'uncommon' },
  grenadier: { name: 'Granatiere', category: 'siege', rarity: 'rare' },
  mortar: { name: 'Mortaio', category: 'siege', rarity: 'epic' },
  catapult: { name: 'Catapulta', category: 'siege', rarity: 'legendary' },
  volcano: { name: 'Vulcano', category: 'siege', rarity: 'mythic' },

  squire: { name: 'Scudiero', category: 'protection', rarity: 'common' },
  keeper: { name: 'Custode', category: 'protection', rarity: 'uncommon' },
  guardian: { name: 'Guardiano', category: 'protection', rarity: 'rare' },
  paladin: { name: 'Paladino', category: 'protection', rarity: 'epic' },
  aegis: { name: 'Egida', category: 'protection', rarity: 'legendary' },
  aurora: { name: 'Aurora', category: 'protection', rarity: 'mythic' },

  shooter: { name: 'Tiratore', category: 'precision', rarity: 'common' },
  spotter: { name: 'Puntatore', category: 'precision', rarity: 'uncommon' },
  crossbowman: { name: 'Balestriere', category: 'precision', rarity: 'rare' },
  marksman: { name: 'Tiratore scelto', category: 'precision', rarity: 'epic' },
  deadeye: { name: 'Infallibile', category: 'precision', rarity: 'legendary' },
  arrow: { name: 'Saetta', category: 'precision', rarity: 'mythic' },

  brawler: { name: 'Attaccabrighe', category: 'fury', rarity: 'common' },
  rowdy: { name: 'Rissoso', category: 'fury', rarity: 'uncommon' },
  raging: { name: 'Furioso', category: 'fury', rarity: 'rare' },
  veteran: { name: 'Veterano', category: 'fury', rarity: 'epic' },
  cyclone: { name: 'Ciclone', category: 'fury', rarity: 'legendary' },
  phoenix: { name: 'Fenice', category: 'fury', rarity: 'mythic' },
};

export const HEROES = Object.fromEntries(Object.entries(ROSTER).map(([id, hero]) => [id, heroFrom(id, hero)]));

function heroFrom(id, hero) {
  const category = CATEGORIES[hero.category];
  const numbers = ['role', 'maxHp', 'detail', 'colors', 'weapon', 'ability'].map((key) => [
    key,
    { get: () => category[key], enumerable: true },
  ]);
  return Object.defineProperties({ id, leader: false, starter: false, ...hero }, Object.fromEntries(numbers));
}

// Rarità, dalla più comune alla più rara: il nome da mostrare, il suo colore nelle scritte (grigio, verde, blu, viola,
// oro, cangiante) e sulla base della pedina (rim: uno, o tre che sfumano da un lato all'altro), la parte di tiri del
// reclutamento che la danno (chance; 0: non esce dal reclutamento, si ottiene solo con i frammenti), i frammenti che dà
// un eroe già posseduto ripescato (duplicate) e quanto è più forte di un comune allo stesso livello (strength: vita e
// danno, suoi e dei soldati attorno, meta/heroes.js). Gli eroi di partenza sono comuni
export const RARITIES = {
  common: { label: 'Comune', color: '#c9d3e6', rim: [0x9aa6bd], chance: 0.55, duplicate: 5, strength: 1 },
  uncommon: { label: 'Non comune', color: '#8fe08a', rim: [0x5cc957], chance: 0.27, duplicate: 8, strength: 1.1 },
  rare: { label: 'Raro', color: '#7ec8ff', rim: [0x3fa4ff], chance: 0.12, duplicate: 10, strength: 1.2 },
  epic: { label: 'Epico', color: '#d59bff', rim: [0xb066ff], chance: 0.045, duplicate: 20, strength: 1.35 },
  legendary: { label: 'Leggendario', color: '#ffd166', rim: [0xffc23a], chance: 0.015, duplicate: 40, strength: 1.5 },
  mythic: {
    label: 'Mitico',
    color: '#a8fff0',
    rim: [0xff8ad8, 0x8afff0, 0xfff38a],
    chance: 0,
    duplicate: 80,
    strength: 1.7,
  },
};

// Schieramento di partenza: chi scende in campo e in quale posto (HERO.slots in config/battle.js: 0 e 1 davanti,
// 2-4 dietro). Il capo sta sempre nel posto 0
export const LINEUP = [
  { hero: 'leader', slot: 0 },
  { hero: 'rifleman', slot: 1 },
  { hero: 'sniper', slot: 3 },
  { hero: 'defender', slot: 4 },
];
