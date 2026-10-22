import { MISSION } from '../config/balance.js';
import { EVENTS } from '../core/events.js';

// Missione: fallisce se muore l'eroe o se MISSION.maxEscaped nemici superano l'esercito
export function createMission(bus) {
  const mission = { escaped: 0, failed: false };
  const fail = () => {
    if (mission.failed) return;
    mission.failed = true;
    bus.emit(EVENTS.MISSION_FAILED, mission);
  };
  bus.on(EVENTS.ENEMY_ESCAPED, () => {
    mission.escaped += 1;
    if (mission.escaped >= MISSION.maxEscaped) fail();
  });
  bus.on(EVENTS.HERO_KILLED, fail);
  return mission;
}
