import * as Phaser from 'phaser';
import { LANES } from '../config/balance.js';
import { createLanes } from '../systems/lanes.js';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create() {
    const lanes = createLanes(LANES.count, this.scale.width, this.scale.height);
    lanes.forEach((lane, index) => this.drawLane(lane, index));
  }

  drawLane({ x, y, width, height }, index) {
    const color = LANES.colors[index % LANES.colors.length];
    this.add.rectangle(x, y, width, height, color).setOrigin(0);
  }
}
