import { test } from 'node:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { checker } from '../support/check.js';
import { ENEMY_TYPES } from '../../src/data/enemies.js';
import { CATEGORIES, HEROES } from '../../src/data/heroes.js';
import { WEAPONS } from '../../src/data/units.js';
import { VILLAGE } from '../../src/data/village.js';
import { WORLD_VIEW } from '../../src/config/balance.js';
import { categoryFrame, heroFrame, pawnArtSize, soldierFrame } from '../../src/view/pawns.js';
import { siteFrame, worldArtSize } from '../../src/view/worldAtlas.js';

const ART = new URL('../../src/art/', import.meta.url);
const SIZES = {
  pawns: pawnArtSize,
  buildings: (n) => worldArtSize('buildings', n),
  markers: (n) => worldArtSize('markers', n),
};
// Quello che un disegno non può avere (docs/GRAFICA.md): filtri, maschere, testo, CSS, immagini e script, che sui
// telefoni Android si disegnano male o non si disegnano; e niente indirizzi esterni
const FORBIDDEN = /<(filter|mask|text|style|image|foreignObject|script)\b|href="https?:/i;
// Di quanto le proporzioni del viewBox possono scostarsi da quelle del riquadro (i riquadri arrotondano i pixel: lo
// sciame si scosta del 2%), e quanto può pesare un file per gruppo, in byte
const MAX_RATIO_ERROR = 0.03;
const MAX_BYTES = { pawns: 10_000, buildings: 25_000, markers: 10_000 };

// L1. Ogni riquadro che può avere un disegno vero ha la sua misura: le pedine (anche i disegni delle categorie di
// eroi), gli edifici con i loro cantieri e i segni della strada; un nome che non è un riquadro non ne ha
test('L1. Ogni riquadro delle pedine, degli edifici e della strada ha la misura del suo disegno', (t) => {
  const check = checker(t);
  const pawns = [
    ...Object.keys(WEAPONS).map(soldierFrame),
    ...Object.values(HEROES).map(heroFrame),
    ...Object.keys(ENEMY_TYPES),
    ...Object.keys(CATEGORIES).map(categoryFrame),
  ];
  const missingPawns = pawns.filter((name) => pawnArtSize(name) === null);
  const buildings = Object.keys(VILLAGE.buildings).flatMap((id) => [id, siteFrame(id)]);
  const missingBuildings = buildings.filter((name) => worldArtSize('buildings', name) === null);
  const markers = Object.keys(WORLD_VIEW.road.markers);
  const missingMarkers = markers.filter((name) => worldArtSize('markers', name) === null);
  const hero = pawnArtSize(categoryFrame('command'));
  check(
    `pedine ${pawns.length} (senza misura: ${missingPawns.join() || 'nessuna'}), edifici e cantieri ${buildings.length} (${missingBuildings.join() || 'nessuno'}), segni ${markers.length} (${missingMarkers.join() || 'nessuno'}); disegno di una categoria ${JSON.stringify(hero)}; nome sconosciuto ${pawnArtSize('nessuno')}, ${worldArtSize('buildings', 'nessuno')}`,
    missingPawns.length === 0 &&
      missingBuildings.length === 0 &&
      missingMarkers.length === 0 &&
      hero.width > 0 &&
      pawnArtSize('nessuno') === null &&
      worldArtSize('buildings', 'nessuno') === null,
  );
  check.done();
});

// L1. Ogni file in src/art sta nella cartella di un gruppo ed è il disegno di un riquadro che esiste (se no il gioco
// non lo carica); non ha elementi vietati; il suo viewBox ha le proporzioni del riquadro (se no il disegno si
// rimpicciolisce e i piedi lasciano il punto d'appoggio) e il file resta leggero (docs/GRAFICA.md)
test('L1. I disegni in src/art corrispondono a un riquadro e rispettano le regole', (t) => {
  const check = checker(t);
  const top = existsSync(ART) ? readdirSync(ART, { withFileTypes: true }) : [];
  const loose = top.filter((d) => !d.isDirectory()).map((d) => ({ group: '', file: d.name, isFile: d.isFile() }));
  const inGroups = top
    .filter((d) => d.isDirectory())
    .flatMap((dir) =>
      readdirSync(new URL(`${dir.name}/`, ART), { withFileTypes: true }).map((d) => ({
        group: dir.name,
        file: d.name,
        isFile: d.isFile(),
      })),
    );
  const files = [...loose, ...inGroups];
  const sizeOf = ({ group, file }) => SIZES[group]?.(file.replace(/\.svg$/, '')) ?? null;
  const unknown = files.filter((f) => !f.group || !f.isFile || !f.file.endsWith('.svg') || sizeOf(f) === null);
  const known = files.filter((f) => !unknown.includes(f));
  const text = (f) => readFileSync(new URL(`${f.group}/${f.file}`, ART), 'utf8');
  const broken = known.filter((f) => FORBIDDEN.test(text(f)));
  const squeezed = known.filter((f) => {
    const box = text(f).match(/viewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
    const size = sizeOf(f);
    return box === null || Math.abs(box[1] / box[2] / (size.width / size.height) - 1) > MAX_RATIO_ERROR;
  });
  const heavy = known.filter((f) => statSync(new URL(`${f.group}/${f.file}`, ART)).size > MAX_BYTES[f.group]);
  const names = (list) =>
    list.map(({ group, file }) => `${group || '(nessun gruppo)'}/${file}`).join(', ') || 'nessuno';
  check(
    `disegni ${files.length}; senza riquadro: ${names(unknown)}; con elementi vietati: ${names(broken)}; viewBox senza le proporzioni del riquadro: ${names(squeezed)}; troppo pesanti: ${names(heavy)}`,
    unknown.length === 0 && broken.length === 0 && squeezed.length === 0 && heavy.length === 0,
  );
  check.done();
});
