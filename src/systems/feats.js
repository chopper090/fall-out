import { EVENTS } from '../core/events.js';

// Imprese della battaglia, per le missioni del giorno (meta/daily.js): i nemici abbattuti (da chiunque), gli scrigni
// aperti e le porte negative girate e prese (un cancello che toglieva soldati, preso quando ne dà)
export function createFeats(bus) {
  const feats = { kills: 0, chests: 0, flips: 0 };
  bus.on(EVENTS.ENEMY_KILLED, () => {
    feats.kills += 1;
  });
  bus.on(EVENTS.CHEST_OPENED, () => {
    feats.chests += 1;
  });
  bus.on(EVENTS.GATE_PASSED, (gate) => {
    if (gate.kind.malus && gate.value > 0) feats.flips += 1;
  });
  return feats;
}
