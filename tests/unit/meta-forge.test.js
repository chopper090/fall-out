import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  ENEMY_TYPES,
  EVENTS,
  STARTING_LOADOUT,
  newBattle,
  placeChest,
  placeEnemy,
  placeGate,
  run,
  same,
  stepBattle,
  weaponArena,
} from '../support/suite.js';
import { setWeaponLevel } from '../../src/debug/cheats.js';
import { WEAPON_PATHS } from '../../src/data/forge.js';
import { WEAPONS } from '../../src/data/units.js';
import { weaponLevelsFrom, weaponPaths } from '../../src/meta/forge.js';
import { loadoutFrom } from '../../src/meta/loadout.js';
import { createProfile, profileFrom, storedProfile } from '../../src/meta/profile.js';
import { createArsenal } from '../../src/systems/arsenal.js';

// 206. Percorsi delle armi (C24): ogni arma dei soldati ha cinque livelli nella fucina (data/forge.js), e il livello n
// somma i suoi miglioramenti a quelli prima; le armi senza livelli non cambiano. In battaglia i soldati sparano con
// le armi migliorate (systems/arsenal.js): danno, cadenza, gittata, pallini e raggio. Dal salvataggio i livelli sono
// interi dentro il percorso e tornano uguali dopo un giro (storedProfile e profileFrom); il trucco del pannello li
// tiene dentro il percorso
test('206. Percorsi delle armi: cinque livelli per arma, sommati, e in battaglia le armi migliorate', (t) => {
  const check = checker(t);
  const lengths = Object.values(WEAPON_PATHS).map((path) => path.length);
  const paths = weaponPaths({ rifle: 2, burst: 4, launcher: 0 });
  const arsenal = createArsenal(paths);
  const { rifle, burst } = arsenal;
  const blast = createArsenal(weaponPaths({ launcher: 1 })).launcher.radius - WEAPONS.launcher.radius;
  const numbers = {
    rifle: [rifle.damage / WEAPONS.rifle.damage, rifle.range - WEAPONS.rifle.range],
    burst: [burst.damage / WEAPONS.burst.damage, burst.fireRate / WEAPONS.burst.fireRate, burst.pellets],
  };
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const untouched = arsenal.launcher === WEAPONS.launcher && arsenal.elite === WEAPONS.elite;
  const saved = weaponLevelsFrom({ rifle: 9, burst: -1, launcher: 2.5, ghost: 3 });
  const profile = createProfile();
  profile.weaponLevels.rifle = 2;
  profile.weaponLevels.burst = 4;
  const reloaded = profileFrom(JSON.parse(JSON.stringify(storedProfile(profile)))).weaponLevels;
  profile.weaponLevels.burst = 0;
  const loadout = loadoutFrom(profile);
  const battle = newBattle(3, undefined, {
    ...STARTING_LOADOUT,
    soldiers: 20,
    army: { rifle: 1 },
    weapons: loadout.weapons,
  });
  for (
    let frame = 0;
    frame < 600 && !battle.combat.projectiles.some((p) => p.weapon === battle.army.arsenal.rifle);
    frame++
  ) {
    stepBattle(battle, 1000 / 60);
  }
  const shot = battle.combat.projectiles.find((p) => p.weapon === battle.army.arsenal.rifle);
  setWeaponLevel(profile, 'burst', 12);
  setWeaponLevel(profile, 'launcher', -3);
  check(
    `livelli ${lengths.join('/')}; fucile al 2 danno ×${numbers.rifle[0].toFixed(2)} gittata +${numbers.rifle[1]}; raffica al 4 danno ×${numbers.burst[0].toFixed(2)} cadenza ×${numbers.burst[1].toFixed(2)} pallini ${numbers.burst[2]}; lanciatore al 1 raggio +${blast}; lanciatore ed élite com'erano ${untouched}; percorsi senza livelli ${Object.keys(paths).join(',')}; dal salvataggio ${JSON.stringify(saved)}, dopo un giro ${JSON.stringify(reloaded)}; in battaglia un colpo di fucile con gittata ${shot?.weapon.range}; trucco ${JSON.stringify(profile.weaponLevels)}`,
    lengths.every((length) => length === 5) &&
      near(numbers.rifle[0], 1.15) &&
      numbers.rifle[1] === 200 &&
      near(numbers.burst[0], 1.55) &&
      near(numbers.burst[1], 1.2) &&
      numbers.burst[2] === WEAPONS.burst.pellets + 1 &&
      blast === WEAPON_PATHS.launcher[0].radius &&
      untouched &&
      !('launcher' in paths) &&
      same(saved, { rifle: 5, burst: 0, launcher: 0 }) &&
      same(reloaded, { rifle: 2, burst: 4, launcher: 0 }) &&
      shot?.weapon.range === WEAPONS.rifle.range + 200 &&
      same(profile.weaponLevels, { rifle: 2, burst: 5, launcher: 0 }),
  );
  check.done();
});

