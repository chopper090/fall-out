// Si lascia la battaglia (dalla pausa o dal riepilogo): si fermano la battaglia e la sua interfaccia e parte la scena
// returnTo, da dove si era partiti
export function leaveBattle(scene, returnTo) {
  scene.scene.stop('Battle');
  scene.scene.stop('BattleUI');
  scene.scene.start(returnTo);
}
