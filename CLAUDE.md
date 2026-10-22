# FALL-OUT — regole del progetto

## Il gioco
Gioco mobile verticale (9:16), offline, single player.
- L'eroe con il suo esercito sta in fondo allo schermo e si muove con **swipe continuo destra–sinistra**. Può fermarsi anche a metà tra due corsie.
- Il campo ha **3 corsie aperte**, non compartimenti stagni. Dalle corsie arrivano cancelli bonus (+N, moltiplicatori, armi), ondate di nemici e un boss.
- L'esercito spara da solo, dritto davanti a sé. Più cresce, più la formazione si allarga: a metà tra due corsie le copre entrambe.
- Ai checkpoint si sceglie 1 upgrade su 3 (stile survivor.io).
- A fine livello le ricompense alimentano la meta-progressione (eroe, truppe, capitoli).

La tabella di marcia completa è nel documento "Gioco a corsie — Tabella di marcia". Si procede per fasi (0–6) e per step.

## Metodo di lavoro (obbligatorio)
1. Lavora **solo sullo step richiesto**. Non anticipare funzioni di step futuri, anche se sembrano utili.
2. Ogni step deve lasciare il gioco **avviabile e giocabile**, senza errori in console.
3. A fine step scrivi sempre:
   - i file creati o modificati;
   - cosa devo testare, su PC e su telefono, in punti brevi;
   - un messaggio di commit proposto (il commit lo faccio io).
4. Poi **fermati** e aspetta il mio feedback.
5. Se qualcosa non è chiaro o richiede una scelta di design, chiedi prima di scrivere codice.
6. Fino alla Fase 4 niente grafica: solo forme geometriche e colori piatti (blu = noi, rosso = nemici, giallo = bonus).

## Stack
- **Phaser 4** (ultima versione stabile). Import: `import * as Phaser from 'phaser'`. Usa l'API di Phaser 4: non copiare esempi di Phaser 3 senza verificarli.
- **Vite** come server di sviluppo e build, con `server.host = true` per il test dal telefono in Wi-Fi.
- **JavaScript con moduli ES**, niente TypeScript.
- **Tweakpane** per il pannello di debug (solo in modalità sviluppo).
- Il server di sviluppo va avviato in background, così resta attivo.

## Architettura
```
src/
  main.js              avvio Phaser, scala, scene
  config/balance.js    tutti i numeri regolabili
  data/                units.js, enemies.js, waves.js, gates.js, upgrades.js
  scenes/              Boot, Preload, Meta, Battle, BattleUI
  systems/             lanes, army, spawn, combat, gates, upgrades
  core/                events.js, pool.js, rng.js, save.js
  fx/                  particelle, flash, scuotimento, numeri danno
  debug/               overlay FPS, pannello Tweakpane, scorciatoie
  sim/                 simulatore di bilanciamento senza grafica
```
Le cartelle si creano solo quando uno step ne ha bisogno.

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
