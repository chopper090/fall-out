import * as Phaser from 'phaser';
import { FIELD, HERO, LANES } from '../config/balance.js';
import { createEventBus, EVENTS } from '../core/events.js';
import { createLanes } from '../systems/lanes.js';
import { createArmy, updateArmy } from '../systems/army.js';
import { createScroll, updateScroll } from '../systems/scroll.js';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create() {
    const { width, height } = this.scale;
    const lanes = createLanes(LANES.count, width, height);
    lanes.forEach((lane, index) => this.drawLane(lane, index));

    this.scroll = createScroll();
    this.dashColumns = this.createDashColumns(lanes, height);

    const bus = createEventBus();
    this.army = createArmy(bus, {
      startX: lanes[HERO.startLane].centerX,
      laneCenters: lanes.map((lane) => lane.centerX),
    });
    this.hero = this.add.rectangle(this.army.x, height - HERO.bottomOffset, HERO.size, HERO.size, HERO.color);

    // Swipe: lo spostamento orizzontale del dito, ovunque sullo schermo, sposta l'eroe
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer) => {
      if (pointer.isDown) bus.emit(EVENTS.STEER, pointer.x - pointer.prevPosition.x);
    });
    const endSteer = () => bus.emit(EVENTS.STEER_END);
    this.input.on(Phaser.Input.Events.POINTER_UP, endSteer);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, endSteer);
  }

  update(time, delta) {
    updateScroll(this.scroll, delta);
    this.placeDashes();
    updateArmy(this.army, delta);
    this.hero.x = this.army.x;
  }

  drawLane({ x, y, width, height }, index) {
    const color = LANES.colors[index % LANES.colors.length];
    this.add.rectangle(x, y, width, height, color).setOrigin(0);
  }

  // Una colonna di trattini su ogni confine tra corsie, quanti ne servono a coprire il campo
  createDashColumns(lanes, height) {
    const { length, gap, width, color } = FIELD.dash;
    const rows = Math.ceil(height / (length + gap)) + 1;
    return lanes.slice(1).map((lane) =>
      Array.from({ length: rows }, () => this.add.rectangle(lane.x, 0, width, length, color).setOrigin(0.5, 0)),
    );
  }

  // I trattini scendono con il campo: quelli usciti in basso rientrano dall'alto
  placeDashes() {
    const period = FIELD.dash.length + FIELD.dash.gap;
    const offset = this.scroll.distance % period;
    this.dashColumns.forEach((column) =>
      column.forEach((dash, row) => {
        dash.y = row * period + offset - period;
      }),
    );
  }
}
