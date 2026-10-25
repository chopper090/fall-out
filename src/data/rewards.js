// Premi delle battaglie. drops: cosa lascia cadere in strada chi muore, per tipo di nemico (gli altri niente; sono le
// chiavi di ENEMY_TYPES, data/enemies.js): ogni premio esce con la sua probabilità (chance) e vale amount. Tipi:
// materials (materiali), xp (esperienza, divisa tra gli eroi schierati), fragments (frammenti di un eroe schierato a
// caso). Lo prende l'esercito che ci passa sopra (systems/loot.js).
// Alla fine (meta/rewards.js) chi perde tiene defeatShare del raccolto, per difetto; chi vince lo tiene tutto e prende
// il premio della vittoria (victory). Non ci sono stelle: una battaglia vinta resta vinta, non c'è niente da rigiocare
export const DROPS = {
  elite: [
    { kind: 'materials', chance: 0.7, amount: 3 },
    { kind: 'xp', chance: 0.5, amount: 20 },
    { kind: 'fragments', chance: 0.2, amount: 1 },
  ],
  boss: [
    { kind: 'materials', chance: 1, amount: 12 },
    { kind: 'xp', chance: 1, amount: 80 },
    { kind: 'fragments', chance: 1, amount: 3 },
  ],
};

export const REWARDS = {
  defeatShare: 0.5,
  victory: { materials: 10, xp: 80 },
};
