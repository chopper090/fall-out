import * as Phaser from 'phaser';
import { artKey } from '../view/art.js';
import { pawnArtSize } from '../view/pawns.js';
import { worldArtSize } from '../view/worldAtlas.js';

// I disegni del gioco, trovati da Vite: src/art/<gruppo>/<nome>.svg (docs/GRAFICA.md), sempre come file a sé
// (no-inline): Vite incorporerebbe i più piccoli come testo, che Phaser non sa caricare
const FILES = import.meta.glob('../art/*/*.svg', { query: '?no-inline', import: 'default', eager: true });
// La misura in pixel del riquadro di un disegno, per gruppo (null: nessun riquadro con quel nome)
const SIZES = {
  pawns: pawnArtSize,
  buildings: (name) => worldArtSize('buildings', name),
  markers: (name) => worldArtSize('markers', name),
};

// Prima scena: carica i disegni veri, ognuno alla misura del suo riquadro negli atlanti, che li disegnano al posto
// delle figure fatte dal codice (view/art.js); poi apre il mondo. Un file che non corrisponde a nessun riquadro non si
// carica (lo controlla tests/unit/art.test.js)
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    for (const [path, url] of Object.entries(FILES)) {
      const [group, file] = path.split('/').slice(-2);
      const name = file.replace(/\.svg$/, '');
      const size = SIZES[group]?.(name) ?? null;
      if (size !== null) this.load.svg(artKey(group, name), url, size);
    }
  }

  create() {
    this.scene.start('World');
  }
}
