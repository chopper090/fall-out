import { test } from 'node:test';
import { checker } from '../support/check.js';
import { SIM } from '../../src/config/balance.js';
import { msToMinutes } from '../../src/core/time.js';
import { playCampaign } from '../../src/sim/campaign.js';

// La campagna del simulatore (sim/campaign.js) sulle prime quattro aree, con due semi: le regole del vecchio controllo
// 167. Ogni area si conquista senza restare bloccati, con al massimo SIM.campaign.flags.lossStreak battaglie perse di
// fila, e la prima entro firstAreaMinutes minuti; le lunghe sono dure apposta, ci si ferma a potenziarsi
test('Campagna col bot sulle prime quattro aree: nessuna bloccata, poche perse di fila, la prima area in fretta', (t) => {
  const check = checker(t);
  const { lossStreak, firstAreaMinutes } = SIM.campaign.flags;
  const runs = [1, 2].map((seed) => playCampaign(seed, 4));
  const diaries = ({ areas, stuck }) => (stuck === null ? areas : [...areas, stuck]);
  const worstOf = (run) => Math.max(...diaries(run).map((area) => area.worst.losses));
  const lines = runs.map((run) => {
    const minutes = run.areas.map((area) => `${Math.round(msToMinutes(area.ms))} min`);
    const ending = run.stuck === null ? 'aree' : `BLOCCATA nell'area ${run.stuck.area + 1} dopo`;
    const waits = Math.round(msToMinutes(run.waitMs));
    return `seme ${run.seed}: ${ending} ${minutes.join(', ')} (attese ${waits} min), perse di fila al massimo ${worstOf(run)}`;
  });
  const ok = (run) =>
    run.stuck === null &&
    run.areas.length === 4 &&
    worstOf(run) <= lossStreak &&
    msToMinutes(run.areas[0].ms) <= firstAreaMinutes;
  check(
    `quattro aree con la campagna del bot (al massimo ${lossStreak} perse di fila, la prima entro ${firstAreaMinutes} min): ${lines.join('; ')}`,
    runs.every(ok),
  );
  check.done();
});
