import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  ENEMY_TYPES,
  EVENTS,
  STARTING_LOADOUT,
  laneCenters,
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
import { FORGE, WEAPON_PATHS } from '../../src/data/forge.js';
import { VILLAGE } from '../../src/data/village.js';
import { SOLDIER_TYPES, WEAPONS } from '../../src/data/units.js';
import { HUD } from '../../src/config/balance.js';
import { forgeCostText, levelText, stepText } from '../../src/view/forgeWords.js';
import { amountText, durationText } from '../../src/view/words.js';
import {
  canChallengeForge,
  canForge,
  clampForge,
  finishForge,
  forgeCost,
  forgeJobFrom,
  forgeLock,
  forgeTimeLeft,
  rushForge,
  startForge,
  startForgeChallenge,
  weaponLevelsFrom,
  weaponPaths,
  winForgeChallenge,
} from '../../src/meta/forge.js';
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

// Battaglia con soldati di un solo tipo, quello dell'arma weapon (con i miglioramenti paths della fucina), e il
// primo colpo (o granata) di uno di loro, tolto dal campo: la prova lo rimette dove le serve. Prima del colpo place
// mette i bersagli che vuole. Gli eroi non sparano e non usano i poteri, gli altri soldati aspettano
function firstShot(weapon, paths, place = () => {}) {
  const weapons = { ...STARTING_LOADOUT.weapons, paths };
  const army = { [weapon]: 1 };
  const b = weaponArena({ size: 1, loadout: { ...STARTING_LOADOUT, soldiers: 6, army, weapons } });
  for (const hero of b.army.heroes) {
    hero.weapon = { ...hero.weapon, fireRate: 0 };
    b.heroesState.cooldowns.set(hero, Infinity);
  }
  const { projectiles, grenades } = b.combat;
  projectiles.length = 0;
  grenades.length = 0;
  for (const soldier of b.army.soldiers) soldier.phase = 1e9;
  b.army.soldiers[0].phase = 0;
  place(b);
  b.step();
  for (const soldier of b.army.soldiers) soldier.phase = 1e9;
  const shot = [...projectiles, ...grenades].find((p) => p.weapon === b.army.arsenal[weapon]);
  projectiles.length = 0;
  grenades.length = 0;
  return { b, shot };
}

