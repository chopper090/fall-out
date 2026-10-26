// Villaggio (meta/village.js). Le scorte dell'era 1: razioni (rations, per le battaglie della strada); legno (wood) e
// pietra (stone), per costruire; ingranaggi (gears) e circuiti (circuits), i resti del mondo di prima, per i livelli
// più alti (i circuiti li dà solo la conquista di un'area, uno per boss); più gli acceleratori (accelerators), rari,
// che accorciano una costruzione. Da dove arrivano: data/rewards.js (nemici e vittoria) e data/road.js (raccolte e
// conquista). Chi comincia ha start (le piastrine del reclutamento sono in data/growth.js).
// Tre edifici, ognuno da 0 (non ancora costruito) a maxLevel, con il nome name; a terra occupa size celle (colonne e
// righe, data/world.js) e si mette dove c'è posto nel territorio del villaggio. Salire al livello n costa costs[n - 1]
// (le scorte da pagare, per tipo: la fattoria vuole più legno, la fucina più pietra e ingranaggi) e dura
// minutes[n - 1] minuti di tempo vero, anche ad app chiusa. I cantieri aperti insieme sono al massimo builders
// (i posti cantiere; come averne di più non è ancora deciso: per ora li cambia solo il pannello di sviluppo), uno per
// edificio.
// farm, fattoria: produce rationsPerHour[n - 1] razioni l'ora, fino a storage[n - 1] in attesa di essere raccolte.
// barracks, caserma: ogni battaglia comincia con soldiers[n - 1] soldati in più.
// forge, fucina: le armi dei soldati fanno damage[n - 1] di danno in più e sparano fireRate[n - 1] più in fretta; dal
// livello autoAimLevel il lanciatore dei soldati mira da solo al nemico più vicino.
// Accelerare una costruzione: la sfida (challenge), una battaglia più dura con le regole rules (i nemici hanno
// enemyHpScale volte la vita), una sola per costruzione e solo se mancano almeno minMinutes minuti: vinta toglie
// timeShare del tempo che resta; oppure un acceleratore, che toglie acceleratorMinutes minuti
export const VILLAGE = {
  start: { rations: 12, wood: 12, stone: 8, gears: 5, circuits: 0, accelerators: 1 },
  builders: 1,
  buildings: {
    farm: {
      name: 'Fattoria',
      size: [2, 2],
      maxLevel: 5,
      costs: [
        { wood: 7, stone: 3 },
        { wood: 18, stone: 7, gears: 2 },
        { wood: 35, stone: 15, gears: 5 },
        { wood: 63, stone: 27, gears: 10 },
        { wood: 105, stone: 45, gears: 20 },
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
        { wood: 8, stone: 7 },
        { wood: 18, stone: 17, gears: 3 },
        { wood: 35, stone: 35, gears: 8 },
        { wood: 60, stone: 60, gears: 15 },
        { wood: 100, stone: 100, gears: 25 },
      ],
      minutes: [2, 8, 30, 90, 240],
      soldiers: [4, 8, 12, 18, 25],
    },
    forge: {
      name: 'Fucina',
      size: [2, 2],
      maxLevel: 5,
      costs: [
        { wood: 6, stone: 14, gears: 3 },
        { wood: 12, stone: 28, gears: 8 },
        { wood: 24, stone: 56, gears: 15 },
        { wood: 39, stone: 91, gears: 25 },
        { wood: 66, stone: 154, gears: 40 },
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
