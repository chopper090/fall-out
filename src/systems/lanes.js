// Geometria delle corsie: logica pura, senza grafica
export function createLanes(count, fieldWidth, fieldHeight) {
  const width = fieldWidth / count;
  return Array.from({ length: count }, (_, index) => ({
    x: index * width,
    y: 0,
    width,
    height: fieldHeight,
  }));
}
