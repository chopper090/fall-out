// Caselle della strada unica (meta/road.js; il percorso è in data/world.js). La prima di tutte è la porta, dove si
// parte. In ogni area la prima casella è neutra (l'ingresso) e l'ultima è la battaglia con il boss, che la conquista
// (kind boss); in mezzo battlesPerArea - 1 battaglie e, nelle caselle che restano, raccolte, mescolate con il seme
// seed: la strada è sempre la stessa per tutti. Le battaglie hanno un numero, da 1 dalla porta (il contatore delle
// partite), e il loro tipo (data/waves.js BATTLE_TYPES) viene dal numero: il primo di cadence che lo divide (ogni 100
// la tripla, ogni 50 la doppia, ogni 10 quella con il boss), altrimenti la normale; la decima di ogni area è quella del
// boss. Costano razioni le battaglie (cost: battle quelle senza boss, boss quelle con), pagate entrando nella casella
// quando la sua battaglia parte (aprire lo schieramento e tornare indietro non costa): persa o lasciata a metà, la si
// riprova senza pagare di nuovo. I nemici crescono con la squadra (strength): expected è la forza che ha la squadra
// (systems/power.js armyPower) all'inizio di ogni area, misurata con il simulatore della campagna, e dentro l'area
// cresce di battaglia in battaglia verso quella dell'area dopo; ogni battaglia è tarata perché quella squadra abbia il
// rapporto ratio del suo tipo (più alto, più facile: le lunghe sono dure apposta), per ease nelle prime aree (una
// voce per area, dalla prima: all'inizio tutto è facile; dopo, 1). Di quanto la squadra è cresciuta
// dall'inizio, la parte countShare va in arrivi in più (al massimo maxCount volte), il resto in vita. Andando avanti
// arrivano anche più nemici dei tipi di variety.kinds (le loro probabilità per 1 più perBattle a ogni battaglia, al
// massimo max). Colpi per gli scrigni e numeri dei cancelli × hits.scale, più hits.perBattle a ogni battaglia (i colpi
// che spara l'esercito crescono con lui). Dall'area gates.minusOnlyFrom (contata da 0) i cancelli sono tutti negativi,
// da girare: i profondi partono da deep.from della loro profondità e ogni area dopo vanno più giù di deep.perArea,
// fino a tutta. Una raccolta dà
// una risorsa scelta per peso (weight; nella stessa area non si ripete finché non sono uscite tutte), amount più
// perArea a ogni area (per difetto); i frammenti vanno a un eroe schierato a caso. Conquistare un'area (battere il suo
// boss) dà il suo terreno e conquest (più perArea a ogni area), con l'unico circuito dell'area. Della strada davanti si
// vede di che tipo sono le prossime sight caselle, e il boss dell'area
export const ROAD = {
  seed: 4808,
  battlesPerArea: 10,
  cadence: [
    { every: 100, type: 'triple' },
    { every: 50, type: 'double' },
    { every: 10, type: 'boss' },
  ],
  cost: { battle: 1, boss: 2 },
  strength: {
    expected: [
      142, 301, 424, 505, 660, 759, 819, 975, 1336, 1507, 1602, 1723, 1846, 2179, 2335, 2800, 3055, 3140, 3221, 3749,
      4028, 4222, 4482, 4657, 4859,
    ],
    ratio: { normal: 1.85, boss: 1.85, double: 1.85, triple: 1.6 },
    ease: [1.4, 1.25, 1.15, 1.15, 1.15, 1.15, 1.08],
    countShare: 0.25,
    maxCount: 1.6,
  },
  variety: { kinds: ['armored', 'elite'], perBattle: 0.004, max: 1.8 },
  hits: { scale: 1, perBattle: 0.005 },
  gates: { minusOnlyFrom: 3, deep: { from: 0.2, perArea: 0.07 } },
  collect: {
    wood: { weight: 20, amount: 8, perArea: 1 },
    stone: { weight: 20, amount: 8, perArea: 1 },
    gears: { weight: 20, amount: 2, perArea: 0.5 },
    rations: { weight: 18, amount: 2, perArea: 0.25 },
    dogTags: { weight: 10, amount: 2, perArea: 0.25 },
    fragments: { weight: 10, amount: 2, perArea: 0.25 },
    gems: { weight: 2, amount: 3, perArea: 0 },
  },
  conquest: {
    stone: 15,
    gears: 4,
    circuits: 1,
    dogTags: 3,
    perArea: { stone: 3, gears: 1, circuits: 0, dogTags: 0 },
  },
  sight: 2,
};
