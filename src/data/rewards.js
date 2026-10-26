// Premi delle battaglie. drops: cosa lascia cadere in strada chi muore, per tipo di nemico (sono le chiavi di
// ENEMY_TYPES, data/enemies.js): ogni premio esce con la sua probabilità (chance) e vale amount. Anche i nemici normali
// lasciano qualcosa ogni tanto (i più duri più spesso, le pedine degli sciami di rado), così si raccoglie fin dalla
// prima ondata, poco, e di più nelle ultime, che hanno più nemici: legno da quelli leggeri (normali, veloci, sciami),
// pietra da corazzati e tiratori. I premi dei nemici sono tarati sul minuto di gioco: con le ondate corte e fitte se
// ne raccolgono al minuto quanti con quelle lunghe, a battaglia meno. Tipi: le scorte del villaggio (data/village.js:
// wood legno, stone pietra, gears ingranaggi, gems gemme per i cantieri, rare), xp (esperienza, divisa
// tra gli eroi schierati), fragments (frammenti di un eroe schierato a caso). I circuiti no: li dà solo la conquista
// di un'area (data/road.js). Lo prende
// l'esercito che ci passa sopra (systems/loot.js). Alla fine (meta/rewards.js) chi perde tiene defeatShare del
// raccolto, per difetto; chi vince lo tiene tutto e prende il premio della vittoria (victory, con le piastrine del
// reclutamento; non nella sfida del villaggio, che al suo posto toglie tempo al cantiere). Chi perde per la prima volta
// una battaglia della strada su quella casella prende anche consolation (esperienza divisa tra gli eroi schierati),
// una volta sola per casella. Non ci sono stelle: una battaglia vinta resta vinta, non c'è niente da rigiocare
export const DROPS = {
  grunt: [{ kind: 'wood', chance: 0.075, amount: 1 }],
  fast: [{ kind: 'wood', chance: 0.075, amount: 1 }],
  armored: [{ kind: 'stone', chance: 0.19, amount: 1 }],
  shooter: [{ kind: 'stone', chance: 0.19, amount: 1 }],
  swarm: [{ kind: 'wood', chance: 0.015, amount: 1 }],
  elite: [
    { kind: 'stone', chance: 0.5, amount: 3 },
    { kind: 'xp', chance: 0.5, amount: 20 },
    { kind: 'fragments', chance: 0.2, amount: 1 },
    { kind: 'gears', chance: 0.4, amount: 1 },
  ],
  boss: [
    { kind: 'wood', chance: 1, amount: 6 },
    { kind: 'stone', chance: 1, amount: 6 },
    { kind: 'xp', chance: 1, amount: 80 },
    { kind: 'fragments', chance: 1, amount: 3 },
    { kind: 'gears', chance: 1, amount: 3 },
    { kind: 'gems', chance: 0.25, amount: 3 },
  ],
};

export const REWARDS = {
  defeatShare: 0.5,
  victory: { wood: 6, xp: 80, dogTags: 3 },
  consolation: { xp: 40 },
};
