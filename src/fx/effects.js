// Timer legati a un oggetto (nemico, scrigno, soldato): si consumano e spariscono a zero
export function countDown(timers, deltaMs) {
  timers.forEach((remainingMs, item) => {
    if (remainingMs <= deltaMs) timers.delete(item);
    else timers.set(item, remainingMs - deltaMs);
  });
}

// Effetti di una lista, tutti con la stessa durata, spostati in avanti di step a ogni frame (0: restano dove sono
// nati, o non hanno un posto sul campo). I più vecchi finiscono per primi e tornano nella loro pool
export function ageEffects(items, pool, deltaMs, durationMs, step = 0) {
  for (const item of items) {
    item.elapsedMs += deltaMs;
    if (step !== 0) item.z -= step;
  }
  while (items.length > 0 && items[0].elapsedMs >= durationMs) pool.release(items.shift());
}
