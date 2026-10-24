// Tipi di cancello: danno o tolgono soldati, sempre lo stesso numero, quello che gli dà l'ondata (data/waves.js);
// i colpi li attraversano. plus dà soldati, minus li toglie: malus, rosso, da evitare. La potenza di fuoco la danno
// gli scrigni (data/chests.js)
export const GATE_KINDS = {
  plus: { malus: false },
  minus: { malus: true },
};
