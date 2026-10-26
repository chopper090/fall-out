# FALL-OUT — regole del progetto

## Il gioco
Gioco mobile verticale (9:16), offline, single player.
- L'eroe con il suo esercito sta in fondo allo schermo e si muove con **swipe continuo destra–sinistra**. Può fermarsi anche a metà tra due corsie.
- Il campo ha **3 corsie aperte**, non compartimenti stagni. Dalle corsie arrivano cancelli (+N, negativi che si girano in positivi se gli si spara in tempo, moltiplicatori, armi), ondate di nemici e un boss.
- L'esercito spara da solo, dritto davanti a sé. Più cresce, più la formazione si allarga: a metà tra due corsie le copre entrambe.
- Fino a 5 eroi combattono dentro la folla, ognuno con il suo ruolo e abilità automatiche con ricarica.
- La battaglia è il cuore di un gioco più ampio, a tema "ere dopo l'apocalisse": villaggio da costruire, mappa a caselle da esplorare un passo alla volta, eroi da reclutare e potenziare, ere da attraversare con la storia e i requisiti del villaggio. Le battaglie aprono la mappa e danno risorse; il villaggio rinforza l'esercito; a volte la battaglia è una difesa del villaggio.
- Niente acquisti in-app: tutto si ottiene giocando, in tempi ragionevoli.

La tabella di marcia completa è nel documento "Gioco a corsie — Tabella di marcia". Si procede per fasi (0–7) e per step.

## Metodo di lavoro (obbligatorio)
1. Lavora **solo sullo step richiesto**. Non anticipare funzioni di step futuri, anche se sembrano utili.
2. Ogni step deve lasciare il gioco **avviabile e giocabile**, senza errori in console.
3. A fine step scrivi sempre:
   - i file creati o modificati;
   - cosa devo testare, su PC e su telefono, in punti brevi;
   - un messaggio di commit proposto (il commit lo faccio io).
4. Poi **fermati** e aspetta il mio feedback.
5. Se qualcosa non è chiaro o richiede una scelta di design, chiedi prima di scrivere codice.
6. Fino alla Fase 5 niente grafica finale, qualunque grafica venga prodotta nel frattempo: solo forme semplici e colori piatti (blu = noi, rosso = nemici, giallo = bonus). Si costruisce però come se la grafica ci fosse: ogni pedina ha la sua sagoma e il suo posto per l'immagine, da sostituire senza cambiare la logica.

## Stack
- **Phaser 4** (ultima versione stabile). Import: `import * as Phaser from 'phaser'`. Usa l'API di Phaser 4: non copiare esempi di Phaser 3 senza verificarli.
- **Vite** come server di sviluppo e build, con `server.host = true` per il test dal telefono in Wi-Fi.
- **JavaScript con moduli ES**, niente TypeScript.
- **Tweakpane** per il pannello di debug, aperto dalla sezione Sviluppo dell'ingranaggio delle impostazioni. Durante lo sviluppo c'è anche nel link pubblico; si toglie per l'uscita.
- Il server di sviluppo va avviato in background, così resta attivo.
- **Prove**: `npm test` (veloci, senza grafica), `npm run test:all` (anche quelle lunghe con il bot), `npm run test:e2e`
  (nel browser, con un server suo), `npm run lint` (stile). Si lanciano prima di ogni resoconto di fine step; la
  pubblicazione su GitHub Pages parte solo se lint e test passano.

## Architettura
```
src/
  main.js              avvio Phaser, scala, scene
  config/balance.js    tutti i numeri regolabili
  data/                units.js, enemies.js, waves.js, gates.js, heroes.js, village.js, road.js, world.js
  scenes/              World, WorldUI, Heroes, Lineup, Battle, BattleUI, Summary, PauseMenu (Boot e Preload con la grafica)
  systems/             lanes, army, spawn, combat, gates, heroes
  meta/                profilo, villaggio, strada, eroi: la logica del meta-gioco, senza disegno
  view/                disegno senza logica: isometria, atlanti, pedine, telecamere
  core/                events.js, pool.js, rng.js, save.js
  fx/                  particelle, flash, scuotimento, numeri danno
  debug/               overlay FPS, pannello Tweakpane, scorciatoie
  sim/                 simulatore di bilanciamento senza grafica
tests/                 prove senza grafica (npm test) e prove nel browser
docs/REGISTRO.md       registro degli step: richieste, scelte, misure, punti aperti
```
Le cartelle si creano solo quando uno step ne ha bisogno. A fine step si aggiorna `docs/REGISTRO.md`.

Regole:
1. **Numeri nei dati.** Velocità, danni, dimensioni, colori e frequenze stanno in `config/balance.js` o in `data/`. Nessun numero "magico" nel codice.
2. **Un sistema = un file = una responsabilità.**
3. **I sistemi comunicano con eventi** (`core/events.js`), non chiamandosi a vicenda.
4. **Lo stato della battaglia è separato dal disegno**, così la logica può girare senza grafica.
5. **Object pooling** per proiettili, nemici e particelle.
6. **Casualità solo tramite `core/rng.js` con seed.**
7. **Il contratto tra battaglia e meta è unico:** `startBattle(loadout) → result`.
8. **Gli effetti visivi stanno in `fx/`**, attivabili e disattivabili.
9. I valori trovati nel pannello di debug vanno riportati in `balance.js`.

## Stile del codice
- Nomi di variabili e funzioni in inglese; commenti brevi in italiano, solo dove servono.
- Funzioni piccole e leggibili; niente codice morto o commentato.
- Mobile first: input touch prima del mouse, obiettivo 60 FPS su Android.
