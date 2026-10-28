import { test } from 'node:test';
import { checker } from '../support/check.js';
import { STARTING_LOADOUT, newBattle, same, stepBattle } from '../support/suite.js';
import { setWeaponLevel } from '../../src/debug/cheats.js';
import { WEAPON_PATHS } from '../../src/data/forge.js';
import { WEAPONS } from '../../src/data/units.js';
import { weaponLevelsFrom, weaponPaths } from '../../src/meta/forge.js';
import { loadoutFrom } from '../../src/meta/loadout.js';
import { createProfile } from '../../src/meta/profile.js';
import { createArsenal } from '../../src/systems/arsenal.js';

// 206. Percorsi delle armi (C24): ogni arma dei soldati ha cinque livelli nella fucina (data/forge.js), e il livello n
// somma i suoi miglioramenti a quelli prima; le armi senza livelli non cambiano. In battaglia i soldati sparano con
// le armi migliorate (systems/arsenal.js): danno, cadenza, gittata, pallini e raggio. Dal salvataggio i livelli sono
// interi dentro il percorso; il trucco del pannello li tiene dentro il percorso
test('206. Percorsi delle armi: cinque livelli per arma, sommati, e in battaglia le armi migliorate', (t) => {
  const check = checker(t);
  const lengths = Object.values(WEAPON_PATHS).map((path) => path.length);
  const paths = weaponPaths({ rifle: 2, burst: 4, launcher: 0 });
  const arsenal = createArsenal(paths);
  const { rifle, burst } = arsenal;
  const numbers = {
    rifle: [rifle.damage / WEAPONS.rifle.damage, rifle.range - WEAPONS.rifle.range],
    burst: [burst.damage / WEAPONS.burst.damage, burst.fireRate / WEAPONS.burst.fireRate, burst.pellets],
  };
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const untouched = arsenal.launcher === WEAPONS.launcher && arsenal.elite === WEAPONS.elite;
  const saved = weaponLevelsFrom({ rifle: 9, burst: -1, launcher: 2.5, ghost: 3 });
  const profile = createProfile();
  profile.weaponLevels.rifle = 2;
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
    `livelli ${lengths.join('/')}; fucile al 2 danno ×${numbers.rifle[0].toFixed(2)} gittata +${numbers.rifle[1]}; raffica al 4 danno ×${numbers.burst[0].toFixed(2)} cadenza ×${numbers.burst[1].toFixed(2)} pallini ${numbers.burst[2]}; lanciatore ed élite com'erano ${untouched}; percorsi senza livelli ${Object.keys(paths).join(',')}; dal salvataggio ${JSON.stringify(saved)}; in battaglia un colpo di fucile con gittata ${shot?.weapon.range}; trucco ${JSON.stringify(profile.weaponLevels)}`,
    lengths.every((length) => length === 5) &&
      near(numbers.rifle[0], 1.15) &&
      numbers.rifle[1] === 200 &&
      near(numbers.burst[0], 1.55) &&
      near(numbers.burst[1], 1.2) &&
      numbers.burst[2] === WEAPONS.burst.pellets + 1 &&
      untouched &&
      !('launcher' in paths) &&
      same(saved, { rifle: 5, burst: 0, launcher: 0 }) &&
      shot?.weapon.range === WEAPONS.rifle.range + 200 &&
      same(profile.weaponLevels, { rifle: 2, burst: 5, launcher: 0 }),
  );
  check.done();
});
