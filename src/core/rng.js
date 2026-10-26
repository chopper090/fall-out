const UINT32_RANGE = 4294967296;

// Generatore casuale con seme (mulberry32): a parità di seme dà sempre la stessa sequenza
export function createRng(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
  return {
    // Intero tra 0 e max - 1
    int(max) {
      return Math.floor(next() * max);
    },
    // Numero con la virgola tra 0 (compreso) e 1 (escluso)
    float() {
      return next();
    },
    // Una voce a caso tra le coppie [voce, peso], in proporzione al peso
    pick(weighted) {
      const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = next() * total;
      for (const [item, weight] of weighted) {
        if (roll < weight) return item;
        roll -= weight;
      }
      return weighted[weighted.length - 1][0];
    },
    // La lista items mescolata sul posto (Fisher-Yates), e restituita
    shuffle(items) {
      for (let index = items.length - 1; index > 0; index--) {
        const other = Math.floor(next() * (index + 1));
        [items[index], items[other]] = [items[other], items[index]];
      }
      return items;
    },
  };
}
