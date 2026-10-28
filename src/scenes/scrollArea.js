import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { drawButton } from './buttons.js';

const { POINTER_DOWN, POINTER_MOVE, POINTER_UP, POINTER_WHEEL, GAMEOBJECT_POINTER_UP } = Phaser.Input.Events;

// Una lista che scorre in verticale nel rettangolo view della schermata ({ x, y, width, height }, angolo in alto a
// sinistra), per le schermate che si ridisegnano tutte a ogni tocco (eroi, Catalogo). Una seconda camera grande quanto
// view mostra solo le voci, quella principale tutto il resto; trascinando il dito dentro view (o con la rotella) la
// lista si sposta tra il suo inizio e la sua fine, e resta dov'era quando la schermata si ridisegna. Le voci si
// disegnano dove starebbero con la lista all'inizio, tra begin ed end; dopo l'ultimo disegno della schermata, finish.
// Un tocco su una voce (tapZone, button) vale solo se il dito si è mosso al massimo di HUD.scroll.tapSlop: altrimenti
// era un trascinamento
export function createScrollArea(scene, view) {
  const camera = scene.cameras.add(view.x, view.y, view.width, view.height);
  const state = { scroll: 0, content: 0, drag: null, mark: 0, items: null };
  const inView = (pointer) =>
    pointer.x >= view.x && pointer.x <= view.x + view.width && pointer.y >= view.y && pointer.y <= view.y + view.height;
  const place = () => {
    state.scroll = Phaser.Math.Clamp(state.scroll, 0, Math.max(0, state.content - view.height));
    camera.setScroll(view.x, view.y + state.scroll);
  };
  scene.input.on(POINTER_DOWN, (pointer) => {
    state.drag = camera.visible && inView(pointer) ? { y: pointer.y, scroll: state.scroll } : null;
  });
  scene.input.on(POINTER_MOVE, (pointer) => {
    if (state.drag === null || !pointer.isDown) return;
    state.scroll = state.drag.scroll - (pointer.y - state.drag.y);
    place();
  });
  scene.input.on(POINTER_UP, () => {
    state.drag = null;
  });
  scene.input.on(POINTER_WHEEL, (pointer, over, dx, dy) => {
    if (!camera.visible || !inView(pointer)) return;
    state.scroll += dy;
    place();
  });
  const still = (pointer) =>
    !pointer.wasCanceled && Math.hypot(pointer.x - pointer.downX, pointer.y - pointer.downY) <= HUD.scroll.tapSlop;
  return {
    // Da qui gli oggetti nuovi della scena sono voci della lista
    begin() {
      state.mark = scene.children.list.length;
    },
    // Fin qui le voci, in una lista alta content: la mostra solo questa camera, e lo spostamento resta nei limiti
    end(content) {
      state.items = scene.add.container(0, 0, scene.children.list.slice(state.mark));
      state.content = content;
      place();
    },
    // Dopo l'ultimo disegno: tutto il resto lo mostra solo la camera principale
    finish() {
      scene.cameras.main.ignore(state.items);
      camera.ignore(scene.children.list.filter((object) => object !== state.items));
    },
    // Il posto da toccare (rettangolo intorno al centro) di una voce: onTap se il dito non si è mosso
    tapZone({ x, y, width, height }, onTap) {
      const zone = scene.add.zone(x, y, width, height).setInteractive();
      zone.on(GAMEOBJECT_POINTER_UP, (pointer) => still(pointer) && onTap());
    },
    // Un pulsante come quelli di addButton (scenes/buttons.js) dentro la lista
    button(spec) {
      drawButton(scene, spec);
      const { enabled = true, onTap } = spec;
      if (enabled) this.tapZone(spec, onTap);
    },
    // La lista si vede e si tocca (sotto un dettaglio aperto no)
    show(visible) {
      camera.setVisible(visible);
    },
    // Torna all'inizio della lista (per esempio cambiando filtro)
    rewind() {
      state.scroll = 0;
      place();
    },
  };
}
