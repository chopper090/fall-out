// Villaggio (meta/village.js). Tre risorse: razioni (rations, per i passi sulla mappa, solo dalla fattoria), materiali
// (materials, per costruire) e rottami (scrap, per le migliorie); più gli acceleratori (accelerators), rari, che
// accorciano una costruzione. Chi comincia ha start (le piastrine del reclutamento sono in data/growth.js).
// Tre edifici, ognuno da 0 (non ancora costruito) a maxLevel, con il nome name; a terra occupa size celle (colonne e
// righe, data/world.js) e si mette dove c'è posto nel territorio del villaggio. Salire al livello n costa costs[n - 1]
// e dura minutes[n - 1] minuti di tempo vero, anche ad app chiusa; si costruisce un edificio alla volta.
// farm, fattoria: produce rationsPerHour[n - 1] razioni l'ora, fino a storage[n - 1] in attesa di essere raccolte.
// barracks, caserma: ogni battaglia comincia con soldiers[n - 1] soldati in più.
// forge, fucina: le armi dei soldati fanno damage[n - 1] di danno in più e sparano fireRate[n - 1] più in fretta; dal
// livello autoAimLevel il lanciatore dei soldati mira da solo al nemico più vicino.
// Accelerare una costruzione: la sfida (challenge), una battaglia più dura con le regole rules (i nemici hanno
// enemyHpScale volte la vita), una sola per costruzione e solo se mancano almeno minMinutes minuti: vinta toglie
// timeShare del tempo che resta; oppure un acceleratore, che toglie acceleratorMinutes minuti
export const VILLAGE = {
  start: { rations: 12, materials: 20, scrap: 5, accelerators: 1 },
  buildings: {
    farm: {
      name: 'Fattoria',
      size: [2, 2],
      maxLevel: 5,
      costs: [
        { materials: 10, scrap: 0 },
        { materials: 25, scrap: 2 },
        { materials: 50, scrap: 5 },
        { materials: 90, scrap: 10 },
        { materials: 150, scrap: 20 },
      ],
      minutes: [1, 5, 20, 60, 180],
      rationsPerHour: [12, 18, 26, 36, 50],
      storage: [12, 24, 40, 60, 90],
    },
    barracks: {
      name: 'Caserma',
      size: [3, 2],
      maxLevel: 5,
      costs: [
        { materials: 15, scrap: 0 },
        { materials: 35, scrap: 3 },
        { materials: 70, scrap: 8 },
        { materials: 120, scrap: 15 },
        { materials: 200, scrap: 25 },
      ],
      minutes: [2, 8, 30, 90, 240],
      soldiers: [4, 8, 12, 18, 25],
    },
    forge: {
      name: 'Fucina',
      size: [2, 2],
      maxLevel: 5,
      costs: [
        { materials: 20, scrap: 3 },
        { materials: 40, scrap: 8 },
        { materials: 80, scrap: 15 },
        { materials: 130, scrap: 25 },
        { materials: 220, scrap: 40 },
      ],
      minutes: [3, 10, 30, 90, 240],
      damage: [0.05, 0.1, 0.16, 0.23, 0.3],
      fireRate: [0, 0.03, 0.06, 0.1, 0.14],
      autoAimLevel: 3,
    },
  },
  challenge: { rules: { enemyHpScale: 1.2 }, timeShare: 0.5, minMinutes: 5 },
  acceleratorMinutes: 30,
};
