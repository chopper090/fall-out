// Percorsi delle armi dei soldati, che si migliorano nella fucina (meta/forge.js): fucile, raffica e lanciatore hanno
// cinque livelli ciascuno, e il livello n aggiunge il suo (WEAPON_PATHS[arma][n - 1]) a quelli prima. Numeri: damage,
// il danno in più (una parte: 0.15 = +15%); fireRate, la cadenza in più; range, la gittata in più (unità del mondo);
// pellets, i pallini in più della raffica; radius, il raggio in più dello scoppio della granata. Effetti
// (systems/combat.js): pierce, quanti nemici passa ogni colpo prima di fermarsi; armor, i colpi passano la corazza;
// gateHits, quante volte conta ogni colpo su porte e scrigni; heavy, i pallini pesanti, più grandi a vedersi
// (view/unitsView.js); fuse, la granata scoppia sul primo cancello (che ferma ancora i colpi) o scrigno che sorvola e
// ci conta fuse colpi; aim,
// la granata mira da sola ('lane': al nemico più vicino davanti nella corsia del lanciatore; 'all': ovunque)
export const WEAPON_PATHS = {
  rifle: [{ damage: 0.15 }, { range: 200 }, { pierce: 1 }, { armor: true }, { gateHits: 2 }],
  burst: [{ damage: 0.15 }, { pellets: 1 }, { fireRate: 0.2 }, { damage: 0.4, heavy: true }, { pellets: 1 }],
  launcher: [{ radius: 30 }, { aim: 'lane' }, { fuse: 3 }, { aim: 'all' }, { damage: 0.3 }],
};

// La coda della fucina (meta/forge.js): un lavoro alla volta, che porta un'arma al livello dopo. Il livello n costa
// costs[n - 1] (le scorte da pagare, per tipo) e dura minutes[n - 1] minuti di tempo vero, anche ad app chiusa. Si
// compra fino al livello della fucina del villaggio, e solo per le armi dei tipi che la caserma addestra. Si accorcia
// come i cantieri (data/village.js): una gemma toglie gemMinutes minuti, la sfida vinta una parte del tempo che resta
export const FORGE = {
  costs: [
    { stone: 8, gears: 2 },
    { stone: 16, gears: 4 },
    { stone: 30, gears: 8 },
    { stone: 50, gears: 14 },
    { stone: 80, gears: 22, circuits: 1 },
  ],
  minutes: [5, 10, 15, 20, 30],
};
