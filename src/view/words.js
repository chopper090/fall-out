import { HUD, LOOT } from '../config/balance.js';
import { splitDuration } from '../core/time.js';

// Una quantità di bottino con la sua parola, al singolare per uno (LOOT.one) e al plurale altrimenti (LOOT.words):
// "12 materiali", "1 frammento", o con un segno davanti ("+3 materiali")
export function amountText(kind, amount, sign = '') {
  const word = amount === 1 ? LOOT.one[kind] : LOOT.words[kind];
  return `${sign}${amount} ${word}`;
}

// Una durata con le sue due unità più grandi: "1 h 20 min", "4 min 12 s", "45 s" (con HUD.village.units)
export function durationText(ms) {
  const { hours, minutes, seconds } = splitDuration(ms);
  const { hour, minute, second } = HUD.village.units;
  if (hours > 0) return minutes > 0 ? `${hours} ${hour} ${minutes} ${minute}` : `${hours} ${hour}`;
  if (minutes > 0) return seconds > 0 ? `${minutes} ${minute} ${seconds} ${second}` : `${minutes} ${minute}`;
  return `${seconds} ${second}`;
}
