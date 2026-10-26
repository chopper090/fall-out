// Aiuti per disegnare sul canvas 2D degli atlanti (view/pawns.js, view/worldAtlas.js) e per il colore delle scritte

// Un colore 0xrrggbb come lo vuole il canvas: "#rrggbb"
export function hex(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

// Un poligono pieno del colore color, dai punti { x, y }
export function fillPolygon(ctx, color, points) {
  ctx.fillStyle = hex(color);
  ctx.beginPath();
  points.forEach(({ x, y }, index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
}
