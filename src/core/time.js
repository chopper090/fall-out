const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_HOUR = MS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const HOURS_PER_DAY = 24;
const MS_PER_DAY = MS_PER_HOUR * HOURS_PER_DAY;

// Quanto cambia in questo frame un valore espresso "al secondo"
export function perFrame(ratePerSecond, deltaMs) {
  return (ratePerSecond * deltaMs) / MS_PER_SECOND;
}

// Millisecondi tra due eventi che avvengono ratePerSecond volte al secondo
export function periodMs(ratePerSecond) {
  return MS_PER_SECOND / ratePerSecond;
}

export function secondsToMs(seconds) {
  return seconds * MS_PER_SECOND;
}

export function msToSeconds(ms) {
  return ms / MS_PER_SECOND;
}

export function minutesToMs(minutes) {
  return minutes * SECONDS_PER_MINUTE * MS_PER_SECOND;
}

export function msToMinutes(ms) {
  return ms / (SECONDS_PER_MINUTE * MS_PER_SECOND);
}

export function msToHours(ms) {
  return ms / MS_PER_HOUR;
}

export function hoursToMs(hours) {
  return hours * MS_PER_HOUR;
}

// Ore, minuti e secondi interi di una durata (i secondi per eccesso: a 0,2 s dalla fine manca ancora 1 s)
export function splitDuration(ms) {
  const total = Math.ceil(ms / MS_PER_SECOND);
  const minutes = Math.floor(total / SECONDS_PER_MINUTE);
  return {
    hours: Math.floor(minutes / MINUTES_PER_HOUR),
    minutes: minutes % MINUTES_PER_HOUR,
    seconds: total % SECONDS_PER_MINUTE,
  };
}

// Il numero del giorno dell'istante ms con l'ora del telefono: sale di uno a ogni mezzanotte
export function localDay(ms) {
  const date = new Date(ms);
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

// Il numero del giorno dell'istante ms senza fuso orario (a mezzanotte UTC): per il simulatore, uguale dappertutto
export function utcDay(ms) {
  return Math.floor(ms / MS_PER_DAY);
}

// La prossima mezzanotte dopo l'istante ms, con l'ora del telefono
export function nextMidnight(ms) {
  const date = new Date(ms);
  date.setHours(HOURS_PER_DAY, 0, 0, 0);
  return date.getTime();
}
