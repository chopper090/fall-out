// Geometria delle corsie nel mondo (larghezze lungo x): logica pura, senza grafica
export function createLanes(count, fieldWidth) {
  const width = fieldWidth / count;
  return Array.from({ length: count }, (_, index) => ({
    x: index * width,
    width,
    centerX: index * width + width / 2,
  }));
}
