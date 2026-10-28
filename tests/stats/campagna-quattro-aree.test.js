import { test } from 'node:test';
import { checker } from '../support/check.js';
import { SIM } from '../../src/config/balance.js';
import { msToMinutes } from '../../src/core/time.js';
import { armyCapacity, createFallen, trainableTypes } from '../../src/meta/barracks.js';
import { playCampaign } from '../../src/sim/campaign.js';

// La campagna del simulatore (sim/campaign.js) sulle prime quattro aree, con cinque semi: le regole e i semi del
// vecchio controllo 167, che la giocava con un bot suo (tolto). Ogni area si conquista senza restare bloccati, con al
// massimo SIM.campaign.flags.lossStreak battaglie perse di fila, e la prima entro firstAreaMinutes minuti; le
// battaglie col boss sono più dure, ci si ferma a potenziarsi. Alla conquista dell'ultima area il bot ha formato
// l'esercito in caserma (di ogni tipo che la caserma addestra la parte SIM.campaign.army del tetto, il resto
// fucilieri) e ha comprato nella fucina almeno un livello del fucile, mai oltre il livello della fucina
test('Campagna col bot sulle prime quattro aree: nessuna bloccata, poche perse di fila, la prima area in fretta', (t) => {
  const check = checker(t);
  const { lossStreak, firstAreaMinutes } = SIM.campaign.flags;
  const runs = [1, 2, 3, 4, 5].map((seed) => playCampaign(seed, 4));
  const diaries = ({ areas, stuck }) => (stuck === null ? areas : [...areas, stuck]);
  const worstOf = (run) => Math.max(...diaries(run).map((area) => area.worst.losses));
  // L'esercito alla conquista dell'ultima area, com'è e come lo vuole SIM.campaign.army (fucilieri per il resto)
  const formed = (run) => {
    const last = run.areas.at(-1);
    const level = last.village.barracks;
    const capacity = armyCapacity(level);
    const wanted = { ...createFallen() };
    for (const type of trainableTypes(level)) wanted[type] = Math.floor(capacity * (SIM.campaign.army[type] ?? 0));
    wanted.rifle = capacity - Object.values(wanted).reduce((sum, count) => sum + count, 0);
    return { army: Object.values(last.army).join('/'), wanted: Object.values(wanted).join('/') };
  };
  // Le armi alla conquista dell'ultima area: i livelli e se vanno bene
  const armed = (run) => {
    const { weapons, village } = run.areas.at(-1);
    const levels = Object.values(weapons);
    return { text: levels.join('/'), ok: weapons.rifle >= 1 && levels.every((level) => level <= village.forge) };
  };
  const lines = runs.map((run) => {
    const minutes = run.areas.map((area) => `${Math.round(msToMinutes(area.ms))} min`);
    const ending = run.stuck === null ? 'aree' : `BLOCCATA nell'area ${run.stuck.area + 1} dopo`;
    const waits = Math.round(msToMinutes(run.waitMs));
    const { army } = formed(run);
    return `seme ${run.seed}: ${ending} ${minutes.join(', ')} (attese ${waits} min), perse di fila al massimo ${worstOf(run)}, esercito ${army}, armi ${armed(run).text}`;
  });
  const ok = (run) =>
    run.stuck === null &&
    formed(run).army === formed(run).wanted &&
    armed(run).ok &&
    run.areas.length === 4 &&
    worstOf(run) <= lossStreak &&
    msToMinutes(run.areas[0].ms) <= firstAreaMinutes;
  check(
    `quattro aree con la campagna del bot (al massimo ${lossStreak} perse di fila, la prima entro ${firstAreaMinutes} min): ${lines.join('; ')}`,
    runs.every(ok),
  );
  check.done();
});
