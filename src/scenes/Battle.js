import * as Phaser from 'phaser';
import { DEPTH, HERO, LANES } from '../config/balance.js';
import { createEventBus, EVENTS } from '../core/events.js';
import { createRng } from '../core/rng.js';
import { createLanes } from '../systems/lanes.js';
import { createArmy, updateArmy } from '../systems/army.js';
import { createScroll, updateScroll } from '../systems/scroll.js';
import { clashEnemies, createSpawner, updateSpawner } from '../systems/spawn.js';
import { createGates, reachGates, updateGates } from '../systems/gates.js';
import { createCombat, updateCombat } from '../systems/combat.js';
import { createMission } from '../systems/mission.js';
import { createBoss, updateBoss } from '../systems/boss.js';
import { createEnemyFire, updateEnemyFire } from '../systems/enemyFire.js';
import { createWaves, updateWaves } from '../systems/waves.js';
import { createEnemyFx, updateEnemyFx } from '../fx/enemyFx.js';
import { createArmyFx, shakeOffset, updateArmyFx } from '../fx/armyFx.js';
import { createGateFx, updateGateFx } from '../fx/gateFx.js';
import { createCamera } from '../view/camera.js';
import { createFieldView } from '../view/fieldView.js';
import { createUnitsView } from '../view/unitsView.js';
import { createOverlayView } from '../view/overlayView.js';
import { createSmashView } from '../view/smashView.js';
import { createPawnAtlas } from '../view/pawns.js';
import { isOnHudButton } from './hudButtons.js';

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
    createPawnAtlas(this.textures);
    this.fieldView = createFieldView(this.add.graphics().setDepth(DEPTH.field), this.perspective, lanes, height);
    this.smashView = createSmashView(this, this.perspective);
    this.unitsView = createUnitsView(this, this.perspective, centerX);
    this.overlayView = createOverlayView(this, this.perspective);

    const bus = createEventBus();
    const rng = createRng(Date.now());
    this.scroll = createScroll(bus);
    this.waves = createWaves(bus);
    this.army = createArmy(bus, rng, { startX: laneCenters[HERO.startLane], laneCenters });
    this.spawner = createSpawner(bus, rng, laneCenters);
    // Dopo i nemici, che a ogni colpo tolgono la vita: così il boss conta gli strati con la vita già ridotta
    this.boss = createBoss(bus, rng, laneCenters);
    this.enemyFire = createEnemyFire(bus);
    this.gates = createGates(bus, rng, laneCenters);
    this.combat = createCombat(bus);
    this.mission = createMission(bus);
    this.targets = { enemies: this.spawner.enemies, gates: this.gates.list };
    this.enemyFx = createEnemyFx(bus);
    this.armyFx = createArmyFx(bus);
    this.gateFx = createGateFx(bus);
    this.shake = { x: 0, y: 0 };

    // Missione finita, fallita o compiuta: la battaglia si ferma, la schermata di fine la mostra l'interfaccia.
    // In pausa la battaglia resta ferma finché il menu non la fa ripartire
    this.over = false;
    const stop = () => {
      this.over = true;
    };
    bus.on(EVENTS.MISSION_FAILED, stop);
    bus.on(EVENTS.MISSION_COMPLETED, stop);
    this.paused = false;
    bus.on(EVENTS.GAME_PAUSED, () => {
      this.paused = true;
    });
    // Il dito si è alzato mentre il menu era aperto: ripartendo l'esercito si aggancia come a fine swipe
    bus.on(EVENTS.GAME_RESUMED, () => {
      this.paused = false;
      bus.emit(EVENTS.STEER_END);
    });
    // Ripartendo, per esempio dal pannello di sviluppo, un menu rimasto aperto si chiude
    this.scene.stop('PauseMenu');
    const { army, mission, waves, scroll, boss, armyFx, enemyFx } = this;
    this.scene.launch('BattleUI', { bus, army, mission, waves, scroll, boss, armyFx, enemyFx });

    // Swipe: lo spostamento del dito sullo schermo diventa uno spostamento uguale dell'eroe, alla sua profondità.
    // Un tocco partito sopra un pulsante dell'interfaccia non guida l'esercito
    const steering = (pointer) => !this.over && !this.paused && !isOnHudButton(pointer.downX, pointer.downY);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer) => {
      if (!pointer.isDown || !steering(pointer)) return;
      const dx = pointer.x - pointer.prevPosition.x;
      bus.emit(EVENTS.STEER, dx * this.perspective.worldPerPixelAtHero());
    });
    const endSteer = (pointer) => {
      if (steering(pointer)) bus.emit(EVENTS.STEER_END);
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, endSteer);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, endSteer);
  }

  update(time, delta) {
    if (this.over || this.paused) return;

    // Prima l'ondata, che decide la velocità del campo per tutti gli altri. Poi invecchiano gli effetti
    // già in corso: quelli nati in questo frame vengono disegnati almeno una volta
    updateWaves(this.waves, delta, this.spawner.enemies.length);
    updateEnemyFx(this.enemyFx, delta, this.scroll.speed);
    updateArmyFx(this.armyFx, delta);
    updateGateFx(this.gateFx, delta);
    updateScroll(this.scroll, delta);
    updateArmy(this.army, delta);
    updateSpawner(this.spawner, delta, this.scroll.speed);
    // Il boss si pianta, cambia corsia e schiaccia dopo che i nemici si sono mossi
    updateBoss(this.boss, delta, this.scroll.speed, this.army);
    // I tiratori si fermano e sparano; i loro colpi colpiscono chi incontrano
    updateEnemyFire(this.enemyFire, this.spawner.enemies, this.army, delta, this.scroll.speed);
    updateGates(this.gates, delta, this.scroll.speed);
    // Ognuno spara al suo ritmo; dopo i colpi si vede chi si scontra con l'esercito e chi lo supera
    updateCombat(this.combat, this.army, this.targets, delta, this.scroll.speed);
    clashEnemies(this.spawner, this.army);
    // A missione finita nessun cancello vale più
    if (!this.over) reachGates(this.gates, this.army);

    // La scossa sposta la telecamera della battaglia; a partita finita la telecamera torna ferma
    shakeOffset(this.armyFx, this.shake);
    if (this.over) this.cameras.main.setScroll(0, 0);
    else this.cameras.main.setScroll(this.shake.x, this.shake.y);

    this.perspective.update();
    this.fieldView.draw(this.scroll.distance);
    this.smashView.draw(this.boss, this.enemyFx);
    const { projectiles } = this.combat;
    const { enemies } = this.spawner;
    const { shots } = this.enemyFire;
    this.unitsView.draw(this.army, projectiles, shots, enemies, this.gates.list, this.enemyFx, this.gateFx, this.armyFx);
    this.overlayView.draw(enemies, this.gates.list, this.enemyFx, this.army);
  }
}
