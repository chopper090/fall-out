// Geometria delle corsie nel mondo (larghezze lungo x): logica pura, senza grafica
export function createLanes(count, fieldWidth) {
  const width = fieldWidth / count;
  return Array.from({ length: count }, (_, index) => ({
    x: index * width,
    width,
    centerX: index * width + width / 2,
  }));
}

// La corsia (da 0) in cui sta x, tra count corsie larghe fieldWidth in tutto; fuori dal campo, quella del bordo
export function laneAt(x, count, fieldWidth) {
  return Math.min(count - 1, Math.max(0, Math.floor((x * count) / fieldWidth)));
}
