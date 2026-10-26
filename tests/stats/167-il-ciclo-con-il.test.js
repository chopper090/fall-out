import { test } from 'node:test';
import { checker } from '../support/check.js';
import {
  RECRUIT,
  ROAD_TILES,
  battleResult,
  conqueredAreas,
  createProfile,
  grantRewards,
  heroesMeta,
  newBattle,
  recordBattle,
  roadLoadout,
  roadMeta,
  roadStep,
  root,
  stepBattle,
  villageTools,
  winRoadTile,
} from '../support/suite.js';

// 167. Il ciclo con il tempo vero sulle prime quattro aree: il bot avanza, combatte (riprova le battaglie perse),
// costruisce al villaggio il prossimo obiettivo, raccoglie le razioni e aspetta la fattoria quando finiscono, sale di
// stella e recluta. Ogni area si conquista senza restare bloccato (al massimo 12 battaglie perse di fila) e la prima in
// fretta; le lunghe sono dure apposta, ci si ferma a potenziarsi
test('167. Il ciclo con il tempo vero sulle prime quattro aree: il bot avanza, combatte (ripr...', async (t) => {
  const check = checker(t);
  const { createBot, updateBot } = await import(root + 'sim/bot.js');
  const { settle, collectRations, nextGoal, canUpgrade, startUpgrade, nextRationIn, timeLeft, useAccelerator } =
    villageTools;
  const { starUp, recruit, placeHero } = heroesMeta;
  const STEP_MS = 4000;
  const OVERHEAD_MS = 30000;
  const AREAS = 4;
  const campaign = (seed) => {
    const start = 1_800_000_000_000 + seed * 1e9;
    let now = start;
    const p = createProfile();
    const log = { battles: 0, won: 0, lost: 0, steps: 0, waitMinutes: 0, worstStreak: 0, areas: [] };
    let streak = 0;
    const advance = (ms) => {
      now += ms;
      settle(p, now);
    };
    const manage = () => {
      settle(p, now);
      collectRations(p);
      const goal = nextGoal(p);
      if (goal && canUpgrade(p, goal.building)) startUpgrade(p, goal.building, now);
      if (timeLeft(p, now) > 30 * 60000 && p.resources.accelerators > 0) useAccelerator(p, now);
      for (const id of Object.keys(p.heroes)) while (starUp(p, id));
      while (p.resources.dogTags >= RECRUIT.cost) {
        const got = recruit(p, now);
        const empty = p.lineup.indexOf(null);
        if (got.isNew && empty > 0) placeHero(p, empty, got.id);
      }
    };
    const fight = (tile) => {
      const battle = newBattle(seed * 1000 + log.battles, undefined, roadLoadout(p, tile.rules));
      const bot = createBot(1000 / 60);
      while (!battle.over && battle.ms < 400000) {
        updateBot(bot, battle);
        stepBattle(battle, 1000 / 60);
      }
      const result = battleResult(battle);
      recordBattle(p, result);
      grantRewards(p, result);
      log.battles += 1;
      if (result.completed) {
        winRoadTile(p, tile.index);
        log.won += 1;
        streak = 0;
      } else {
        log.lost += 1;
        streak += 1;
        log.worstStreak = Math.max(log.worstStreak, streak);
      }
      advance(battle.ms + OVERHEAD_MS);
    };
    let areaStart = now;
    let areaWait = 0;
    for (let guard = 0; guard < 3000 && log.areas.length < AREAS; guard++) {
      manage();
      if (conqueredAreas(p.road) > log.areas.length) {
        log.areas.push({ minutes: Math.round((now - areaStart) / 60000), waits: Math.round(areaWait) });
        areaStart = now;
        areaWait = 0;
        continue;
      }
      const here = ROAD_TILES[p.road.at];
      if (!p.road.done) {
        fight(here);
        continue;
      }
      const next = ROAD_TILES[p.road.at + 1];
      if (p.resources.rations < roadMeta.stepCost(next)) {
        // Almeno un secondo: a una frazione minima dalla razione intera il tempo non andrebbe avanti
        const wait = Math.max(1000, nextRationIn(p) ?? Math.max(60000, timeLeft(p, now)));
        log.waitMinutes += wait / 60000;
        areaWait += wait / 60000;
        advance(wait);
        continue;
      }
      roadStep(p);
      log.steps += 1;
      advance(STEP_MS);
    }
    const total = log.areas.reduce((sum, area) => sum + area.minutes, 0);
    const three = log.areas.slice(0, 3).reduce((sum, area) => sum + area.minutes, 0);
    return { ...log, done: log.areas.length === AREAS, total, three, village: { ...p.village.levels } };
  };
  const runs = [1, 2, 3, 4, 5].map(campaign);
  const areaText = (a) => `${a.minutes} min (attese ${a.waits})`;
  const lines = runs.map(
    (r) =>
      `${r.done ? 'aree' : 'BLOCCATO'} ${r.areas.map(areaText).join(', ')}, ${r.steps} passi, battaglie ${r.won}/${r.battles} (perse di fila al massimo ${r.worstStreak}), villaggio ${Object.values(r.village).join('/')}`,
  );
  check(
    `quattro aree col bot: ${lines.join('; ')}`,
    runs.every((r) => r.done && r.worstStreak <= 12 && r.areas[0].minutes <= 30),
  );
  check.done();
});
