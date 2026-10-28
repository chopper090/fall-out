import * as Phaser from 'phaser';
import { HUD } from '../config/balance.js';
import { drawGearButton } from './hudButtons.js';

// Pulsante arrotondato delle schermate fuori dalla battaglia (schieramento, eroi): largo width e alto height intorno a
// (x, y), del colore color, con la scritta al centro (dello stile style, di partenza HUD.screenButton.style); agisce
// quando il dito si appoggia e si alza sopra di lui (non se si era appoggiato altrove, magari nella schermata prima, né
// se il telefono annulla il tocco). Spento (enabled false) è più trasparente e non agisce. Con hitWidth e hitHeight il
// posto da toccare, con lo stesso centro, è più grande di quello disegnato (per il dito, su un telefono piccolo)
export function addButton(scene, spec) {
  drawButton(scene, spec);
  addTapZone(scene, spec);
}

// L'ingranaggio delle impostazioni con il centro in (x, y), rotondo come in battaglia (scenes/hudButtons.js): agisce
// come i pulsanti di addButton
export function addGearButton(scene, { x, y, onTap }) {
  drawGearButton(scene.add.graphics(), { x, y });
  addTapZone(scene, { ...gearRect(x, y), onTap });
}

// Pulsanti uguali a quelli di addButton per una scena che sta sopra un'altra che deve ricevere i tocchi (l'interfaccia
// del mondo): non sono oggetti interattivi di Phaser, che terrebbero per sé i tocchi; ognuno agisce se il dito si
// appoggia e si alza sopra di lui (non se il telefono annulla il tocco). Rettangoli { x, y, width, height } intorno al
// centro: area è un posto da toccare senza disegno, gear l'ingranaggio di addGearButton, block un riquadro che non fa
// niente. Tutti coprono la scena sotto: covers dice se un punto dello schermo ci cade sopra
export function createButtonBoard(scene) {
  let buttons = [];
  let blocks = [];
  scene.input.on(Phaser.Input.Events.POINTER_UP, (pointer) => {
    if (pointer.wasCanceled) return;
    const pressed = (button) =>
      inside(hitRect(button), pointer.downX, pointer.downY) && inside(hitRect(button), pointer.x, pointer.y);
    buttons.find((button) => button.enabled !== false && pressed(button))?.onTap();
  });
  return {
    add(spec) {
      drawButton(scene, spec);
      buttons.push(spec);
    },
    area(spec) {
      buttons.push(spec);
    },
    gear({ x, y, onTap }) {
      drawGearButton(scene.add.graphics(), { x, y });
      buttons.push({ ...gearRect(x, y), onTap });
    },
    block(rect) {
      blocks.push(rect);
    },
    clear() {
      buttons = [];
      blocks = [];
    },
    covers(x, y) {
      return buttons.some((button) => inside(hitRect(button), x, y)) || blocks.some((block) => inside(block, x, y));
    },
  };
}

// Il posto da toccare di un pulsante di addButton (spec: il rettangolo intorno al centro, onTap ed enabled): agisce se
// il dito si appoggia e si alza sopra di lui. Anche da solo, per un posto da toccare disegnato a parte
export function addTapZone(scene, spec) {
  const { onTap, enabled = true } = spec;
  const hit = hitRect(spec);
  const zone = scene.add.zone(hit.x, hit.y, hit.width, hit.height).setInteractive();
  const pressed = (pointer) => !pointer.wasCanceled && inside(hit, pointer.downX, pointer.downY);
  if (enabled) zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer) => pressed(pointer) && onTap());
}

// Il rettangolo da toccare del pulsante spec: quello disegnato, o largo hitWidth e alto hitHeight se li ha
function hitRect({ x, y, width, height, hitWidth = width, hitHeight = height }) {
  return { x, y, width: hitWidth, height: hitHeight };
}

// Il quadrato da toccare per l'ingranaggio con il centro in (x, y), largo quanto il suo cerchio
function gearRect(x, y) {
  const size = HUD.buttons.radius * 2;
  return { x, y, width: size, height: size };
}

// Il punto (x, y) cade nel rettangolo rect, largo width e alto height intorno al suo centro (x, y)
function inside(rect, x, y) {
  return Math.abs(x - rect.x) <= rect.width / 2 && Math.abs(y - rect.y) <= rect.height / 2;
}

// Il disegno di un pulsante di addButton, senza il posto da toccare (per le liste che scorrono, scenes/scrollArea.js):
// la scritta più larga del pulsante (meno HUD.screenButton.padding per lato) si stringe
export function drawButton(
  scene,
  { x, y, width, height, label, color, enabled = true, style = HUD.screenButton.style },
) {
  const { radius, disabledAlpha, padding } = HUD.screenButton;
  const alpha = enabled ? 1 : disabledAlpha;
  const graphics = scene.add.graphics();
  graphics.fillStyle(color, alpha);
  graphics.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
  const text = scene.add.text(x, y, label, style).setOrigin(0.5).setAlpha(alpha);
  text.setScale(Math.min(1, (width - 2 * padding) / text.width));
}
