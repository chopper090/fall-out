import * as Phaser from 'phaser';
import { HERO, LANES } from '../config/balance.js';
import { createEventBus, EVENTS } from '../core/events.js';
import { createRng } from '../core/rng.js';
import { createLanes } from '../systems/lanes.js';
import { createArmy, updateArmy } from '../systems/army.js';
import { createScroll, updateScroll } from '../systems/scroll.js';
import { clashEnemies, createSpawner, updateSpawner } from '../systems/spawn.js';
import { createGates, reachGates, updateGates } from '../systems/gates.js';
import { createCombat, updateCombat } from '../systems/combat.js';
import { createMission } from '../systems/mission.js';
import { createWaves, updateWaves } from '../systems/waves.js';
import { createEnemyFx, updateEnemyFx } from '../fx/enemyFx.js';
import { createArmyFx, shakeOffset, updateArmyFx } from '../fx/armyFx.js';
import { createGateFx, updateGateFx } from '../fx/gateFx.js';
import { createCamera } from '../view/camera.js';
import { createFieldView } from '../view/fieldView.js';
import { createUnitsView } from '../view/unitsView.js';
import { createOverlayView } from '../view/overlayView.js';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create() {
    const { width, height } = this.scale;
    const lanes = createLanes(LANES.count, LANES.fieldWidth);
    const laneCenters = lanes.map((lane) => lane.centerX);
    const centerX = LANES.fieldWidth / 2;

    this.perspective = createCamera({ screenWidth: width, screenHeight: height, centerX });
    this.perspective.update();
    this.fieldView = createFieldView(this.add.graphics(), this.perspective, lanes, height);
    this.unitsView = createUnitsView(this.add.graphics(), this.perspective, centerX);
    this.overlayView = createOverlayView(this, this.perspective);

    const bus = createEventBus();
    const rng = createRng(Date.now());
    this.scroll = createScroll(bus);
    this.waves = createWaves(bus);
    this.army = createArmy(bus, rng, { startX: laneCenters[HERO.startLane], laneCenters });
    this.spawner = createSpawner(bus, rng, laneCenters);
    this.gates = createGates(bus, rng, laneCenters);
    this.combat = createCombat(bus);
    this.mission = createMission(bus);
    this.targets = { enemies: this.spawner.enemies, gates: this.gates.list };
    this.enemyFx = createEnemyFx(bus);
    this.armyFx = createArmyFx(bus);
    this.gateFx = createGateFx(bus);
    this.shake = { x: 0, y: 0 };

    // Missione finita, fallita o compiuta: la battaglia si ferma, la schermata di fine la mostra l'interfaccia
    this.over = false;
    const stop = () => {
      this.over = true;
    };
    bus.on(EVENTS.MISSION_FAILED, stop);
    bus.on(EVENTS.MISSION_COMPLETED, stop);
    const { army, mission, waves, scroll, armyFx } = this;
    this.scene.launch('BattleUI', { bus, army, mission, waves, scroll, armyFx });

    // Swipe: lo spostamento del dito sullo schermo diventa uno spostamento uguale dell'eroe, alla sua profondità
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer) => {
      if (!pointer.isDown || this.over) return;
      const dx = pointer.x - pointer.prevPosition.x;
      bus.emit(EVENTS.STEER, dx * this.perspective.worldPerPixelAtHero());
    });
    const endSteer = () => bus.emit(EVENTS.STEER_END);
    this.input.on(Phaser.Input.Events.POINTER_UP, endSteer);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, endSteer);
  }

  update(time, delta) {
    if (this.over) return;

    // Prima l'ondata, che decide la velocità del campo per tutti gli altri. Poi invecchiano gli effetti
    // già in corso: quelli nati in questo frame vengono disegnati almeno una volta
    updateWaves(this.waves, delta, this.spawner.enemies.length);
    updateEnemyFx(this.enemyFx, delta, this.scroll.speed);
    updateArmyFx(this.armyFx, delta);
    updateGateFx(this.gateFx, delta);
    updateScroll(this.scroll, delta);
    updateArmy(this.army, delta);
    updateSpawner(this.spawner, delta, this.scroll.speed);
    updateGates(this.gates, delta, this.scroll.speed);
    // Ognuno spara al suo ritmo; dopo i colpi si vede chi si scontra con l'esercito e chi lo supera
    updateCombat(this.combat, this.army, this.targets, delta, this.scroll.speed);
    clashEnemies(this.spawner, this.army);
    // A missione finita nessun cancello fa più crescere l'esercito
    if (!this.over) reachGates(this.gates, this.army);

    // La scossa sposta la telecamera della battaglia; a partita finita la telecamera torna ferma
    shakeOffset(this.armyFx, this.shake);
    if (this.over) this.cameras.main.setScroll(0, 0);
    else this.cameras.main.setScroll(this.shake.x, this.shake.y);

    this.perspective.update();
    this.fieldView.draw(this.scroll.distance);
    const { projectiles } = this.combat;
    const { enemies } = this.spawner;
    this.unitsView.draw(this.army, projectiles, enemies, this.gates.list, this.enemyFx, this.gateFx, this.armyFx);
    this.overlayView.draw(enemies, this.gates.list, this.enemyFx, this.army);
  }
}
