import { REWARDS } from '../data/rewards.js';

// Premi di fine battaglia (data/rewards.js) dal risultato della battaglia (systems/battle.js battleResult): se vinta
// tutto il raccolto e il premio della vittoria (materiali, esperienza e piastrine; prize false: niente premio, come
// nella sfida, che ha il suo), se persa REWARDS.defeatShare del
// raccolto, per difetto, e nient'altro. L'esperienza raccolta e quella del premio si dividono in parti uguali tra gli
// eroi schierati (il resto va ai primi); i frammenti vanno all'eroe del premio. Tutto entra nel profilo. Restituisce il
// riepilogo per la schermata di fine: vinta o no, parte tenuta del raccolto (kept, share la sua frazione), premio, per
// ogni eroe le sue statistiche con esperienza e frammenti avuti e mvp per il migliore (più danno, a pari danno più
// nemici abbattuti, poi il primo dello schieramento; nessuno se nessuno ha fatto danno), e i materiali, i
// rottami e le piastrine che ci sono ora nel profilo
export function grantRewards(profile, result, { prize: withPrize = true } = {}) {
  const { completed, loot } = result;
  const share = completed ? 1 : REWARDS.defeatShare;
  const keep = (amount) => Math.floor(amount * share);
  const kept = {
    materials: keep(loot.materials),
    xp: keep(loot.xp),
    scrap: keep(loot.scrap),
    accelerators: keep(loot.accelerators),
    fragments: Object.fromEntries(Object.entries(loot.fragments).map(([id, count]) => [id, keep(count)])),
  };
  const prize = completed && withPrize ? { ...REWARDS.victory } : { materials: 0, xp: 0, dogTags: 0 };
  const xp = kept.xp + prize.xp;
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
  resources.materials += kept.materials + prize.materials;
  resources.scrap += kept.scrap;
  resources.accelerators += kept.accelerators;
  resources.dogTags += prize.dogTags;
  for (const hero of heroes) {
    const record = profile.heroes[hero.id];
    record.xp += hero.xp;
    record.fragments += hero.fragments;
  }
  const { materials, scrap, dogTags } = resources;
  return { completed, kept, share, prize, heroes, materials, scrap, dogTags };
}

// La parte di total che spetta al index-esimo di count: parti uguali, il resto ai primi
function shareOf(total, count, index) {
  return Math.floor(total / count) + (index < total % count ? 1 : 0);
}
