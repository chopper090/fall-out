const MS_PER_SECOND = 1000;

// Quanto cambia in questo frame un valore espresso "al secondo"
export function perFrame(ratePerSecond, deltaMs) {
  return (ratePerSecond * deltaMs) / MS_PER_SECOND;
}
