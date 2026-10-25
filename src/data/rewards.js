// Premi delle battaglie. drops: cosa lascia cadere in strada chi muore, per tipo di nemico (sono le chiavi di
// ENEMY_TYPES, data/enemies.js): ogni premio esce con la sua probabilità (chance) e vale amount. Anche i nemici normali
// lasciano un materiale ogni tanto (i più duri più spesso, le pedine degli sciami di rado), così si raccoglie fin dalla
// prima ondata, poco, e di più nelle ultime, che hanno più nemici. Tipi:
// materials (materiali), xp (esperienza, divisa tra gli eroi schierati), fragments (frammenti di un eroe schierato a
// caso), scrap (rottami, per le migliorie del villaggio), accelerators (acceleratori dei cantieri, rari). Lo prende
// l'esercito che ci passa sopra (systems/loot.js). Alla fine (meta/rewards.js) chi perde tiene defeatShare del
// raccolto, per difetto; chi vince lo tiene tutto e prende il premio della vittoria (victory, con le piastrine del
// reclutamento; non nella sfida del villaggio, che al suo posto toglie tempo al cantiere). Non ci sono stelle: una
// battaglia vinta resta vinta, non c'è niente da rigiocare
export const DROPS = {
  grunt: [{ kind: 'materials', chance: 0.1, amount: 1 }],
  fast: [{ kind: 'materials', chance: 0.1, amount: 1 }],
  armored: [{ kind: 'materials', chance: 0.25, amount: 1 }],
  shooter: [{ kind: 'materials', chance: 0.25, amount: 1 }],
  swarm: [{ kind: 'materials', chance: 0.02, amount: 1 }],
  elite: [
    { kind: 'materials', chance: 0.7, amount: 3 },
    { kind: 'xp', chance: 0.5, amount: 20 },
    { kind: 'fragments', chance: 0.2, amount: 1 },
    { kind: 'scrap', chance: 0.4, amount: 1 },
  ],
  boss: [
    { kind: 'materials', chance: 1, amount: 12 },
    { kind: 'xp', chance: 1, amount: 80 },
    { kind: 'fragments', chance: 1, amount: 3 },
    { kind: 'scrap', chance: 1, amount: 3 },
    { kind: 'accelerators', chance: 0.25, amount: 1 },
  ],
};

export const REWARDS = {
  defeatShare: 0.5,
  victory: { materials: 10, xp: 80, dogTags: 3 },
};
