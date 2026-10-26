import { REWARDS } from '../data/rewards.js';

// Premi di fine battaglia (data/rewards.js) dal risultato della battaglia (systems/battle.js battleResult): se vinta
// tutto il raccolto e il premio della vittoria (legno, esperienza e piastrine; prize false: niente premio, come
// nella sfida, che ha il suo), se persa REWARDS.defeatShare del raccolto, per difetto, e con consolation (la prima
// sconfitta su una casella della strada) l'esperienza della consolazione. L'esperienza raccolta, quella del premio e
// quella della consolazione si dividono in parti uguali tra gli eroi schierati (il resto va ai primi); i frammenti
// vanno all'eroe del premio. Tutto entra nel profilo. Restituisce il riepilogo per la schermata di fine: vinta o no,
// parte tenuta del raccolto (kept, share la sua frazione), premio, esperienza della consolazione (consolation, 0 se
// non c'è), per ogni eroe le sue statistiche con esperienza e frammenti avuti e mvp per il migliore (più danno, a pari
// danno più nemici abbattuti, poi il primo dello schieramento; nessuno se nessuno ha fatto danno), e le risorse che ci
// sono ora nel profilo (resources). Il bottino ha le scorte che i nemici lasciano (data/rewards.js DROPS), il premio
// quelle di REWARDS.victory: entrano tra le risorse del profilo quelle che ci sono (non l'esperienza e i frammenti)
export function grantRewards(profile, result, { prize: withPrize = true, consolation: comforted = false } = {}) {
  const { completed, loot } = result;
  const share = completed ? 1 : REWARDS.defeatShare;
  const keep = (amount) => Math.floor(amount * share);
  const { fragments, ...amounts } = loot;
  const kept = {
    ...Object.fromEntries(Object.entries(amounts).map(([kind, amount]) => [kind, keep(amount)])),
    fragments: Object.fromEntries(Object.entries(fragments).map(([id, count]) => [id, keep(count)])),
  };
  const won = completed && withPrize;
  const prize = Object.fromEntries(Object.entries(REWARDS.victory).map(([kind, amount]) => [kind, won ? amount : 0]));
  const consolation = !completed && comforted ? REWARDS.consolation.xp : 0;
  const xp = kept.xp + prize.xp + consolation;
  const count = result.heroes.length;
  const better = (a, b) => b.damageDealt > a.damageDealt || (b.damageDealt === a.damageDealt && b.kills > a.kills);
  const best = result.heroes.reduce((top, hero) => (better(top, hero) ? hero : top));
  const heroes = result.heroes.map((hero, index) => ({
    ...hero,
    xp: shareOf(xp, count, index),
    fragments: kept.fragments[hero.id] ?? 0,
    mvp: hero === best && best.damageDealt > 0,
  }));
  const { resources } = profile;
  const gained = [...Object.entries(kept), ...Object.entries(prize)].filter(([kind]) => Object.hasOwn(resources, kind));
  for (const [kind, amount] of gained) resources[kind] += amount;
  for (const hero of heroes) {
    const record = profile.heroes[hero.id];
    record.xp += hero.xp;
    record.fragments += hero.fragments;
  }
  return { completed, kept, share, prize, consolation, heroes, resources: { ...resources } };
}

// La parte di total che spetta al index-esimo di count: parti uguali, il resto ai primi
function shareOf(total, count, index) {
  return Math.floor(total / count) + (index < total % count ? 1 : 0);
}
