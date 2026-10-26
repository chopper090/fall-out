import { test } from 'node:test';
import { checker } from '../support/check.js';
import { gainHolds } from '../support/stats.js';
import { EVENTS, createProfile, heroData, loadoutFrom, newBattle, root, stepBattle } from '../support/suite.js';

// 128. Potenziare un eroe solo si sente: i soldati dei posti attorno a lui sparano con la sua crescita (gli altri no);
// con il solo capo al livello 6 e 3 stelle il bot vince di più (qualche vittoria su 60, a meno del rumore del
// campione: tests/support/stats.js); due scudi o due fuochi rapidi non si tolgono il posto
test('128. Potenziare un eroe solo si sente: i soldati dei posti attorno a lui sparano con la...', async (t) => {
  const check = checker(t);
  const { createBot, updateBot } = await import(root + 'sim/bot.js');
  const { SIM } = await import(root + 'config/balance.js');
  const p = createProfile();
  Object.assign(p.heroes.leader, { xp: 1200, stars: 3 });
  const loadout = loadoutFrom(p);
  const leaderGrowth = heroData('leader', p.heroes.leader).growth;
  const battle = newBattle(4, undefined, loadout);
  const growths = [...new Set(battle.army.slots.map((slot) => slot.growth.toFixed(3)))];
  const wins = (load) => {
    let n = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const b = newBattle(seed, undefined, load);
      const bot = createBot(1000 / 60);
      while (!b.over && b.ms < 400000) {
        updateBot(bot, b);
        stepBattle(b, 1000 / 60);
      }
      if (b.mission.completed) n += 1;
    }
    return n;
  };
  const before = wins(undefined);
  const after = wins(loadout);
  // Scudo: con uno già alzato il secondo eroe non lo rialza
  const shields = newBattle(4);
  shields.abilities.shieldMs = 1500;
  const defender = shields.army.heroes.find((h) => h.id === 'defender');
  shields.abilities.cooldowns.set(defender, 0);
  shields.enemyFire.shots.push({ x: defender.x, z: shields.army.front + 50, vx: 0, vz: -400 });
  stepBattle(shields, 1000 / 60);
  const kept = shields.abilities.cooldowns.get(defender) === 0 && shields.abilities.shieldMs < 1500;
  // Fuoco rapido: due eroi accesi insieme restano tutti e due
  const fire = newBattle(4);
  const [first, second] = fire.army.heroes;
  fire.bus.emit(EVENTS.RAPID_FIRE_STARTED, { hero: first, ms: 3000 });
  fire.bus.emit(EVENTS.RAPID_FIRE_STARTED, { hero: second, ms: 1000 });
  stepBattle(fire, 1000 / 60);
  const both = fire.combat.rapidFire.length;
  check(
    `un eroe solo: crescita del capo ${leaderGrowth.toFixed(3)}, crescite dei posti ${growths.join(' ')}; il bot vince ${after}/60 contro ${before}/60; scudo già alzato, il secondo aspetta ${kept}; fuochi rapidi insieme ${both}`,
    leaderGrowth > 1 &&
      growths.includes(leaderGrowth.toFixed(3)) &&
      growths.includes((1).toFixed(3)) &&
      gainHolds(after, before, 60, SIM.flags.confidenceZ, 4) &&
      kept &&
      both === 2,
  );
  check.done();
});
