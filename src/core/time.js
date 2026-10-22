const MS_PER_SECOND = 1000;

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
