const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_HOUR = MS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR;

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
