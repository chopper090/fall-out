// Caselle della strada unica (meta/road.js; il percorso è in data/world.js). La prima di tutte è la porta, dove si
// parte. In ogni area l'ultima casella è il boss e la prima è neutra (l'ingresso); tra le due ci sono battaglie
// (battleShare di quelle in mezzo, arrotondato, al massimo metà), raccolte (collectShare) e il resto neutre, mescolate
// con il seme seed ma mai due battaglie di fila né una subito prima del boss: la strada è sempre la stessa per tutti.
// Costano razioni solo le battaglie e il boss (cost), pagate entrando nella casella: persa, la si riprova senza pagare
// di nuovo. Le battaglie hanno una durata (data/waves.js LENGTHS), scelte con il seme lengthSeed: nella prima area
// quelle di opening, per cominciare piano; nelle altre la prima è firstLength e le altre si pescano dal sacchetto
// lengthBag (più corte e medie che lunghe), mai una lunga come ultima prima del boss, che ha sempre bossLength ed è già
// la più dura. Nemici: vita × hpScale, più perArea a ogni area e perBattle a ogni battaglia della stessa area; il boss
// ha quella dopo l'ultima battaglia × boss.hpScale. Una raccolta dà una risorsa scelta per peso (weight; nella stessa
// area non si ripete finché non sono uscite tutte), amount più perArea a ogni area (per difetto); i frammenti vanno a
// un eroe schierato a caso. Conquistare un'area (battere il suo boss) dà il suo terreno e conquest (più perArea a ogni
// area). Della strada davanti si vede di che tipo sono le prossime sight caselle, e il boss dell'area
export const ROAD = {
  seed: 4808,
  lengthSeed: 5109,
  battleShare: 0.36,
  collectShare: 0.36,
  cost: { battle: 1, boss: 2 },
  opening: ['short', 'medium', 'medium'],
  firstLength: 'short',
  lengthBag: ['short', 'medium', 'medium', 'long'],
  bossLength: 'long',
  battle: { hpScale: 1, perArea: 0.15, perBattle: 0.04 },
  boss: { hpScale: 1 },
  collect: {
    materials: { weight: 40, amount: 10, perArea: 3 },
    scrap: { weight: 20, amount: 2, perArea: 0.5 },
    rations: { weight: 18, amount: 2, perArea: 0.25 },
    dogTags: { weight: 10, amount: 2, perArea: 0.25 },
    fragments: { weight: 10, amount: 2, perArea: 0.25 },
    accelerators: { weight: 2, amount: 1, perArea: 0 },
  },
  conquest: {
    materials: 25,
    scrap: 4,
    dogTags: 3,
    perArea: { materials: 10, scrap: 1, dogTags: 0 },
  },
  sight: 2,
};
