// Mappa di un capitolo (meta/map.js): righe di caselle dal basso (la partenza) all'alto (il boss), ognuna con da
// width[0] a width[1] caselle, spostate a caso di jitter (parte della larghezza), legate a quelle della riga sopra;
// ogni passo costa stepCost razioni. Si vede il tipo delle caselle a un passo; di quelle a due solo che ci sono (la
// nebbia); il resto è coperto.
// Tipi di casella (kinds, scelti per peso weight nelle righe tra la partenza e il boss): battle, una battaglia con i
// nemici più duri di riga in riga (battle: vita × hpScale + perRow a riga, più chapterStep a ogni capitolo nuovo);
// materials e scrap, risorse (da min a max, più perRow a riga); fragments, frammenti di un eroe schierato a caso;
// event, una sorpresa tra events (per peso). In cima il boss: una battaglia con la vita dei nemici × boss.hpScale
// rispetto all'ultima riga. Il seme del capitolo sta nel profilo: la stessa mappa a ogni apertura
export const MAP = {
  rows: 14,
  width: [1, 3],
  jitter: 0.05,
  stepCost: 1,
  // Probabilità che una casella sia legata anche a quella accanto nella riga sopra (un bivio)
  branchChance: 0.35,
  kinds: {
    battle: { weight: 46 },
    materials: { weight: 18, min: 10, max: 18, perRow: 1 },
    scrap: { weight: 12, min: 2, max: 4, perRow: 0.2 },
    fragments: { weight: 10, min: 2, max: 4 },
    event: { weight: 14 },
  },
  battle: { hpScale: 1, perRow: 0.04, chapterStep: 0.3 },
  boss: { hpScale: 1.25 },
  events: [
    { kind: 'dogTags', amount: 3, weight: 4 },
    { kind: 'materials', amount: 30, weight: 3 },
    { kind: 'xp', amount: 60, weight: 3 },
    { kind: 'accelerators', amount: 1, weight: 1 },
  ],
};
