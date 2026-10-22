// Pool di oggetti riutilizzabili: durante la partita si riusano invece di crearne di nuovi
export function createPool(create, initialSize) {
  const free = Array.from({ length: initialSize }, create);
  return {
    acquire() {
      return free.pop() ?? create();
    },
    release(item) {
      free.push(item);
    },
  };
}
