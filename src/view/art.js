// I disegni veri del gioco (stile «Latta e sole», docs/GRAFICA.md): file SVG in src/art/<gruppo>/<nome>.svg, che la
// scena Preload carica all'avvio come texture con la chiave artKey, alla misura in pixel del riquadro che prendono
// negli atlanti (view/pawns.js, view/worldAtlas.js). Gli atlanti mettono il disegno al posto della figura fatta dal
// codice; senza il file resta quella, così i pezzi si sostituiscono uno alla volta
export function artKey(group, name) {
  return `art:${group}/${name}`;
}

// L'immagine del disegno del gruppo group per il primo dei nomi names che ne ha uno (un eroe: il suo, poi quello della
// sua categoria); null se nessuno
export function artImage(textures, group, names) {
  const name = names.find((candidate) => textures.exists(artKey(group, candidate)));
  return name === undefined ? null : textures.get(artKey(group, name)).getSourceImage();
}
