import { readFileSync } from 'node:fs';
import { DEBUG } from '../config/balance.js';
import { playReplay, replayDifference } from '../systems/replay.js';

// Rigioca senza grafica una battaglia registrata nel gioco (systems/replay.js; dal pannello di sviluppo con Copia
// l'ultima battaglia, salvata in un file): npm run replay -- file.json. Scrive da dove viene, poi ok se torna uguale,
// altrimenti la prima differenza, ed esce con 1. Legge anche i formati di prima, che hanno solo meno comandi
const [file] = process.argv.slice(2);
if (file === undefined) throw new Error('quale battaglia? npm run replay -- file.json');
const replay = JSON.parse(readFileSync(file, 'utf8'));
const { format } = DEBUG.replay;
if (!Number.isInteger(replay.format) || replay.format < 1 || replay.format > format) {
  throw new Error(`battaglia nel formato ${replay.format}: questa versione legge fino al ${format}`);
}

const { version, commit, seed, frames, inputs, tweaks } = replay;
const tweaked = Object.keys(tweaks).join(', ') || 'nessuno';
console.log(`battaglia di v${version} · ${commit}, seme ${seed}: ${frames.length} frame, ${inputs.length} comandi`);
console.log(`ritocchi: ${tweaked}`);
const played = playReplay(replay);
if (played.unknown.length > 0) console.log(`ritocchi che questa versione non conosce: ${played.unknown.join(', ')}`);
const difference = replayDifference(replay, played);
const json = (value) => JSON.stringify(value);
const { result } = replay;
const ending = (completed) => (completed ? 'compiuta' : 'fallita');
const outcome = result === null ? 'non finita' : `${ending(result.completed)} all'ondata ${result.wave}`;
console.log(
  difference === null
    ? `ok: rigiocata uguale, ${outcome}`
    : `diversa: ${difference.path} è ${json(difference.actual)} invece di ${json(difference.expected)}`,
);
process.exitCode = difference === null ? 0 : 1;
