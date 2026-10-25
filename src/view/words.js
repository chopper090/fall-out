import { LOOT } from '../config/balance.js';

// Una quantità di bottino con la sua parola, al singolare per uno (LOOT.one) e al plurale altrimenti (LOOT.words):
// "12 materiali", "1 frammento", o con un segno davanti ("+3 materiali")
export function amountText(kind, amount, sign = '') {
  const word = amount === 1 ? LOOT.one[kind] : LOOT.words[kind];
  return `${sign}${amount} ${word}`;
}