// 207. Il fucile della fucina (C25), con colpi veri di un soldato: al livello 3 il colpo passa un nemico e colpisce
// anche quello dietro (uno solo, e non due volte lo stesso), al 4 passa la corazza (il corazzato prende tutto il
// danno), al 5 conta due volte su porte e scrigni, ma uno scrigno a cui manca un colpo si apre una volta sola e gli
// altri restano; il fucile di sempre si ferma sul primo nemico, la corazza gli toglie una parte e conta una volta
test('207. Il fucile della fucina: colpo che passa, corazza, porte e scrigni contati due volte', (t) => {
  const check = checker(t);
  // Un colpo vero di un fucile (con i miglioramenti paths), portato davanti all'esercito, e quello che colpisce in un
  // secondo
  const fire = (paths, place) => {
    const { b, shot } = firstShot('rifle', paths);
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

// 208. Raffica e lanciatore della fucina (C26): la raffica dal livello 4 ha i pallini pesanti (si vedono più grandi),
// al 3 ancora no. Il lanciatore dal livello 3 ha la spoletta: la granata vera di un soldato scoppia sul primo cancello
// che sorvola, ci conta i colpi della spoletta e lo scoppio prende il nemico lì vicino; o sul primo scrigno (quello a
// cui manca un colpo si apre una volta sola, quello che ne vuole di più ne perde quanti la spoletta, l'altro più
// lontano resta com'era). Il cancello già al massimo e quello in un'altra corsia li sorvola e scoppia in fondo alla
// gittata, come la granata del livello 2 su tutto. I livelli dopo tengono gli effetti di quelli prima
test('208. Raffica e lanciatore della fucina: pallini pesanti e spoletta su porte e scrigni', (t) => {
  const check = checker(t);
  const heavy = [3, 4].map((level) => createArsenal(weaponPaths({ burst: level })).burst.heavy === true);
  const top = createArsenal(weaponPaths({ rifle: 5, burst: 5, launcher: 5 }));
  // Livello per livello: pallini pesanti della raffica, spoletta e mira del lanciatore
  const levels = [1, 2, 3, 4, 5];
  const steps = {
    heavy: levels.map((level) => weaponPaths({ burst: level }).burst.heavy),
    fuse: levels.map((level) => weaponPaths({ launcher: level }).launcher.fuse),
    aim: levels.map((level) => weaponPaths({ launcher: level }).launcher.aim),
  };
  // Una granata vera del lanciatore al livello level, lanciata da z 100 dritta fino in fondo alla gittata, e quello che
  // fa in 0,7 s con i bersagli messi da place (near: il nemico vicino al cancello, se c'è)
  const lob = (level, place) => {
    const { b, shot } = firstShot('launcher', weaponPaths({ launcher: level }));
    const { x } = b.army;
    Object.assign(shot, { x, fromX: x, toX: x, z: 100, fromZ: 100, toZ: shot.weapon.range, elapsedMs: 0 });
    shot.flightMs = (1000 * (shot.toZ - shot.fromZ)) / shot.weapon.speed;
    b.combat.grenades.push(shot);
    const near = place(b) ?? null;
    let gateHits = 0;
    let opened = 0;
    let nearHits = 0;
    const blasts = [];
    b.bus.on(EVENTS.GATE_HIT, () => {
      gateHits += 1;
    });
    b.bus.on(EVENTS.CHEST_OPENED, () => {
      opened += 1;
    });
    b.bus.on(EVENTS.ENEMY_HIT, ({ enemy }) => {
      if (enemy === near) nearHits += 1;
    });
    b.bus.on(EVENTS.BLAST, ({ z }) => blasts.push(Math.round(z)));
    // Il tempo del volo fino in fondo, non di più: gli scrigni non arrivano alla folla
    run(b, 0.7);
    const chests = b.chests.list.map((chest) => chest.hits).join(',');
    return { gateHits, opened, nearHits, blasts, chests };
  };
  const gate = (b) => {
    placeGate(b, 'minus', 1, 400, -10, 10);
    return placeEnemy(b, b.army.x + 60, 430);
  };
  const fullGate = (b) => placeGate(b, 'plus', 1, 400, 10) && null;
  const otherLane = (b) => placeGate(b, 'minus', 0, 400, -10, 10) && null;
  const chests = (hits) => (b) => {
    placeChest(b, 'damage', 1, 400, hits);
    placeChest(b, 'fireRate', 1, 600, 50);
    return null;
  };
  const fuse = WEAPON_PATHS.launcher[2].fuse;
  const range = WEAPONS.launcher.range;
  const results = {
    gate: lob(3, gate),
    fullGate: lob(3, fullGate),
    otherLane: lob(3, otherLane),
    open: lob(3, chests(1)),
    tough: lob(3, chests(fuse + 2)),
    before: lob(2, gate),
  };
  // Uno scoppio solo, prima della fine della gittata (early) o in fondo
  const once = (blasts, early) => blasts.length === 1 && (early ? blasts[0] < 450 : blasts[0] >= range - 1);
  const { gate: g, fullGate: full, otherLane: other, open, tough, before } = results;
  const effects = {
    rifle: [top.rifle.pierce, top.rifle.armor, top.rifle.gateHits],
    burst: top.burst.heavy,
    launcher: [top.launcher.fuse, top.launcher.aim],
  };
  check(
    `pallini pesanti al 3 e al 4 ${heavy.join('/')}; spoletta ${fuse} colpi: ${JSON.stringify(results)} (colpi sul cancello, scrigni aperti, colpi al nemico vicino, z degli scoppi, colpi che mancano agli scrigni rimasti); al livello 5 ${JSON.stringify(effects)}; livello per livello ${JSON.stringify(steps)}`,
    !heavy[0] &&
      heavy[1] &&
      fuse > 1 &&
      g.gateHits === fuse &&
      g.nearHits === 1 &&
      once(g.blasts, true) &&
      full.gateHits === 0 &&
      once(full.blasts, false) &&
      other.gateHits === 0 &&
      once(other.blasts, false) &&
      open.opened === 1 &&
      open.chests === '50' &&
      once(open.blasts, true) &&
      tough.opened === 0 &&
      tough.chests === '2,50' &&
      before.gateHits === 0 &&
      once(before.blasts, false) &&
      same(effects, { rifle: [1, true, 2], burst: true, launcher: [fuse, 'all'] }) &&
      same(steps, {
        heavy: [false, false, false, true, true],
        fuse: [0, 0, fuse, fuse, fuse],
        aim: [null, 'lane', 'lane', 'all', 'all'],
      }),
  );
  check.done();
});

// 209. La mira del lanciatore della fucina (C27): al livello 2 la granata vera di un soldato va sul nemico davanti
// nella sua corsia anche se un altro, in un'altra corsia, è più vicino; al livello 4 sul più vicino ovunque; al livello
// 1 non mira e va dritta in fondo alla gittata. Senza nemici davanti nella sua corsia, al 2 va dritta
test('209. La mira del lanciatore della fucina: nella sua corsia al livello 2, ovunque al 4', (t) => {
  const check = checker(t);
  // Dove va la granata del lanciatore al livello level, con un nemico vicino nella corsia a sinistra e (se far) uno più
  // lontano nella corsia dell'esercito
  const aimed = (level, far = true) => {
    const place = (b) => {
      placeEnemy(b, laneCenters[0], 300);
      if (far) placeEnemy(b, laneCenters[1], 500);
    };
    const { shot } = firstShot('launcher', weaponPaths({ launcher: level }), place);
    const lane = laneCenters.findIndex((x) => Math.abs(x - shot.toX) < 1);
    return { lane, toZ: Math.round(shot.toZ), straight: shot.toX === shot.fromX };
  };
  const results = { plain: aimed(1), lane: aimed(2), all: aimed(4), alone: aimed(2, false) };
  const range = WEAPONS.launcher.range;
  check(
    `granate (corsia dove va, z, dritta): ${JSON.stringify(results)}`,
    results.plain.straight &&
      results.plain.toZ === range &&
      results.lane.lane === 1 &&
      results.lane.toZ < 500 &&
      results.all.lane === 0 &&
      results.all.toZ < 300 &&
      results.alone.straight &&
      results.alone.toZ === range,
  );
  check.done();
});

// 210. La coda della fucina (C28): un lavoro alla volta, pagato, che finisce dopo i minuti del suo livello; il tetto è
// la fucina del villaggio, e la raffica aspetta che la caserma la addestri (il fucile c'è sempre). Una gemma toglie i
// suoi minuti, la sfida (una per lavoro, solo con almeno minMinutes da fare) una parte del tempo che resta, e solo al
// lavoro sfidato; l'orologio tornato indietro non lo allunga oltre il suo livello; dal salvataggio torna uguale, e un
// lavoro che non torna si perde
test('210. La coda della fucina: un lavoro alla volta, fino al livello della fucina, con gemme e sfida', (t) => {
  const check = checker(t);
  const T = 1_800_000_000_000;
  const MINUTE = 60000;
  const minutes = (level) => FORGE.minutes[level - 1] * MINUTE;
  const p = createProfile();
  const locks = [forgeLock(p, 'rifle')];
  p.village.levels.forge = 1;
  locks.push(forgeLock(p, 'rifle'), forgeLock(p, 'burst'));
  p.resources.stone = 0;
  const poor = canForge(p, 'rifle');
  Object.assign(p.resources, { stone: 1000, gears: 1000, circuits: 5, gems: 1 });
  const started = startForge(p, 'rifle', T);
  const paid = 1000 - p.resources.stone;
  const busy = canForge(p, 'rifle');
  const early = finishForge(p, T + minutes(1) - 1);
  const challengeable = canChallengeForge(p, T);
  const done = finishForge(p, T + minutes(1));
  locks.push(forgeLock(p, 'rifle'));
  p.village.levels.forge = 5;
  startForge(p, 'rifle', T);
  const gem = rushForge(p);
  const rushed = finishForge(p, T + minutes(2) - VILLAGE.gemMinutes * MINUTE);
  const noGem = startForge(p, 'rifle', T) && !rushForge(p);
  const challenge = [startForgeChallenge(p, T), startForgeChallenge(p, T)];
  const saved = winForgeChallenge(p, T + MINUTE);
  const left = forgeTimeLeft(p, T + MINUTE);
  // Un lavoro partito dopo la sfida (non sfidato) non si accorcia
  const other = winForgeChallenge({ ...p, forgeJob: { ...p.forgeJob, challenged: false } }, T + MINUTE);
  const job = { ...p.forgeJob };
  const reloaded = profileFrom(JSON.parse(JSON.stringify(storedProfile(p)))).forgeJob;
  p.forgeJob.endsAt = T + 10 * minutes(5);
  const clamped = clampForge(p, T) && p.forgeJob.endsAt - T;
  const lost = [{ weapon: 'ghost', endsAt: T }, { weapon: 'rifle', endsAt: NaN }, null, 'rifle'];
  const maxed = forgeJobFrom({ weapon: 'rifle', endsAt: T }, { rifle: WEAPON_PATHS.rifle.length });
  const last = { ...p, weaponLevels: { ...p.weaponLevels, rifle: 4 } };
  check(
    `coda: tetti ${JSON.stringify(locks)}; senza scorte ${poor}; parte ${started} (pietra pagata ${paid}), un altro ${busy}; prima della fine ${early}, alla fine ${JSON.stringify(done)}; sfida ${challengeable}; gemma ${gem} → ${JSON.stringify(rushed)}; senza gemme ${noGem}; sfida ${challenge.join('/')}: tolti ${saved / MINUTE} min, ne restano ${left / MINUTE}, a un lavoro non sfidato ${other}; dal salvataggio ${JSON.stringify(reloaded)}; orologio indietro: fine tra ${clamped / MINUTE} min; lavori che non tornano ${lost.map((job) => forgeJobFrom(job, p.weaponLevels)).join('/')}, al massimo ${maxed}; costo dell'ultimo livello ${JSON.stringify(forgeCost(last, 'rifle'))}`,
    same(locks, [{ forge: 1 }, null, { barracks: SOLDIER_TYPES.burst.barracks }, { forge: 2 }]) &&
      !poor &&
      started &&
      paid === FORGE.costs[0].stone &&
      !busy &&
      early === null &&
      challengeable === FORGE.minutes[0] >= VILLAGE.challenge.minMinutes &&
      same(done, { weapon: 'rifle', level: 1 }) &&
      p.weaponLevels.rifle === 2 &&
      gem &&
      same(rushed, { weapon: 'rifle', level: 2 }) &&
      noGem &&
      challenge[0] &&
      !challenge[1] &&
      saved === (minutes(3) - MINUTE) * VILLAGE.challenge.timeShare &&
      left === minutes(3) - MINUTE - saved &&
      other === 0 &&
      same(reloaded, job) &&
      job.challenged &&
      clamped === minutes(3) &&
      lost.every((job) => forgeJobFrom(job, p.weaponLevels) === null) &&
      maxed === null &&
      same(forgeCost(last, 'rifle'), { resources: FORGE.costs[4], minutes: FORGE.minutes[4] }),
  );
  check.done();
});

// 211. Le scritte della fucina (C29): cosa dà un livello da solo e cosa danno insieme i livelli fino a lì, nell'ordine
// dei dati, senza quelli spenti; niente a livello 0; il costo con le scorte e i minuti
test('211. Le scritte della fucina: un livello, i livelli insieme e il costo', (t) => {
  const check = checker(t);
  const texts = {
    nothing: levelText('rifle', 0),
    rifle: levelText('rifle', 3),
    step: stepText('launcher', 3),
    launcher: levelText('launcher', 4),
    burst: levelText('burst', 5),
    top: levelText('rifle', 5),
    cost: forgeCostText({ resources: FORGE.costs[4], minutes: FORGE.minutes[4] }),
  };
  const dot = HUD.world.separator;
  const { effects, labels } = HUD.forge;
  check(
    `scritte: ${JSON.stringify(texts)}`,
    texts.nothing === labels.nothing &&
      texts.rifle === [`${effects.damage} +15%`, `${effects.range} +200`, effects.pierceOne].join(dot) &&
      texts.step === `${effects.fuse} ×3` &&
      texts.launcher === [`${effects.radius} +30`, `${effects.fuse} ×3`, effects.aim.all].join(dot) &&
      texts.burst ===
        [`${effects.damage} +55%`, `${effects.fireRate} +20%`, `+2 ${effects.pellets}`, effects.heavy].join(dot) &&
      texts.top.endsWith(`${effects.armor}${dot}${effects.gateHits} ×2`) &&
      texts.cost.startsWith(amountText('stone', FORGE.costs[4].stone)) &&
      texts.cost.endsWith(`${dot}${durationText(FORGE.minutes[4] * 60000)}`),
  );
  check.done();
});
