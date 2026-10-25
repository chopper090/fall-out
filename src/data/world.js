// Il mondo, un grande quadrato visto in isometria (meta/world.js, disegnato da scenes/World.js): areas × areas aree
// quadrate, ognuna di areaCells × areaCells celle; la cella è il passo della griglia degli edifici e delle caselle
// della strada. Aree e celle si contano da 0 per colonna (col, che sullo schermo scende verso destra) e riga (row, che
// scende verso sinistra), dall'angolo in alto del quadrato. I lati di un'area: north (la prima riga), east (l'ultima
// colonna), south (l'ultima riga), west (la prima colonna). Il villaggio è l'area village, al centro: il suo
// territorio, chiuso dalle mura, è il posto dove si costruisce, e ogni area conquistata lo allarga; le altre aree sono
// nella nebbia. La porta delle mura sta sul lato gate.side del villaggio, sulla sua cella numero gate.at (da 0, dalla
// prima riga sui lati east e west, dalla prima colonna su north e south). Fuori dalle mura gli edifici stanno ad almeno
// wallMargin celle da loro. road: la strada unica (meta/road.js), che parte dalla porta e passa per le aree nell'ordine
// in cui si conquistano, a spirale attorno al villaggio. In ogni area segue i punti di svolta turns, in celle dell'area
// ([colonna, riga] da 0 a areaCells - 1), dritta da uno al successivo: nelle aree d'angolo lungo due lati, nelle altre
// lungo un lato con una gobba verso il centro dell'area; la sua prima casella sta accanto all'ultima dell'area prima
// (quella della prima area appena fuori dalla porta) e l'ultima è il boss, che conquista l'area. Tra due pezzi di
// strada c'è sempre almeno una cella vuota, anche in diagonale: nessun bivio, nemmeno a vederla
export const WORLD = {
  areas: 5,
  areaCells: 7,
  village: { col: 2, row: 2 },
  gate: { side: 'east', at: 3 },
  wallMargin: 1,
  road: [
    { area: [3, 2], turns: [[0, 3], [0, 6], [6, 6]] },
    { area: [3, 3], turns: [[6, 0], [6, 6], [0, 6]] },
    { area: [2, 3], turns: [[6, 6], [5, 6], [5, 3], [1, 3], [1, 6], [0, 6]] },
    { area: [1, 3], turns: [[6, 6], [0, 6], [0, 0]] },
    { area: [1, 2], turns: [[0, 6], [0, 5], [3, 5], [3, 1], [0, 1], [0, 0]] },
    { area: [1, 1], turns: [[0, 6], [0, 0], [6, 0]] },
    { area: [2, 1], turns: [[0, 0], [1, 0], [1, 3], [5, 3], [5, 0], [6, 0]] },
    { area: [3, 1], turns: [[0, 0], [6, 0], [6, 6]] },
    { area: [4, 1], turns: [[0, 6], [1, 6], [1, 3], [5, 3], [5, 6], [6, 6]] },
    { area: [4, 2], turns: [[6, 0], [6, 1], [3, 1], [3, 5], [6, 5], [6, 6]] },
    { area: [4, 3], turns: [[6, 0], [6, 1], [3, 1], [3, 5], [6, 5], [6, 6]] },
    { area: [4, 4], turns: [[6, 0], [6, 6], [0, 6]] },
    { area: [3, 4], turns: [[6, 6], [5, 6], [5, 3], [1, 3], [1, 6], [0, 6]] },
    { area: [2, 4], turns: [[6, 6], [5, 6], [5, 3], [1, 3], [1, 6], [0, 6]] },
    { area: [1, 4], turns: [[6, 6], [5, 6], [5, 3], [1, 3], [1, 6], [0, 6]] },
    { area: [0, 4], turns: [[6, 6], [0, 6], [0, 0]] },
    { area: [0, 3], turns: [[0, 6], [0, 5], [3, 5], [3, 1], [0, 1], [0, 0]] },
    { area: [0, 2], turns: [[0, 6], [0, 5], [3, 5], [3, 1], [0, 1], [0, 0]] },
    { area: [0, 1], turns: [[0, 6], [0, 5], [3, 5], [3, 1], [0, 1], [0, 0]] },
    { area: [0, 0], turns: [[0, 6], [0, 0], [6, 0]] },
    { area: [1, 0], turns: [[0, 0], [1, 0], [1, 3], [5, 3], [5, 0], [6, 0]] },
    { area: [2, 0], turns: [[0, 0], [1, 0], [1, 3], [5, 3], [5, 0], [6, 0]] },
    { area: [3, 0], turns: [[0, 0], [1, 0], [1, 3], [5, 3], [5, 0], [6, 0]] },
    { area: [4, 0], turns: [[0, 0], [6, 0], [6, 6]] },
  ],
};
