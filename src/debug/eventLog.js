import { DEBUG } from '../config/balance.js';

// Il registro degli eventi della battaglia, per il registro degli errori (core/errorLog.js): sul bus della battaglia
// (tap, core/events.js) sente ogni evento prima dei sistemi e tiene gli ultimi DEBUG.eventLog.size, ognuno con il frame
// della battaglia, il nome e fino a DEBUG.eventLog.fields valori semplici di quello che porta (numeri, scritte, sì o
// no), con il loro nome. Quello che porta un evento è spesso un oggetto riusato (un nemico, un colpo: core/pool.js):
// se ne copiano i valori, mai l'oggetto. Le caselle si riusano, così a ogni evento non nasce niente
export function createEventLog() {
  const { size, fields } = DEBUG.eventLog;
  const slots = Array.from({ length: size }, () => []);
  let next = 0;
  let count = 0;
  let battle = null;
  return {
    // La battaglia di cui contare i frame (null: frame 0, mentre una nuova si crea)
    watch(current) {
      battle = current;
    },
    tap(name, payload) {
      const slot = slots[next];
      slot.length = 0;
      slot.push(battle === null ? 0 : battle.frame, name);
      if (isSimple(payload)) slot.push(payload);
      else if (typeof payload === 'object' && payload !== null) copyFields(slot, payload, fields);
      next = (next + 1) % size;
      count = Math.min(count + 1, size);
    },
    // Gli eventi tenuti, dal più vecchio: [frame, nome], [frame, nome, valore] o [frame, nome, { campo: valore }]
    entries() {
      const first = (next - count + size) % size;
      return Array.from({ length: count }, (_, index) => entryOf(slots[(first + index) % size]));
    },
  };
}

// I primi max valori semplici di payload, ognuno dopo il suo nome
function copyFields(slot, payload, max) {
  let kept = 0;
  for (const key in payload) {
    if (kept === max) return;
    const value = payload[key];
    if (!isSimple(value)) continue;
    slot.push(key, value);
    kept += 1;
  }
}

// Una casella com'è da leggere: dopo frame e nome un valore solo (l'evento portava quello) o le coppie nome e valore
function entryOf(slot) {
  const [frame, name, ...rest] = slot;
  if (rest.length === 1) return [frame, name, rest[0]];
  if (rest.length === 0) return [frame, name];
  const values = {};
  for (let index = 0; index < rest.length; index += 2) values[rest[index]] = rest[index + 1];
  return [frame, name, values];
}

function isSimple(value) {
  return typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean';
}