// 207. Il fucile della fucina (C25), con colpi veri di un soldato: al livello 3 il colpo passa un nemico e colpisce
// anche quello dietro (uno solo, e non due volte lo stesso), al 4 passa la corazza (il corazzato prende tutto il
// danno), al 5 conta due volte su porte e scrigni, ma uno scrigno a cui manca un colpo si apre una volta sola e gli
// altri restano; il fucile di sempre si ferma sul primo nemico, la corazza gli toglie una parte e conta una volta
test('207. Il fucile della fucina: colpo che passa, corazza, porte e scrigni contati due volte', (t) => {
  const check = checker(t);
  // Un colpo vero di un fucile (con i miglioramenti paths), portato davanti all'esercito, e quello che colpisce in un
  // secondo. Gli eroi non sparano e non usano i poteri, gli altri soldati aspettano
  const fire = (paths, place) => {
    const weapons = { ...STARTING_LOADOUT.weapons, paths };
    const b = weaponArena({ size: 1, loadout: { ...STARTING_LOADOUT, soldiers: 6, army: { rifle: 1 }, weapons } });
    for (const hero of b.army.heroes) {
      hero.weapon = { ...hero.weapon, fireRate: 0 };
      b.heroesState.cooldowns.set(hero, Infinity);
    }
    b.combat.projectiles.length = 0;
    b.combat.grenades.length = 0;
    for (const soldier of b.army.soldiers) soldier.phase = 1e9;
    b.army.soldiers[0].phase = 0;
    b.step();
    for (const soldier of b.army.soldiers) soldier.phase = 1e9;
    const shot = b.combat.projectiles.find((p) => p.weapon === b.army.arsenal.rifle);
    b.combat.projectiles.length = 0;
    const fired = { pierceArmor: shot.pierceArmor, passes: shot.passes, passed: shot.passed };
    Object.assign(shot, { x: b.army.x, z: 200 });
    b.combat.projectiles.push(shot);
    const targets = place(b, b.army.x);
    const hits = [];
    let gateHits = 0;
    let opened = 0;
    b.bus.on(EVENTS.ENEMY_HIT, ({ enemy, damage, hero }) => {
      if (hero === null) hits.push({ enemy, damage });
    });
    b.bus.on(EVENTS.GATE_HIT, () => {
      gateHits += 1;
    });
    b.bus.on(EVENTS.CHEST_OPENED, () => {
      opened += 1;
    });
    run(b, 1);
    return { hits, gateHits, opened, chests: b.chests.list.length, fired, damage: shot.damage, targets };
  };
  const column = (b, x) => [placeEnemy(b, x, 500), placeEnemy(b, x, 600), placeEnemy(b, x, 700)];
  const armored = (b, x) => [placeEnemy(b, x, 500, 1e9, ENEMY_TYPES.armored)];
  const gate = (b) => [placeGate(b, 'minus', 1, 500, -10, 10)];
  // Uno scrigno a cui manca un colpo, e un altro più lontano
  const chests = (b) => [placeChest(b, 'damage', 1, 500, 1), placeChest(b, 'fireRate', 1, 900, 50)];
  const results = {};
  for (const [name, paths] of [
    ['prima', {}],
    ['fucina', weaponPaths({ rifle: 5 })],
  ]) {
    const passing = fire(paths, column);
    const struck = passing.hits.map(({ enemy }) => passing.targets.indexOf(enemy));
    const armor = fire(paths, armored);
    const chest = fire(paths, chests);
    results[name] = {
      struck: struck.join(','),
      armor: armor.hits[0].damage / armor.damage,
      gate: fire(paths, gate).gateHits,
      opened: chest.opened,
      chests: chest.chests,
      fired: passing.fired,
    };
  }
  const { prima, fucina } = results;
  check(
    `fucile di prima ${JSON.stringify(prima)}, al 5 ${JSON.stringify(fucina)} (nemici colpiti in fila, danno sul corazzato, colpi sulla porta, scrigni aperti e rimasti, il colpo come parte)`,
    prima.struck === '0' &&
      prima.armor < 1 &&
      prima.gate === 1 &&
      prima.fired.pierceArmor === false &&
      prima.fired.passes === 0 &&
      fucina.struck === '0,1' &&
      fucina.armor === 1 &&
      fucina.gate === 2 &&
      fucina.opened === 1 &&
      fucina.chests === 1 &&
      fucina.fired.pierceArmor === true &&
      fucina.fired.passes === 1 &&
      fucina.fired.passed === null,
  );
  check.done();
});
