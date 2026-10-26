// Villaggio (meta/village.js). Le scorte dell'era 1: razioni (rations, per le battaglie della strada); legno (wood) e
// pietra (stone), per costruire; ingranaggi (gears) e circuiti (circuits), i resti del mondo di prima, per i livelli
// più alti (i circuiti li dà solo la conquista di un'area, uno per boss); più le gemme (gems), che accorciano una
// costruzione. Da dove arrivano: data/rewards.js (nemici e vittoria) e data/road.js (raccolte e conquista). Chi
// comincia ha start (le piastrine del reclutamento sono in data/growth.js). Cinque edifici, ognuno da 0 (non ancora
// costruito) a maxLevel, con il nome name; a terra occupa size celle (colonne e righe, data/world.js) e si mette dove
// c'è posto nel territorio del villaggio. Salire al livello n costa costs[n - 1] (le scorte da pagare, per tipo: la
// fattoria vuole più legno, la fucina più pietra e ingranaggi) e dura minutes[n - 1] minuti di tempo vero, anche ad app
// chiusa: al massimo un'ora, un'ora e mezza il centro al livello 5. I cantieri aperti insieme sono al massimo builders
// (i posti cantiere di base) più gli operai del Capanno dei mastri, uno per edificio. center, centro città: c'è
// dall'inizio, al livello startLevel, nella cella home del villaggio (colonna e riga dentro le mura, lontano dalla
// porta; si sposta come gli altri). Nessun altro edificio sale oltre il suo livello; lui sale al livello n solo con gli
// edifici di requires[n - 1] almeno ai livelli scritti lì (e i circuiti dei boss nel costo). Ogni suo livello darà
// funzioni nuove agli edifici, una alla volta con le fasi che le usano. Finché le razioni non bastano per la prossima
// battaglia della strada, ne dà una ogni reliefMinutes minuti (così non si resta mai fermi). lodge, Capanno dei mastri:
// si costruisce con il centro almeno al livello centerLevel; al livello n dà workers[n - 1] operai, cioè posti cantiere
// in più. farm, fattoria: produce rationsPerHour[n - 1] razioni l'ora, fino a storage[n - 1] in attesa di essere
// raccolte. barracks, caserma: ogni battaglia comincia con soldiers[n - 1] soldati in più. forge, fucina: le armi dei
// soldati fanno damage[n - 1] di danno in più e sparano fireRate[n - 1] più in fretta; dal livello autoAimLevel il
// lanciatore dei soldati mira da solo al nemico più vicino. Accelerare una costruzione: la sfida (challenge), una
// battaglia più dura con le regole rules (i nemici hanno enemyHpScale volte la vita), una sola per costruzione e solo
// se mancano almeno minMinutes minuti: vinta toglie timeShare del tempo che resta; oppure le gemme, una alla volta,
// ognuna toglie gemMinutes minuti
export const VILLAGE = {
  start: { rations: 12, wood: 12, stone: 8, gears: 5, circuits: 0, gems: 3 },
  builders: 1,
  buildings: {
    center: {
      name: 'Centro città',
      size: [2, 2],
      maxLevel: 5,
      startLevel: 1,
      home: [2, 5],
      costs: [
        {},
        { wood: 20, stone: 15 },
        { wood: 50, stone: 60, gears: 10, circuits: 2 },
        { wood: 90, stone: 110, gears: 20, circuits: 3 },
        { wood: 150, stone: 180, gears: 35, circuits: 5 },
      ],
      minutes: [0, 5, 20, 45, 90],
      requires: [
        {},
        { farm: 1, barracks: 1 },
        { farm: 2, barracks: 2, forge: 2, lodge: 1 },
        { farm: 3, barracks: 3, forge: 3, lodge: 2 },
        { farm: 4, barracks: 4, forge: 4, lodge: 3 },
      ],
      reliefMinutes: 10,
    },
    lodge: {
      name: 'Capanno dei mastri',
      size: [2, 2],
      maxLevel: 5,
      centerLevel: 2,
      costs: [
        { wood: 20, stone: 10, gears: 2 },
        { wood: 30, stone: 25, gears: 5 },
        { wood: 50, stone: 50, gears: 10 },
        { wood: 80, stone: 80, gears: 18 },
        { wood: 120, stone: 130, gears: 30 },
      ],
      minutes: [5, 10, 20, 40, 60],
      workers: [0, 1, 1, 2, 2],
    },
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
      minutes: [1, 5, 15, 30, 60],
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
      minutes: [2, 8, 20, 40, 60],
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
      minutes: [3, 10, 20, 40, 60],
      damage: [0.05, 0.1, 0.16, 0.23, 0.3],
      fireRate: [0, 0.03, 0.06, 0.1, 0.14],
      autoAimLevel: 3,
    },
  },
  challenge: { rules: { enemyHpScale: 1.2 }, timeShare: 0.5, minMinutes: 5 },
  gemMinutes: 10,
};
