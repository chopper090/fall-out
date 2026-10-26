// Tutti i numeri regolabili del gioco (i dati del livello sono in data/), divisi per tema: battaglia, effetti,
// mondo, interfaccia (con la risoluzione dello schermo, DISPLAY), impostazioni (con i comandi e il salvataggio),
// strumenti di sviluppo (con la difficoltà di prova), simulatore e carattere delle scritte. Chi li usa li prende da
// qui: sono gli stessi oggetti, che il pannello di sviluppo cambia mentre il gioco gira
export * from './battle.js';
export * from './fx.js';
export * from './worldView.js';
export * from './hud.js';
export * from './settings.js';
export * from './debug.js';
export * from './sim.js';
export * from './styles.js';
