// Percorsi delle armi dei soldati, che si migliorano nella fucina (meta/forge.js): fucile, raffica e lanciatore hanno
// cinque livelli ciascuno, e il livello n aggiunge il suo (WEAPON_PATHS[arma][n - 1]) a quelli prima. Numeri: damage,
// il danno in più (una parte: 0.15 = +15%); fireRate, la cadenza in più; range, la gittata in più (unità del mondo);
// pellets, i pallini in più della raffica; radius, il raggio in più dello scoppio della granata. Effetti
// (systems/combat.js): pierce, quanti nemici passa ogni colpo prima di fermarsi; armor, i colpi passano la corazza;
// gateHits, quante volte conta ogni colpo su porte e scrigni. Con i prossimi step: fuse, la granata scoppia su porte e
// scrigni; aim, la granata mira da sola ('lane': al nemico più vicino nella sua corsia; 'all': ovunque)
export const WEAPON_PATHS = {
  rifle: [{ damage: 0.15 }, { range: 200 }, { pierce: 1 }, { armor: true }, { gateHits: 2 }],
  burst: [{ damage: 0.15 }, { pellets: 1 }, { fireRate: 0.2 }, { damage: 0.4 }, { pellets: 1 }],
  launcher: [{ radius: 30 }, { aim: 'lane' }, { fuse: true }, { aim: 'all' }, { damage: 0.3 }],
};
