// Dividere count unità intere tra parti con i pesi weights, in proporzione: a ognuna la parte intera, e quelle che
// restano a chi ha il resto più grande (a pari resto la prima). Restituisce quante per parte, nell'ordine dei pesi;
// senza pesi positivi nessuna
export function apportion(weights, count) {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (total === 0) return weights.map(() => 0);
  const parts = weights.map((weight) => {
    const exact = (Math.max(0, weight) / total) * count;
    return { count: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = count - parts.reduce((sum, part) => sum + part.count, 0);
  for (const part of [...parts].sort((a, b) => b.rest - a.rest)) {
    if (left === 0) break;
    part.count += 1;
    left -= 1;
  }
  return parts.map((part) => part.count);
}
