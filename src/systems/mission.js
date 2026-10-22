import { MISSION } from '../config/balance.js';
import { EVENTS } from '../core/events.js';

// Missione: fallisce se muore l'eroe o se MISSION.maxEscaped nemici superano l'esercito (uno sciame conta uno);
// è compiuta quando il livello è completato. Finisce una volta sola, nel primo dei due modi
export function createMission(bus) {
  const mission = { escaped: 0, failed: false, completed: false };
  const over = () => mission.failed || mission.completed;
  const fail = () => {
    if (over()) return;
    mission.failed = true;
    bus.emit(EVENTS.MISSION_FAILED, mission);
  };
  bus.on(EVENTS.ENEMY_ESCAPED, ({ counted }) => {
    if (!counted) return;
    mission.escaped += 1;
    if (mission.escaped >= MISSION.maxEscaped) fail();
  });
  bus.on(EVENTS.HERO_KILLED, fail);
  bus.on(EVENTS.LEVEL_COMPLETED, () => {
    if (over()) return;
    mission.completed = true;
    bus.emit(EVENTS.MISSION_COMPLETED, mission);
  });
  return mission;
}
