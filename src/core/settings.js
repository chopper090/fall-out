import { SETTINGS } from '../config/balance.js';

// Impostazioni del giocatore salvate sul telefono, con la versione del formato. Se il salvataggio manca,
// è di un'altra versione o il browser non permette di salvare, restano i valori di partenza
export function loadSettings() {
  const saved = readSaved();
  if (saved?.version !== SETTINGS.version) return;
  for (const entry of SETTINGS.entries) {
    const value = saved.values?.[entry.id];
    if (isValid(entry, value)) entry.target[entry.key] = value;
  }
}

export function saveSettings() {
  const values = Object.fromEntries(SETTINGS.entries.map((entry) => [entry.id, entry.target[entry.key]]));
  try {
    localStorage.setItem(SETTINGS.storageKey, JSON.stringify({ version: SETTINGS.version, values }));
  } catch {
    // Salvataggio non permesso: le impostazioni valgono finché la pagina resta aperta
  }
}

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS.storageKey));
  } catch {
    return null;
  }
}

// Le voci a passi accettano numeri dentro i loro limiti, gli interruttori solo sì o no
function isValid(entry, value) {
  if (entry.min === undefined) return typeof value === 'boolean';
  return typeof value === 'number' && value >= entry.min && value <= entry.max;
}
