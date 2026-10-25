// Il mondo, un grande quadrato visto in isometria (meta/world.js, disegnato da scenes/World.js): areas × areas aree
// quadrate, ognuna di areaCells × areaCells celle; la cella è il passo della griglia degli edifici. Aree e celle si
// contano da 0 per colonna (col, che sullo schermo scende verso destra) e riga (row, che scende verso sinistra),
// dall'angolo in alto del quadrato. I lati di un'area: north (la prima riga), east (l'ultima colonna), south (l'ultima
// riga), west (la prima colonna). Il villaggio è l'area village, al centro: il suo territorio, chiuso dalle mura, è il
// posto dove si costruisce; le altre aree sono nella nebbia. La porta delle mura sta sul lato gate.side del villaggio,
// sulla sua cella numero gate.at (da 0, dalla prima riga sui lati east e west, dalla prima colonna su north e south)
export const WORLD = {
  areas: 5,
  areaCells: 7,
  village: { col: 2, row: 2 },
  gate: { side: 'east', at: 3 },
};
