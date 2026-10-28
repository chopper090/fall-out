# Registro degli step

Per ogni step dal 3.12: cosa chiedeva l'utente, le scelte prese, le misure (simulatore, prove nel browser, FPS), le
revisioni e i punti lasciati aperti. Fino al 4.10 il registro, le istantanee (snapshot-N), i diff e i messaggi di commit
stavano in una cartella temporanea: le istantanee non servono più, perché ogni step ha il suo commit in git. Gli script
road/design.py e road/search*.py citati nel 4.8 sono stati sostituiti dai test della strada in tests/.

# Registro degli step 3.12–3.19 (senza commit)

Ultimo commit: 7c810dc (3.11). Ogni step ha: copia completa `snapshot-3-NN/` (src + CLAUDE.md), diff `diff-3-NN.patch`
rispetto allo step prima, messaggio `commit-3-NN.txt`. Per fare commit separati: worktree dal commit precedente,
copia dello snapshot, commit; poi `git reset --soft` e avanti (stesso metodo del 3.9/3.10).

## 3.12 — cancelli che salgono a ogni colpo
Snapshot: snapshot-3-12 · messaggio: commit-3-12.txt

## 3.13 — tetto morbido, riserve
Snapshot: snapshot-3-13 · messaggio: commit-3-13.txt

## 3.14 — scrigni
Snapshot: snapshot-3-14 · diff: diff-3-14.patch · messaggio: commit-3-14.txt
File: nuovi `data/chests.js`, `systems/chests.js`; modificati `config/balance.js`, `core/events.js`, `core/rng.js`,
`data/gates.js`, `data/units.js`, `data/waves.js`, `fx/gateFx.js`, `scenes/Battle.js`, `scenes/BattleUI.js`,
`systems/army.js`, `systems/combat.js`, `systems/gates.js`, `view/marksView.js`, `view/overlayView.js`,
`view/unitsView.js`.
Scelte (da confermare giocando):
- tolti il cancello di potenziamento e i cancelli d'arma: "i cancelli danno truppe, gli scrigni potenza";
- armi negli scrigni: solo Raffica (il Lanciatore bloccava gli scrigni successivi, il Fucile non cambiava niente);
- uno scrigno ogni due arrivi di cancelli, a metà strada; ricompensa visibile prima di aprirlo;
- colpi 70/135/115/95: margine ~1,4 per una folla centrata.
Misure: sim-3-14 47/47; bot 480 partite: cerca gli scrigni 202 (42%, come il 3.13), li ignora 160; 20 s sicuri;
e2e OK, nessun errore. Revisione: 4 problemi veri corretti (lanciatore, ondata 4, fucile, riga in alto) più
5 piccoli (campo morto, ritmo col cursore, arma persa, giro senza funzioni, commenti).

## 3.15 — boss a campo fermo
Snapshot: snapshot-3-15 · diff: diff-3-15.patch · messaggio: commit-3-15.txt
File: `config/balance.js`, `core/events.js`, `data/units.js`, `data/waves.js`, `scenes/Battle.js`, `systems/boss.js`,
`systems/scroll.js`, `systems/spawn.js`, `systems/waves.js`.
Scelte: il boss aspetta la strada libera (altrimenti cancelli e nemici resterebbero fermi in strada); entra a 1700
(non dal fondo: 4 s vuoti); si pianta a 550 (non più vicino, perché le granate scoppiano a 650); continua a
cambiare corsia come dal 3.5; la coda dell'ultima ondata non rallenta più (prima rallentava a 300 con l'annuncio).
Tolto BOSS_ANNOUNCED (nessuno lo ascoltava), tolto il parametro scrollSpeed di updateBoss.
Misure: sim-3-15 55/55; bot 480 (CHEST_W=1): 178 vittorie (37%, prima 202), al boss vinte 87%, boss in 14,4 s con
2,1 schiacciamenti; 20 s sicuri; e2e OK.

## 3.16 — fuoco che rallenta
Snapshot: snapshot-3-16 · diff: diff-3-16.patch · messaggio: commit-3-16.txt
File: `config/balance.js`, `data/enemies.js`, `data/waves.js`, `scenes/Battle.js`, `systems/combat.js`,
`systems/spawn.js`, `view/marksView.js`.
Scelte: freno = 12 × danno / vita massima, dimezzamento 0,7 s, solo a campo fermo, solo sulla camminata (non sul
cambio di corsia del boss); boss al massimo 65%; il boss passa sopra la scorta ferma; scorta da 4 a 8 di vita
(altrimenti moriva prima di potersi fermare); disco azzurro sotto i frenati (aggiunto dopo la revisione).
Misure: sim-3-16 60/60; bot 480: 181 vittorie (38%), al boss 88%, boss 15,7 s e 2 schiacciamenti; senza freno
il bot perde di più (176 contro 190 a parità di boss nella prova della revisione); e2e OK, 57 FPS.

## 3.17 — potenza vera
Snapshot: snapshot-3-17 · diff: diff-3-17.patch · messaggio: commit-3-17.txt
File: nuovo `systems/power.js`; modificati `config/balance.js`, `data/heroes.js`, `data/waves.js`, `scenes/Lineup.js`,
`systems/spawn.js`.
Scelte: potenza = √(danno/s × vita) × 5; per il livello il danno al secondo è la vita che arriva ogni secondo;
fasce tarate sul bot (CHEST_W=1 GATE_W=0.3) cambiando la vita dei nemici; soglie 1,35 / 1 / 0,7 / 0,6.
Taratura (96 partite a punto, power-3-17/taratura.txt): vita nemici ×0,5…×2,1 → 82…0 vittorie su 96, rapporto in
ordine; eroi ×3 di danno → come ×2 (limite noto: contano i soldati dei cancelli, non nella potenza).
Misure: sim-3-17 64/64; e2e: schermata leggibile, la partita parte, nessun errore.

## 3.18 — simulatore di bilanciamento
Snapshot: snapshot-3-18 (con package.json) · diff: diff-3-18.patch · messaggio: commit-3-18.txt
File: nuovi `systems/battle.js`, `sim/bot.js`, `sim/game.js`, `sim/report.js`, `sim/run.js`, `sim/variants.js`,
`sim/worker.js`; modificati `config/balance.js` (POWER.bands.wins, blocco SIM), `scenes/Battle.js`,
`systems/power.js` (bandWins), `package.json` (script sim).
Scelte: battaglia comune per scena e simulatore (stesso ordine, verificato frame per frame); 60 fps fissi (a 30 fps
181/480, a 60 fps 176/480: la taratura regge); bot di riferimento uguale a quello delle tarature (181/480 identico
a 30 fps); 4 modi di cambiare la potenza; promessa di vittorie per fascia; segnali con soglie in SIM.flags.
Revisione: corretti bot che ignorava la sensibilità dello swipe, blocco con LEVEL.startWithBoss, misure morte
(cancelli, schiacciamenti ora stampati). Aggiunto: nemici già passati di chi perde nel salto.
Misure: sim-3-18 33/33; sim-3-17 e accept-3-10 OK; e2e OK, 60 FPS, nessun errore; npm run sim 4800 partite in 66 s
(sim-report-3-18.txt).
Cosa dice il simulatore: ondata 4 salto (48% di chi ci arriva perde lì, con 1,1 nemici già passati su 3), tempo
morto 5 s nelle ondate 3-4; la vita degli eroi non cambia le vittorie (34-36%), il danno satura, i soldati di
partenza sono sopravvalutati; la vita dei nemici è tarata giusta (metà delle vittorie a rapporto 1,00).
Prove di ritocco (sim319/, non applicate): ondata 4 a 360 abbassa il salto ma non lo toglie e sposta la taratura.

## 3.19 — gate: 10 partite di fila
Snapshot: snapshot-3-19 · diff: diff-3-19.patch · messaggio: commit-3-19.txt
File: nuovo `debug/playtest.js`; modificati `config/balance.js` (DEBUG.playtest), `core/time.js` (msToSeconds),
`debug/index.js`, `main.js` (commento), `sim/report.js`, `sim/run.js`.
Revisione: corretti due commenti non più veri (seme, main.js) e il riepilogo dal pannello a test spento; aggiunti
il conto delle partite ricominciate a metà, giorno e ore del test, "all'ondata 4: 10".
Scelte: il gate lo gioca l'utente; lo step costruisce lo strumento (registro automatico, due domande per partita,
riepilogo da copiare, pannello), acceso di base finché si fa il test. Nessun ritocco del livello prima del gate:
i ritocchi provati non tolgono il salto dell'ondata 4 e spostano la taratura; si decide dopo, con il riepilogo
dell'utente e il simulatore.
Misure: e2e run-3-19 tutto OK (10 partite, risposte, riepilogo, copia con e senza permesso, reload, test finito,
nuovo test, test spento, pannello), nessun errore; regressioni sim-3-18, sim-3-17, accept-3-10, run-3-18 OK.

# Blocco 3.20–3.26 (dopo il primo gate; commit fatti fino al 3.19: 04ee20a)

## 3.20 — porte fisse
Snapshot: snapshot-3-20 · diff: diff-3-20.patch · messaggio: commit-3-20.txt
File: `config/balance.js`, `core/events.js`, `data/gates.js`, `data/waves.js`, `fx/chestFx.js` (era `fx/gateFx.js`),
`scenes/Battle.js`, `sim/bot.js`, `sim/game.js`, `systems/army.js`, `systems/battle.js`, `systems/combat.js`,
`systems/gates.js`, `view/marksView.js`, `view/overlayView.js`, `view/unitsView.js`.
Scelte: solo +N e −N (scelta dell'utente), valori da elenchi per ondata (w1 +6/8/10 −4/−6 … w4 +18/22/26 −15/−20),
un arrivo ogni 4 s (26 nel livello); esercito minimo utile misurato (sim320/army.mjs): 60 soldati all'ondata 4 →
metà vittorie, folla piena → 3 su 4, sotto 60 quasi mai; −N da solo solo nelle corsie esterne (revisione).
Misure: sim-3-20 62/62 (controlli 3.10–3.17 adattati, tolti quelli dei cancelli caricati, ×2, ÷2); sim-3-18 OK;
accept OK; e2e run-3-20 (insegne +N, porta rossa −4 esterna, numeri fissi, 60 FPS, nessun errore); bot 43% a
rapporto 0,86; il simulatore ora mostra 8–13 s di tempo morto per ondata (prima nascosti dai cancelli).
Revisione: corretti tempo morto nel simulatore, bot su coppie uguali, palette morta dei cancelli, commento heal,
−N inevitabile al centro.

## 3.21 — truppe élite dalle scatole
Snapshot: snapshot-3-21 · diff: diff-3-21.patch · messaggio: commit-3-21.txt
File: `config/balance.js`, `core/events.js`, `data/chests.js`, `data/enemies.js`, `data/units.js`, `data/waves.js`,
`fx/armyFx.js`, `scenes/BattleUI.js`, `sim/game.js`, `sim/report.js`, `systems/army.js`, `systems/boss.js`,
`systems/chests.js`, `systems/combat.js`, `systems/enemyFire.js`, `systems/spawn.js`, `view/overlayView.js`,
`view/pawns.js`, `view/unitsView.js`.
Scelte: élite = 3 vite, danno doppio (WEAPONS.elite), arma fissa, primi posti, argento e più grandi (26 contro 20);
nuovo evento SOLDIER_HIT; colpi degli scrigni = colpi dell'ondata × value (regola dell'utente); élite 8 a scrigno
con value 1,3, tarate (tutti scrigni d'élite 43%, tutti di danno 38%, nessuna ricompensa 20%).
Misure: sim-3-21 72/72; sim-3-18 OK; e2e run-3-21 (insegna "+8 élite", contatore, élite argento, lampo, 60 FPS);
bot 49% a rapporto 0,86.
Revisione: corretti il lampo sulla riserva che prende il posto di un caduto, commenti sulla morte a un colpo,
élite troppo deboli (da 3 a 8).

## 3.22 — scatole al centro
Snapshot: snapshot-3-22 · diff: diff-3-22.patch · messaggio: commit-3-22.txt
File: `config/balance.js`, `data/chests.js`, `data/waves.js`, `sim/bot.js`, `systems/army.js`, `systems/chests.js`,
`view/overlayView.js`.
Scelte: uno scrigno a ogni intervallo dei cancelli (everyGates 1, il primo dopo mezzo intervallo); ricompense
damage, bigDamage (+20%), fireRate, heal (+2 vita), burst, elite (5), bigElite (10); value misurati con il
simulatore a parità di colpi e con le ricompense sostituite (la revisione ha trovato che le prime misure le
mescolavano): +20% 1,3, cadenza 1,5, 5 élite 1,5, 10 élite 2, vita 0,4 e raffica 0,4 tenute basse apposta; colpi
base delle ondate 1-2 da 70/135 a 55/110.
Misure: sim-3-22 76/76; sim-3-18 OK; e2e run-3-22 (insegne "+20% danno", "+2 vita", "+10 élite"); bot 51% a
rapporto 0,86 (dentro l'intervallo della fascia Difficile), curva 3/13/14/26/6%, tempo morto 5-9 s.
Revisione: corretti i value delle ricompense forti (misure sbagliate), commenti su ritmo ed esempi.

## 3.23 — nemici più duri, con contraccolpo
Snapshot: snapshot-3-23 · diff: diff-3-23.patch · messaggio: commit-3-23.txt
File: `config/balance.js`, `data/enemies.js`, `data/waves.js`, `systems/spawn.js`.
Scelte: contraccolpo (scelta dell'utente) come velocità all'indietro che cala (strength 700, maxSpeed 400, mezza
vita 120 ms), knockback per tipo (corazzato 0,4, élite 0,3, boss 0), fermo contro chi sta dietro (revisione);
spinte più forti misurate peggiori (ammassano i nemici); sciami hpScale 0,1 → 0,25; vita 12/30/47/66; scorta 8.
Misure: sim-3-23 81/81 (pedine degli sciami 2,4-3,5 colpi, meno di 1 su 7 a un colpo; sciame 2 s dal primo
colpo all'ultima pedina); sim-3-18 OK; accept OK; e2e run-3-23 (spinte in corso, 60 FPS); bot 43%, rapporto 0,70
(gli sciami pesano molto nella potenza del livello: ritaratura nel 3.26). Esercito minimo utile rimisurato: con
80 soldati all'ondata 4 metà vittorie, con la folla piena più di due su tre, sotto 60 di rado.
Revisione: corretta la spinta che faceva passare i nemici uno dentro l'altro; prova sugli sciami più severa.
Nota per il report: dalla terza ondata la spinta su un colpo si vede poco (vita più alta); si sente come
rallentamento sotto il fuoco.

## Analisi dell'intero codice (dopo il 3.17)
Scan meccanico (analysis/scan.txt) + 4 lenti con verificatori (analysis/findings.txt). Nessun codice rotto, 30 livelli
senza errori. Corretti subito, anche nelle copie 3.16 e 3.17: freno sul boss piantato (spawn.js), commento sulla
coda in spawn.js, commento a colonna 0 in enemies.js, commento di POWER con i parametri del bot. sim-3-17 65/65.
Proposte non applicate (aspettano l'ok): fx/effects.js con countDown e il ciclo degli effetti (5 copie);
camera.inFront (4 copie); damageMultiplier(army) per combattimento e interfaccia; typeShares(specials) per spawn e
potenza; oggetto world per i draw di Battle; updateReserves solo a ogni frame; ownSpeed con un parametro; HUD.power
→ HUD.bonus; commento del tiratore (il cecchino lo raggiunge); 10 righe vecchie oltre 120 caratteri.

## 3.24 — danno totale alla morte
Snapshot: snapshot-3-24 · diff: diff-3-24.patch · messaggio: commit-3-24.txt
File: `config/balance.js`, `fx/enemyFx.js`, `view/overlayView.js`.
Scelte: su ENEMY_KILLED, solo per i tipi con damageNumbers e con FX.enabled e i numeri accesi; valore maxHp − hp
(colpo di troppo compreso); "-N" 54 px, #ff9a85, alpha 0,65 che sfuma, 1,1 s, parte 160 unità sopra la testa
(revisione: con 70 nasceva sopra i numeri dei colpi di prima ancora in volo; con 160 le sovrapposizioni scendono
da 445 a 48 su 699 totali). Il boss mostra il suo totale (circa BOSS.hp): resta fermo sotto la schermata finale,
come tutto il campo (la battaglia si ferma lì da sempre).
Misure: sim-3-24 83/83 (prova 84 rafforzata: ogni totale uguale al danno sommato colpo per colpo, 699/699, nessun
colpo su un nemico già via); build OK; e2e run-3-24 ("-30" sopra il nemico, 60 FPS).
Revisione: confermata solo la sovrapposizione con i numeri dei colpi (corretta); respinti come non difetti il totale
del boss fermo a fine partita, il valore doppio con un colpo solo, il colore, il commento di damageNumbers.

## 3.25 — folla fluida, eserciti fuori riga, scritta delle porte
Snapshot: snapshot-3-25 · diff: diff-3-25.patch · messaggio: commit-3-25.txt
File: `config/balance.js`, `data/enemies.js`, `data/waves.js`, `fx/gateFx.js` (nuovo), `scenes/Battle.js`,
`scenes/BattleUI.js`, `systems/army.js`, `systems/formation.js`, `systems/spawn.js`.
Richieste dell'utente a metà step: folla fluida a goccia attorno agli eroi, spinta dal bordo (non più un blocco);
scritta al centro dello schermo quando si passa una porta.
Scelte: posti su griglia a nido d'ape spostati fino a 8, in ordine dal centro degli eroi (+frontBias), 356 posti
(molti più dei 99 soldati), nessuno oltre 185 dietro (fondo dello schermo a −188); limiti dello swipe solo dagli
eroi (la folla piena arriva al centro delle corsie laterali); un posto si chiude quando il soldato uscirebbe di
strada di più di 12 e si riapre quando ci sta tutto; la folla occupa sempre i primi posti aperti e si riempie a
catena (ricerca in ampiezza tra posti accanto, poi anche attraverso i vuoti), così nessuno attraversa la folla;
chi si sposta per la goccia porta con sé l'arma (i posti si scambiano le armi), chi prende il posto di un morto
prende l'arma del posto; eroi spostati solo avanti/indietro (slotJitter 12: di lato si perderebbero le misure dei
colpi al centro); file nemiche sfalsate fino a 80, sciami fuori griglia fino a 7; scritta "+N soldati" gialla /
"−N soldati" rossa a y 620, 1,3 s; colpi degli scrigni 50/100/105/90 (folla rotonda: meno colpi sullo scrigno).
Misure: sim-3-25 92/92 (controlli vecchi adattati: eroi entro slotJitter; swipe veloci con 0 soldati al loro posto
dentro un eroe e 0,14% di tocchi profondi di chi cambia posto; porte su 4 semi; limiti di vittoria allargati fino
alla ritaratura); sim-3-18 OK; accept OK; bot 69% (3.24: 42%; con i colpi vecchi degli scrigni 60%); e2e run-3-25
(folla rotonda, goccia ai due bordi, scritte gialla e rossa, 57 FPS, nessun errore); 2,6 µs a frame per la folla.
Revisione: corretti il fianco destro spinto 110 unità lontano dagli eroi in una partita su sei (markBeside con gli
eroi sfalsati), il crash e i soldati spariti con tetti oltre 200 dal pannello (cursore a 150 + guardia),
l'élite oltre il tetto con la folla tutta d'élite, posti isolati con altri schieramenti (si tiene il gruppo più
grande), esponente della sfumatura nei dati; aggiunti i controlli che li vedono. Respinti come non difetti:
updateShape a quasi ogni frame (1-6 µs), commenti.

## 3.26 — ritaratura
Snapshot: snapshot-3-26 · diff: diff-3-26.patch · messaggio: commit-3-26.txt
File: `config/balance.js`, `data/waves.js`.
Scelte: ondate 3 e 4 più fitte (spawnInterval 1,1 → 0,95 e 1 → 0,8): la folla grande abbatteva i nemici appena a
tiro; levelScale 0,0302 → 0,0169 (vecchio × 0,56, il rapporto a metà vittorie dopo le ondate nuove); «Difficile» da
0,75 (vita dei nemici ×1,5: rapporto 0,74 e 19% di vittorie); pesi del bot invariati (porte ×2: 73-83%, scrigni
×2: 37-45%: resta un giocatore discreto); commento dell'esercito minimo rimisurato sul codice vero (≥80 all'ondata 4:
80-93%, meno: circa uno su tre, sotto i 40: 11%); registro del test delle 10 partite azzerato (version 2); pool dei
nemici 120 (picco ondata 4: 119). Scartata (misurata su una copia, work326): partenza rapida a ogni ondata, −2 s di
tempo morto ma +25% di nemici a ondata e perse in ondata 2 dal 13 al 20-28%.
Misure: sim-3-26 94/94 (nuovi: 200 partite vinte 59%, rapporto 1,10 «Normale», perse 0/12/14/22/0%, nessun salto;
taratura con la vita dei nemici: metà vittorie a 1,03); npm run sim: 59% (52-66%), metà vittorie a 1,01 (vita dei
nemici) e 1,02 (danno degli eroi), tutti i punti nella loro fascia tranne la vita degli eroi (limite noto);
sim-3-18 OK; accept OK; e2e run-3-26 (schieramento «Normale», ondata 4 con ~50 nemici); 56-57 FPS a 0,8 e 1 s.
Revisione: corretti registro del test non azzerato e pool dei nemici (non un difetto, ma copre il picco);
corretta la causa del tempo morto nel report: non è il viaggio dei primi nemici ma la pausa di 3 s più il primo
intervallo senza arrivi (con spawnDistance 1800 il buco non cambia; con la pausa a 1,5 s scende di 1-1,8 s a
ondata e le vittorie restano 58-60%, perse in ondata 2 +4 punti): proposta all'utente prima della partenza rapida.
Notato dal revisore, non causato dallo step: il boss non decide nulla (chi ci arriva vince); quasi tutte le perse
sono per 3 nemici passati.

# Fase 4 (dopo i commit f9d2004..c92f09a del blocco 3.20-3.26, pubblicati)
Scelte dell'utente per tutta la fase in memoria: fall-out-phase4-choices.md. L'utente vuole i passi uno dopo l'altro
fino al 4.6 senza suoi feedback intermedi; commit solo quando li chiede.

## 4.1 — salvataggio versionato
Snapshot: snapshot-4-1 · diff: diff-4-1.patch · messaggio: commit-4-1.txt
File: `config/balance.js`, `core/events.js`, `core/save.js` (nuovo), `main.js`, `meta/profile.js` (nuovo, cartella
nuova), `scenes/Battle.js`, `scenes/Lineup.js`, `scenes/PauseMenu.js`, `systems/battle.js`.
Scelte (utente): battaglia a metà = si torna allo schieramento, non conta; struttura + statistiche sullo
schieramento; niente backup; Cancella salvataggio nelle impostazioni con conferma. Mie: chiave 'fall-out.save',
versione 1 con MIGRATIONS (vuote); rotto → da zero; più nuovo → sola lettura finché non si cancella; profilo
sanificato campo per campo; impostazioni nel loro salvataggio; distanza salvata in unità del mondo e mostrata in
metri come la schermata di fine; risultato della battaglia con GAME_EVENTS.BATTLE_ENDED (regola 7 di CLAUDE.md).
Misure: sim-4-1 101/101 (nuovi 100-106: da zero, riletto uguale, 7 salvataggi rotti, campi sistemati, versione più
nuova, storage che rifiuta, 30 battaglie col bot, due finestre); e2e run-4-1 (salvata la battaglia persa,
statistiche dopo il ricaricamento, battaglia a metà non conta, cancellazione con conferma, nessun errore).
Revisione: corrette le due finestre che si sovrascrivevano (refreshSave prima di registrare), la scena della
battaglia che scriveva nel salvataggio (ora un evento), il titolo della conferma; trovato e chiuso un difetto dello
strumento e2e: lasciava aperti i browser di prova (937 processi Edge, 34 GB): ora chiude con Browser.close e si
ferma se la porta è occupata. Respinti: clear che fallisce per quota (non succede: si scrive più corto), boss nella
pausa prima del boss, record oltre il livello, regola del boss in due file.

## 4.2 — premi in battaglia e riepilogo
Snapshot: snapshot-4-2 · diff: diff-4-2.patch · messaggio: commit-4-2.txt
File: `config/balance.js`, `core/events.js`, `data/rewards.js` (nuovo), `fx/lootFx.js` (nuovo), `main.js`,
`meta/profile.js`, `meta/rewards.js` (nuovo), `scenes/Battle.js`, `scenes/BattleUI.js`, `scenes/Summary.js` (nuovo),
`systems/battle.js`, `systems/battleStats.js` (nuovo), `systems/combat.js`, `systems/heroes.js`, `systems/loot.js`
(nuovo), `systems/waves.js`, `view/overlayView.js`, `view/unitsView.js`, `view/words.js` (nuovo).
Scelte (utente): premi dai nemici (élite e boss), caduti in strada e presi passandoci; persa = metà del bottino;
riepilogo con abbattuti, esperienza e migliore; poi tolte le stelle: vinta = tutto il bottino più un premio fisso
(REWARDS.victory), nessuna partita da rigiocare. Mie: bottino con seme suo (seed + LOOT.seedOffset); premi in fila
lungo la strada (spread 110) per non sovrapporre le scritte; il migliore per danno, poi abbattuti, poi ordine dello
schieramento; esperienza divisa in parti uguali (resto ai primi), frammenti all'eroe a cui appartengono; riepilogo
come scena del meta-gioco (Summary) aperta da main.js dopo i premi, così la battaglia dà solo il risultato.
Misure: sim-4-2 tutti OK (106 righe, nuovi: premi di un'élite, raccolta, 12 battaglie con statistiche e bottino che
tornano, premi della vittoria e della sconfitta, stesso seme stessi premi); e2e run-4-2 (premi in strada, boss
vinto con riepilogo e salvataggio, persa con metà bottino; nessun errore in console).
Revisione: corretti riga del bottino sopra la barra del boss (barra a y 140), premio preso nel frame della
sconfitta (reachLoot solo a missione aperta), commenti sul seme del bottino (i premi in strada ritardano boss e fine
di 2 s), commento di gatePass spostato, LOOT_LOST e campo collected senza lettori tolti, riga dell'eroe che usciva
dallo schermo (esperienza e frammenti sulla riga del nome), singolari, scritte dei premi che restavano ferme sotto
il riepilogo, prova e2e della sconfitta che leggeva la battaglia vecchia. corta la scritta dei frammenti accanto al nome. Respinti: secondo canale battaglia-meta
(i premi li calcola il meta), 5 eroi sopra il suggerimento (c'è spazio). Da proporre: premi solo all'ondata 4 e al
boss (molte perse tengono 0), migliore quasi sempre il Cecchino.

## 4.3 — eroi, crescita, reclutamento, schieramento
Snapshot: snapshot-4-3 · diff: diff-4-3.patch · messaggio: commit-4-3.txt
File: `config/balance.js`, `data/growth.js` (nuovo), `data/heroes.js`, `data/rewards.js`, `debug/index.js`, `main.js`,
`meta/heroes.js` (nuovo), `meta/profile.js`, `meta/rewards.js`, `scenes/Battle.js`, `scenes/Heroes.js` (nuovo),
`scenes/Lineup.js`, `scenes/Summary.js`, `scenes/buttons.js` (nuovo), `systems/army.js`, `systems/battle.js`,
`systems/combat.js`, `systems/enemyFire.js`, `systems/heroes.js`, `systems/power.js`, `view/marksView.js`,
`view/pawns.js`.
Scelte (utente): 8 eroi più il capo in 3 rarità; livelli con l'esperienza e stelle con i frammenti (abilità più
forte a 3 e 5 stelle); reclutamento con le piastrine e un raro garantito ogni 10; capo fisso, gli altri scelti.
Mie: livelli fino a 20 (40 × n^1,3 punti), +6% a livello, +15% a stella, stelle 10/20/40/80 frammenti; tiro da 5
piastrine, 10 alla partenza, +3 a vittoria; doppioni 5/10/20 frammenti; seme del reclutamento nel profilo; i 4 eroi
di partenza tutti comuni; rarità con forza sua (raro +15%, epico +30%); i soldati dei posti attorno a un eroe
sparano con la sua crescita (così potenziare un eroe solo si sente); lo schieramento si costruisce a ogni partenza.
Misure: sim-4-3 tutti OK (114 controlli; nuovi 120-128: crescita, profilo, schieramento, stelle, reclutamento 70/25/5%
con al massimo 9 comuni di fila, battaglia con lo schieramento, tutti e 4 a liv. 6 e 3 stelle 34/40 contro 24/40, il
solo capo a liv. 6 e 3 stelle 41/60 contro 36/60, scudi e fuochi rapidi che non si tolgono il posto, piastrine);
quinto eroe col bot (100 partite, base 61): esploratore 65, granatiere 76, guardiano 64, tiratore scelto 69, veterano
79; guardiano al posto del difensore 67; e2e run-4-3 (eroi, reclutamento, stella, cinque eroi che non si toccano,
battaglia con i numeri cresciuti, ricominciata uguale, ritorno allo schieramento; nessun errore).
Revisione: corretti pannello di sviluppo (valori degli eroi in battaglia, Ricomincia solo con una battaglia in
corso), Ricomincia dopo la cancellazione (prende il profilo nuovo), nomi sovrapposti con 5 eroi, scudi e fuochi
rapidi che si cancellavano, potenziamento di un eroe solo che non si sentiva (crescita ai soldati attorno), rari ed
epici non più forti dei comuni (forza di rarità, guardiano con il lanciatore, tiratore scelto con il perforante 70
ogni 7 s), raffica nel dettaglio con i suoi colpi, tiratore scelto azzurro chiaro (non più gemello del cecchino),
rarità con nomi in inglese nel codice, piastrine sbagliate nel salvataggio, commenti. Respinti: frammenti del boss
al capo (preferenza di economia), testo delle schede a 19 px (portato comunque a 22), uscita dalla battaglia (arriva
con il villaggio nel 4.4).

## 4.4 — villaggio
Snapshot: snapshot-4-4 · diff: diff-4-4.patch · messaggio: commit-4-4.txt
File: `config/balance.js`, `core/time.js`, `data/heroes.js`, `data/loadout.js` (nuovo), `data/rewards.js`,
`data/units.js`, `data/village.js` (nuovo), `main.js`, `meta/heroes.js`, `meta/loadout.js` (nuovo),
`meta/profile.js`, `meta/rewards.js`, `meta/village.js` (nuovo), `scenes/Battle.js`, `scenes/BattleUI.js`,
`scenes/Heroes.js`, `scenes/Lineup.js`, `scenes/PauseMenu.js`, `scenes/Summary.js`, `scenes/Village.js` (nuovo),
`scenes/buttons.js`, `systems/army.js`, `systems/battle.js`, `systems/combat.js`, `systems/loot.js`,
`systems/power.js`, `systems/spawn.js`, `view/words.js`.
Scelte (utente): razioni, materiali, rottami; produzione nel tempo vero fino a un tetto; cantieri da minuti a ore
accelerati con la sfida o con acceleratori rari; fucina = armi dei soldati (danno, cadenza, mira del lanciatore);
caserma = soldati di partenza; prossimo obiettivo con segno sull'edificio; il villaggio è la base. Mie: 3 edifici
da 0 a 5 (costi e tempi in data/village.js), un cantiere alla volta, partenza con 20 razioni, 20 materiali, 5
rottami, 1 acceleratore; acceleratore −30 min (boss 25%); obiettivo = l'edificio più indietro; la sfida è il livello
normale con i nemici ×1,2 di vita (vinta toglie metà del tempo che resta, al posto del premio della vittoria; si
spende partendo; solo con almeno 5 min di cantiere; niente Ricomincia): le versioni brevi provate col bot (dall'ondata
3, con 1-2 nemici ammessi, con le ondate ×0,6) non si vincevano mai (0-2/20), ×1,2 dà il 35-40% contro il 60% normale.
Rottami da élite e boss; Lascia la battaglia nel menu (non conta). Mira del lanciatore dal livello 3 della fucina.
Misure: sim-4-4 tutti OK (124 controlli; nuovi 130-139); bot: caserma e fucina al liv. 2 vince 34/40 contro 24/40;
fucina 0/1/2/3/5 senza caserma: potenza 124/127/132/199/219; e2e run-4-4 due volte di fila (fattoria, acceleratore,
razioni maturate e raccolte, caserma lunga, sfida con le sue regole e senza Ricomincia, sfida vinta: tolti 15 min,
battaglia con 13 soldati, Lascia la battaglia; nessun errore).
Revisione: corretti schieramento normale che si riapriva in modo sfida (Phaser tiene i dati della partenza),
granata mirata che cadeva corta (incontro con il nemico), acceleratore speso su un cantiere già finito, battaglia
ricominciata senza l'edificio appena finito, fascia di difficoltà che non contava la fucina (ora su tutto, e la mira
×1,45), sfida offerta a cantieri da 1-2 min, riga dell'obiettivo fuori schermo, "finisce prima di" (ora "tolti al
cantiere"), pulsanti del cantiere attaccati (uno scivolone spendeva un acceleratore), commenti di lanciatore e premi;
il villaggio non perde più i tocchi (si ridisegna solo quando cambia qualcosa). Respinti: mira troppo forte (taratura
per il gate), acceleratori non rari, obiettivo che non sceglie l'edificio pagabile, returnTo sempre Villaggio,
replay della sfida dal pannello, orologio avanti.

## 4.5 — mappa
Snapshot: snapshot-4-5 · diff: diff-4-5.patch · messaggio: commit-4-5.txt
File: `config/balance.js`, `core/time.js`, `data/loadout.js`, `data/map.js` (nuovo), `data/village.js`, `main.js`,
`meta/loadout.js`, `meta/map.js` (nuovo), `meta/profile.js`, `meta/rewards.js`, `meta/village.js`,
`scenes/Lineup.js`, `scenes/Map.js` (nuovo), `scenes/Village.js`, `scenes/buttons.js`, `systems/battle.js`,
`systems/power.js`, `systems/spawn.js`, `view/words.js`.
Scelte (utente): percorso ramificato di ~30 caselle con la nebbia, ~1 ora; battaglie = stesso livello sempre più
duro, boss in fondo; eventi solo bonus; persa si riprova senza pagare il passo; vinte non si rigiocano; razioni solo
dalla fattoria. Mie: 14 righe da 1-3 caselle generate da un seme salvato (stessa mappa a ogni apertura), strade che
non si incrociano con bivi a destra e a sinistra; nebbia = tipo a un passo, solo presenza a due, puntini oltre, boss
sempre visibile; un passo = 1 razione; battaglie da ×1,04 a ×1,56 di vita, boss ×1,25 sull'ultima riga, +0,3 a
capitolo; premi in materiali, rottami, frammenti, eventi (piastrine, materiali, esperienza, raro un acceleratore);
via la battaglia libera dal villaggio (Mappa al posto di Battaglia: niente farm, le battaglie solo dalla mappa); 12
razioni di partenza (prima 20) perché la fattoria serva già nel primo capitolo; nomi solo della casella scelta e del
boss.
Misure: sim-4-5 tutti OK (132 controlli; nuovi 140-147: capitoli 22-35 caselle (media 28,3), tutti connessi, 0 strade
incrociate, 47% battaglie; nebbia; premi e passi; battaglia da vincere e riprovare gratis; boss e capitolo nuovo;
salvataggio; 5 campagne col bot di due capitoli: 20-42 min il primo (senza attese) e 21-44 min il secondo (0-13 min
di attese della fattoria), al massimo 7 battaglie perse di fila; salvataggi su una battaglia dopo un cambio dei dati
della mappa mai bloccati); e2e run-4-5 (villaggio → mappa, passo, battaglia persa senza pagare, Combatti, vinta,
capitolo nuovo; nessun errore).
Revisione: corretti salvataggio che si bloccava se i dati della mappa cambiano (ora la strada si controlla sul
capitolo rigenerato, e lo schieramento torna alla mappa se la casella non ha regole), riga delle razioni ferma (ora
scorre ogni secondo), nomi delle caselle sovrapposti, nebbia che spariva sopra una battaglia da vincere, zone di
tocco piccole (90×110), esperienza degli eventi divisa come quella delle battaglie, commenti (bivi, nebbia,
schieramento, regole, pulsanti), contesto di battaglia di partenza con un tipo che non c'è più, decimali in un
posto solo. Respinti come difetti ma tenuti come taratura: bivi a sinistra, 12 razioni, prova su due capitoli.
Respinti: boss meno duro (resta ×1,25), forma vera nella nebbia (resta un "?"), parametro di default di loadoutFrom.

## 4.6 — gate della Fase 4
Snapshot: snapshot-4-6 · diff: diff-4-6.patch · messaggio: commit-4-6.txt
File: `config/balance.js`.
Scelta (utente): nessuno strumento, si gioca e si racconta. Mia: la scheda del test delle 10 partite (gate della
Fase 3) parte spenta, si riaccende dal pannello. Misure: build ok; e2e run-4-5 senza la scheda sotto i riepiloghi.

# Dopo i commit della Fase 4 (686f3d6..fa7160f, pubblicati il 2026-10-25)
L'utente ha rifiutato la mappa a bivi: mondo unico isometrico alla Age of Empires / Top Lords, strada unica dalla
porta attorno alle aree. Questionario: 5×5 aree con il villaggio al centro, ~12 caselle per area con il boss alla fine,
razioni solo per le battaglie, area conquistata = terreno + premio, edifici in un posto libero con ✗/✓, raccolta =
risorse esistenti; un passo alla volta: 4.7 e stop per il feedback, poi 4.8.

## 4.7 — mondo unico in isometria con il villaggio
Snapshot: snapshot-4-7 · diff: diff-4-7.patch · messaggio: commit-4-7.txt
File: `config/balance.js` (WORLD_VIEW, HUD.world al posto di HUD.village, HUD.units), `core/events.js` (WORLD_EVENTS),
`data/village.js` (size), `data/world.js` (nuovo), `main.js`, `meta/profile.js`, `meta/village.js`, `meta/world.js`
(nuovo), `scenes/Battle.js`, `scenes/Heroes.js`, `scenes/Lineup.js`, `scenes/Map.js`, `scenes/Village.js` (tolto),
`scenes/World.js` (nuovo), `scenes/WorldUI.js` (nuovo), `scenes/buttons.js`, `view/iso.js` (nuovo),
`view/worldAtlas.js` (nuovo), `view/worldCamera.js` (nuovo), `view/words.js`, `index.html`.
Scelte mie: aree di 7×7 celle (mondo 35×35), porta a est a metà del lato; isometria 2:1 in Phaser (niente 3D vero);
terreno in TilemapLayer isometrico, nebbia piena; fattoria 2×2, caserma 3×2, fucina 2×2; davanti alla porta non si
costruisce; gli edifici dei salvataggi di prima vanno da soli nel primo posto libero vicino al centro; pressione
lunga 450 ms; zoom da tutto il quadrato a 4,5 celle; pulsanti dell'interfaccia non interattivi (covers) perché il mondo
sotto riceva i tocchi; in battaglia guida solo il primo dito; Esplora apre ancora la mappa del 4.5 fino al 4.8.
Misure: build ok; sim-4-7 139/139 (6 nuovi: geometria, isometria, posti, mettere/spostare, profilo, salvataggio);
e2e run-4-7 19/19 senza errori (obiettivo, menu, trascinare e ✓, cantiere, Accelera, bolla, pressione lunga,
fuori dal territorio rosso e ✗, rotella, pizzico, trascinamento, ~58 FPS, Esplora/Eroi/Sfida e ritorno con la stessa
vista, salvataggio del 4.6, battaglia con due dita); fuzz-4-7 un minuto di gesti a caso senza errori né posti
sbagliati; leak-4-7 immagini registrate ferme (16 → 16 → 16 → 17); focus-4-7 vista dentro il mondo.
Revisione (4 lenti, 8 agenti): corretti la perdita di memoria a ogni ridisegno (anche mappa ed eroi, da prima), la
vista che usciva dal mondo andando su un edificio, il suggerimento illeggibile sulla nebbia, il posto verde/rosso
poco visibile (ora bordo sopra e edificio rosso), etichetta e export inutili, numeri del tileset nel codice, il
rapporto 2 fisso nei rombi; in più (veri ma non introdotti, o piccoli) tocco annullato dal telefono, pizzico sulle
bande nere (touch-action), pizzico partito da un edificio tenuto premuto, cantiere spostato con l'aspetto del
cantiere, edificio toccato in vista tutto (cima e angolo sud), fascia dei pulsanti che non lascia passare i tocchi,
posti salvati validi tenuti prima di rifare quelli rotti. Respinti: dividere World.js (sarebbe anticipare il 4.8),
la chiamata diretta a WorldUI.covers (domanda sincrona, documentata).

# Dopo il 4.7 (50e571f, pubblicato il 2026-10-25 su sua richiesta)
L'utente: "Ok. Procedi con push e andiamo al punto 4.8".

## 4.8 — strada unica dalla porta, caselle, aree da conquistare
Snapshot: snapshot-4-8 · diff: diff-4-8.patch · messaggio: commit-4-8.txt
File: `config/balance.js` (WORLD_VIEW.road, ground.road, fog.current, depth.standing/tie, HUD.world.road, news,
roadSheet, wideButton, FX.worldGain/fogReveal; via HUD.map), `core/events.js`, `data/road.js` (nuovo),
`data/world.js` (road, wallMargin), `data/map.js`, `meta/map.js` e `scenes/Map.js` (tolti), `fx/worldFx.js` (nuovo),
`main.js`, `meta/road.js` (nuovo), `meta/profile.js`, `meta/village.js`, `meta/world.js`, `meta/rewards.js`,
`scenes/Lineup.js`, `scenes/World.js`, `scenes/WorldUI.js`, `scenes/buttons.js`, `view/iso.js`, `view/worldAtlas.js`,
`view/worldRoad.js` (nuovo), commenti in `data/loadout.js`, `data/village.js`, `meta/loadout.js`, `systems/*`.
Scelte mie: strada disegnata a mano (road/design.py la controlla), a spirale: anello vicino da est in senso orario,
poi quello esterno; angoli su due lati, aree di lato con una gobba verso il centro (una strada che in ogni area segua
solo i bordi senza toccare i pezzi vicini non esiste: cercata in modo esaustivo con aree di 7 e di 5 celle,
road/search*.py); 10 caselle nella prima area, 13 nelle altre; battaglia 1 razione e boss 2 (con 2 e 3 il bot
aspettava la fattoria 10-20 min per area); vista: le prossime 2 caselle e il boss, punto di domanda sulle altre
dell'area; nebbia leggera sull'area da conquistare; gli edifici nelle aree conquistate a una cella dalle mura.
Misure: build ok; sim-4-8 140/140 (via gli 8 della mappa a bivi, 9 nuovi: percorso senza contatti, caselle, passi,
conquista, territorio, salvataggio, regole delle battaglie, quattro aree col bot a tempo vero 11-23 min per area senza
attese, revisione); e2e run-4-8 18/18 senza errori (porta, Esplora, neutra, raccolta, battaglia e schieramento,
Mondo e Combatti, persa e vinta, boss e conquista con la notizia e il terreno, fucina nell'area conquistata, tocchi
su capo, strada e terreno, senza razioni, Raccogli, lasciata a metà, ultimo boss, punti di domanda, mura davanti alla
caserma, 60 FPS); run-4-7b (il 4.7 rifatto sul 4.8) 18/18; fuzz-4-8 un minuto di gesti, passi e vittorie a caso senza
problemi; leak-4-8 immagini ferme (18 → 18 dopo i giri).
Revisione (4 lenti, 4 agenti): corretti l'ultimo boss che mandava in errore la scheda (e bloccava il gioco se perso),
le mura davanti coperte dagli edifici dentro (ordine di disegno sul centro del posto), le righe della scheda fuori dal
bordo (più corte e strette se serve), il tocco della schermata prima che premeva Parti nello schieramento (pulsanti
solo con il dito appoggiato su di loro), la doppia uscita dal mondo, il capo coperto dagli edifici al tocco, caselle
trovate fuori dal mondo, la cassa che spariva prima dell'arrivo, la vista che lottava con il dito, i testi delle
razioni (fattoria in costruzione, due razioni, Raccogli), i nemici scritti meglio, raccolte senza ripetizioni, il
punto di domanda; regole: World.js diviso (view/worldRoad.js), commenti vecchi, etichetta non usata, export inutili,
separatori, righe della scheda con nomi loro, colori dei pali una volta sola. Lasciati: perimetro vero di ogni area
(da decidere con l'utente), salvataggio legato ai dati della strada, il caso senza fattoria né materiali né razioni.

# Dopo il 4.8 (000f97c, pubblicato il 2026-10-25 su sua richiesta)
L'utente, visto il 4.8: battaglie di durate diverse con i loro colori, velocità quasi costante e più nemici invece
che più veloci, materiali anche dai nemici normali (la percentuale la calcolo io), difficoltà da cambiare per provare.
Questionario: corta 2 ondate senza boss, media 4 + boss, lunga 6 + boss, boss d'area sempre lungo; bandiere
bianca/arancio/rossa; difficoltà solo per le prove; poteri, armi e potenziamenti dopo il gate e prima della grafica.
A metà lavoro: «Stop. Invece una difficoltà così alta è proprio quello che serve per fermarsi e potenziarsi»: le
lunghe restano dure (tolta la mia idea di più nemici passati concessi nelle lunghe).

## 4.9 — velocità quasi costante, più nemici, materiali dai nemici normali
Snapshot: snapshot-4-9 · diff: diff-4-9.patch · messaggio: commit-4-9.txt
File: `config/balance.js` (POWER.levelScale), `data/rewards.js` (DROPS dei nemici normali), `data/waves.js`.
Scelte mie: campo a 270, 280, 290, 300 (prima da 190 a 400); materiali: uno su dieci dai normali e dai veloci, uno su
quattro da corazzati e tiratori, uno su cinquanta dalle pedine degli sciami (circa 17 a battaglia contro gli 8 di
prima, di più nelle ultime ondate).
Misure: sim-4-9 142/142 (nemici attesi 26 → 96 → 186 → 224, bot 52% su 200 con perse 3/15/20/20/1%, materiali
0,9/1,5/2,6/7,5 e 5 dal boss); e2e fps-4-9 58 FPS.

## 4.10 — battaglie corte, medie e lunghe, bandiere colorate, difficoltà di prova
Snapshot: snapshot-4-10 · diff: diff-4-9-4-10.patch (dal 4.9), diff-4-9-4-10-both.patch (dal 4.8, i due step insieme)
· messaggio: commit-4-10.txt
File: `data/waves.js` (6 ondate, LENGTHS, ondate 1-4 ritarate), `systems/waves.js` (battlePlan, reachedBoss),
`systems/battle.js`, `systems/spawn.js` (countScale, vita del boss scalata), `systems/power.js`, `data/road.js`,
`meta/road.js` (battleLengths con un seme suo), `view/worldRoad.js` (bandiere), `scenes/Lineup.js`, `scenes/WorldUI.js`,
`config/balance.js` (TEST_BATTLE e la cartella del pannello, bandiere, testi, POWER.levelScale 0.0138, pool 240),
`debug/playtest.js`, `sim/run.js`, `sim/worker.js`, `sim/game.js`, `sim/report.js`, commenti in `systems/boss.js`,
`data/enemies.js`, `data/loadout.js`, `data/rewards.js`.
Scelte mie: prima area corta, media, media; nelle altre la prima corta e le altre da un sacchetto (corta, media,
media, lunga), mai una lunga subito prima del boss; boss della strada ×1 (era ×1,25: è già lungo, con 1,8 volte la
vita); ondate 5 e 6 a 310 e 320; numero dei nemici attesi sempre in crescita (34, 96, 203, 218, 286, 297); peso della
potenza per durata (corta 4,4, media 1, lunga 0,6).
Misure: sim-4-10 146/146 (corta 85% «Facile», media 51% «Normale», lunga 34% «Difficile», nessun salto di perse;
eroi a livello 6 e 3 stelle: 75/100 contro 53/100 nella media; su 200 semi la media va dal 51% al 79% e la lunga dal
34% al 68%; materiali 1,2/1,6/3,3/8,9 e 5,8 dal boss, circa 21 a battaglia media); e2e run-4-10 7/7, run-4-8 18/18,
run-4-7b 18/18, fuzz-4-8 e leak-4-8 senza problemi, fps-4-10 57,9 FPS nell'ondata 6 e 57,5 nella 5 con l'esercito al
tetto; build ok; righe entro 120.
Correzioni della revisione: vita del boss letta dai dati vivi (BOSS_STARTED con hpScale), battlePlan unico punto per
durata e difficoltà di prova, reachedBoss al posto delle fasi copiate, testi dello schieramento e della scheda, durate
della strada (niente "dalla più corta alla più lunga", niente lunga prima del boss), commenti vecchi. Controllo del
potenziamento portato a 100 semi (i primi 40 sono fortunati: media al 65% invece del 51%), la soglia in proporzione.
Lasciati per l'utente: economia dei materiali che si gonfia, fascia di potenza che non conta il villaggio, muro fatto
di fortuna e attese, cancelli poco utili nelle ondate 5-6 per il tetto, boss che non è un culmine.

# Dopo il 4.10 (pubblicati il 2026-10-25 su sua richiesta)
L'utente: "Fai commit e push di 4.9 e 4.10; prima gioco il gate della Fase 4, poi pensiamo alla grafica."
Commit: 1174891 (4.9, solo balance.js, rewards.js, waves.js nella versione di snapshot-4-9) e f6a444a (4.10, uguale a
snapshot-4-10); push su main, deploy di GitHub Pages riuscito, il link pubblico ha i testi della 4.10.
Prima, su sua domanda, ricerca su strumenti per grafica, mappa e UI (Tiled, Photoshop con psd-tools, Aseprite, Blender
renderizzato, Figma da autorizzare, Android Studio solo per l'app Android): consigli dati in chat, niente codice.
Prossimo: lui gioca il gate della Fase 4 (un'ora senza strumenti); poi grafica (contratto degli asset, progetto Tiled,
importatore, banco di prova, risoluzione 1080×1920) e Fase 4b.

## A7 — le porte valgono solo quando ci passano gli eroi
L'utente, dopo aver giocato: con gli eroi in una corsia prendeva cancelli delle corsie accanto grazie a pochi soldati
di lato, e con un esercito grande la linea dei cancelli stava al fronte della folla, quasi a metà schermo, invece che
in basso con gli eroi: non ci si poteva spostare all'ultimo.
File: `config/battle.js` (GATES.despawnZ), `systems/army.js` (heroLeft, heroRight, heroFront), `systems/gates.js`
(reachGates, takenGate, missed), `sim/bot.js`, `tests/unit/battle-gates.test.js`.
Regola: un cancello si giudica quando arriva al fronte degli eroi (non a quello della folla) e vale se la fila degli
eroi, dal bordo del primo a sinistra a quello dell'ultimo a destra, ne tocca la larghezza; i soldati da soli non ne
prendono. Di una coppia vale quello più vicino al centro della fila; con il centro esattamente in mezzo il peggiore.
Il cancello preso sparisce come prima; quelli mancati vanno avanti senza effetto e spariscono a despawnZ (-300, sotto
lo schermo). Il bot usa la stessa regola (takenGate) invece della larghezza della folla.
Scelte mie: la fila degli eroi e non il solo centro, perché vale quello che si vede (un eroe che ci passa sotto lo
prende) e la regola della coppia resta viva: a metà tra due corsie gli eroi toccano tutti e due i cancelli; al centro
di una corsia la fila (240 con cinque eroi) non tocca i cancelli accanto (10 di margine). Il centro è quello della
fila, non il punto guidato: con lo schieramento di partenza sta 20 più a destra.
Misure: lint ok; npm test 143/143; test:all 156/156; simulatore 300 partite dal seme 1, prima → dopo: corta 84% →
79% «Facile», media 51% → 55% «Normale», lunga 36% → 38% «Difficile», durate 58 → 59 s, 122 → 124 s, 177 → 176 s;
e2e lengths (al secondo giro: al primo la scheda della strada non era pronta) e fps 56,4/57,4 FPS; prova a vista con la
folla al tetto: i cancelli ai lati passano tra i soldati e scendono sotto lo schermo, quello davanti agli eroi si prende.

## A8 — bottino più visibile
L'utente, dopo aver giocato: la scritta dei cancelli va bene; va resa più chiara quella dei materiali e delle altre
cose lasciate dai nemici, più piccola di quella delle porte ma più visibile.
File: `config/fx.js` (FX.lootPick con popMs, popScale, burstMs, burstRadius, ringWidth, alpha; FX.lootGain nuovo),
`fx/lootFx.js` (gains, gainFade, lootPop), `fx/effects.js` (ageEffects anche per effetti senza posto sul campo),
`view/overlayView.js` (drawLootGains, paintKind), `view/marksView.js` (drawLootPicks), `view/canvas.js` (commento),
`tests/unit/meta-loot.test.js` (188, 189), `tests/e2e/lengths.e2e.mjs`.
Regola (solo disegno, la raccolta non cambia): a ogni premio preso, vicino agli eroi, 56 pixel sopra il numero dei
soldati, la quantità con la sua parola ("+1 materiale", "+20 esperienza") in 36 px (i cancelli 64), del colore della
faccia davanti della sua cassa; ferma 800 ms, poi sale di 40 e sfuma in 500 ms. I premi dello stesso tipo presi mentre
la scritta è ferma si sommano in quella ("+3 materiali"), che riparte con un piccolo scatto; più tipi insieme stanno
uno sopra l'altro (44 pixel), ognuno nella prima riga libera, e la scritta resta dentro lo schermo con gli eroi su un
lato. Dove l'esercito prende il premio il suo valore resta come prima (sale e scorre con il campo) ma compare
ingrandito di 0,4 e ha il colore della sua cassa, così non si confonde con le scritte dei premi ancora in strada; a
terra un anello dello stesso colore si allarga fino a 90 e sfuma in 350 ms. Tutto con FX.enabled, scritte in pool.
Scelte mie: la scritta sopra il numero dei soldati e non al centro come quella dei cancelli (al centro c'è già lei, e
così segue gli eroi); il colore della faccia davanti delle casse (la più carica, i cinque tipi si distinguono); somma
solo finché la scritta è ferma, così non salta indietro mentre sale; l'anello a terra e non un disco pieno (sul grigio
della strada il disco giallo trasparente sembrava una macchia marrone).
Misure: lint ok; npm test 145/145 (2 nuovi); test:all 158/158; simulatore 300 partite dal seme 1, uguale all'A7 (non
legge effetti e viste): corta 79% «Facile», media 55% «Normale», lunga 38% «Difficile», durate 59, 124, 176 s; e2e
lengths con il nuovo controllo (prima scritta «+1 materiale» del colore #e0b23a sopra il numero dei soldati, foto
A8-bottino-preso) e fps 56,8/57,3 FPS (ondate 6 e 5).
Lasciati: la riga del bottino in alto dice "1 materiali" (parole solo al plurale in HUD.loot.words); sotto una folla
grande l'anello a terra si vede poco, coperto dai soldati.

## A3 — battaglie più corte e più fitte
L'utente, dopo aver giocato: nella conquista e nell'avanzamento sulla strada accorciare la durata media di ogni partita,
compensando con le orde di nemici il tempo in meno, perché la sfida resti avvincente (velocità del campo sempre quasi
costante, a crescere solo il numero dei nemici).
File: `data/waves.js` (WAVES: ondate di 17 s, arrivi, vita, cancelli, colpi degli scrigni; LENGTHS: bossHpScale della
lunga e powerScale; BOSS.hp; commenti), `data/rewards.js` (DROPS: materiali dei nemici), `config/battle.js`
(POWER.levelScale, ENEMIES.poolSize e swarmPoolSize, commento dei cancelli), `tests/support/suite.js` (weaponArena),
`tests/unit/battle-lengths.test.js` (190), `tests/stats/136, 171, 180` (ritoccati), `tests/stats/191` (nuovo).
Regola: ogni ondata dura 17 s invece di 25 (le ondate con le pause: corta 37 s, media 77, lunga 117), alla stessa
velocità di prima (270-320); per ondata le stesse 2, 4 e 6 ondate e il boss. I nemici arrivano più fitti, circa un terzo
in più al secondo (2,1 / 4,9 / 11,0 / 11,8 / 15,4 / 16,1 contro 1,4 / 3,8 / 8,1 / 8,7 / 11,4 / 11,9), un po' meno per
ondata. I cancelli tengono il loro ritmo (uno ogni 4 s: 4 arrivi a ondata invece di 6) e valgono circa una volta e
mezza (+9..15 nella prima, +38..50 nella sesta), così l'esercito arriva all'ondata 4 come prima (125 contro 132); gli
scrigni sono 4 a ondata e chiedono un quinto di colpi in meno (30/72/92/96/104/100), perché l'orda davanti gliene
toglie. Il boss ha meno vita (6200, la lunga ×1,5 invece di 8000 e ×1,8) e la sua fase non si allunga (14 e 15 s).
Materiali dei nemici tre quarti di prima (normali 0,075, corazzati e tiratori 0,19, sciami 0,015, élite 0,5): al minuto
come prima, a battaglia meno. Fasce ritarate: POWER.levelScale 0,0146, powerScale corta 4,8 e lunga 0,76.
Scelte mie: cancelli sempre ogni 4 s (con 3 s il bot, a inseguirli, lasciava scoperte le corsie: corta 64%, media 38%);
vita dei normali non sempre in salita (6, 30, 60, 50, 64, 55): con le ondate corte gli ultimi secondi di ogni ondata si
combattono nel tratto dopo, e l'ultimo tratto della media e della lunga ha anche la coda della sua ondata; per non avere
un salto di perse lì le ondate 4 e 6 hanno nemici più deboli e più numerosi; pool dei nemici a 280 (picco 279 nel
simulatore), degli sciami a 10.
Misure (simulatore, 300 partite dal seme 1, prima → dopo): corta 79% → 85% «Facile» (rapporto 1,89 → 1,68), perse
5/17 → 3/12%, vinte in 61 → 45 s; media 55% → 55% «Normale» (1,03 → 1,04), perse 5/13/15/20/1 → 3/9/13/27/1%, vinte in
131 → 100 s, boss 13,9 → 14,0 s; lunga 38% → 37% «Difficile» (0,94 → 0,81), perse 5/13/15/17/13/25/1 →
3/9/13/21/17/26/0%, vinte in 188 → 140 s, boss 15,2 → 14,6 s; nessun salto di perse. Materiali raccolti a battaglia
3,4/18,0/26,7 → 2,5/14,0/19,5, al minuto 3,6/10,6/12,7 → 3,6/10,7/12,3. Vita dei nemici a metà vittorie: media a
rapporto 1,0, corta 1,0, lunga 1,06 (prima della ritaratura 0,96, 1,09 e 1,27). Lint ok; npm test 146/146; test:all
160/160; campagna del 167: aree in 9-21 min (prima 13-28), al massimo 4 perse di fila; e2e lengths (corta finita in
46 s) e fps 55,8/57,4 FPS (ondate 6 e 5, prima 56,8/57,3).
Prove cambiate: weaponArena resta senza arrivi anche alle ondate dopo (con le ondate di 17 s nei 40 s del 33 arrivava
l'ondata 3); 180 durate delle vinte 45-90/100-150/160-230 → 40-50/90-105/130-150 s; 171 materiali a battaglia 13-22 →
10-17 e in più al minuto 9-12,5; 136 da 40 a 100 semi, +4 → +10 (sui primi 40 il villaggio dava 25 → 25, su 300 semi
+17 punti). Nuove: 190 (ondate corte e fitte, cancelli 4 a ondata e sempre più ricchi, nemici al secondo in salita),
191 (fase del boss al massimo 16 s nelle vinte).
Lasciati: la media vince il 55% (A7 55%, prima 51%): con le ondate 3 e 4 più dure il salto di perse nell'ultimo tratto
arriva a 15; salto più alto della media 13-14 punti (prima 5); il villaggio pesa meno (caserma e fucina al livello 2:
+17 punti contro +22, la caserma conta meno con cancelli più ricchi); esperienza, frammenti e rottami delle élite e il
premio della vittoria restano a battaglia, quindi al minuto crescono; il boss resta un tratto piatto. Nota della
revisione della notte: il salto della media (13,2 punti, nell'ultima ondata) sta 1,8 punti sotto SIM.flags.lossJump, e
secondo la revisione basta +1 alla vita dei nemici della seconda ondata (WAVES[1].enemyHp) per superarlo; dalla
revisione le prove 94 e 181, che fermano la pubblicazione, guardano i salti con il margine del campione.

## A5 — un modo solo nel mondo: toccando la strada si esplora
L'utente, dopo aver giocato: non gli piace dover scegliere tra Costruisci ed Esplora; vuole un modo solo: se tocca una
casella è perché esplora, quindi toccando la prima casella utile si apre la schermata della battaglia.
File: `meta/road.js` (walk, canFight, enterBattle, targetTile), `meta/actions.js` (step con walk, enterBattle nuova,
prepareBattle che entra nella casella), `meta/world.js` (conquestAreaOf), `sim/campaign.js` (openLineup),
`scenes/World.js` (tap diviso in tapPlacement, tapWorld, pickAt, tapRoad; showRoad; walk senza battaglie),
`scenes/WorldUI.js` (Strada al posto di Esplora, niente scheda al ritorno), `scenes/worldSheets.js` (scheda della
strada senza Avanza e Combatti), `scenes/Lineup.js` (canFight, costo sulla riga dell'area), `view/worldRoad.js`
(roadTileUnder, targetUnder, inCurrentArea), `view/worldAtlas.js` (markerHeight), `fx/worldFx.js` (flashCell,
clearFlash), `config/hud.js` (roadButton, pulsanti in basso, labels.road, road.hint, roadSheet.hintY,
ruleLabels.cost e retry; via exploreButton, explore, step, fight), `config/worldView.js` (depth.flash; via
road.battleDelayMs), `config/fx.js` (cellFlash), `core/events.js` (via STEP_REQUESTED), commenti in `config/sim.js`,
`data/road.js`, `main.js`; prove: `tests/unit/meta-road.test.js` e `meta-actions.test.js` (A5 nuovi),
`settings.test.js`, `tests/e2e/road.e2e.mjs` (rifatta), `village`, `settings`, `lengths`, `fuzz`, `leak`.
Regola: nel mondo non ci sono modi. La casella da toccare per andare avanti è la prossima, o quella del capo se è una
battaglia da vincere. Toccandola: su una neutra o una raccolta il capo ci cammina (e raccoglie), come faceva Avanza;
su una battaglia o il boss si apre lo schieramento, senza pagare; se le razioni non bastano si apre la scheda della
strada, che dice quante ne mancano, quando arriva la prossima e, se la fattoria ne ha, Raccogli. Le razioni si pagano
solo con Parti, quando il capo entra nella casella (prepareBattle → enterBattle, evento stepped con l'azione
enterBattle); Mondo dallo schieramento non costa niente; persa o lasciata a metà si riprova dalla stessa casella senza
pagare; il boss costa 2; il costo di tutta la strada è lo stesso (143 razioni). Un passo (step) non va più su una
battaglia. Le altre caselle, il capo (se non sta sulla casella da toccare) e l'area da conquistare aprono la scheda
della strada, senza pulsanti che fanno quello che fa il tocco; il resto del terreno la chiude. Un tocco vale solo se
il dito non si è mosso (la soglia di sempre di scenes/worldInput.js): trascinare la vista non fa mai niente. In basso
Eroi, Costruisci (un menu) e Strada, più piccolo, che chiude le schede, porta la vista sul capo e accende per un
momento la casella da toccare.
Scelte mie: la casella da toccare si prende anche sul suo segno (la bandiera, il boss, la cassa: la sagoma della
casella alzata fin dove arriva il segno), perché è quello che si vede; tra lei, il capo e gli edifici vince chi sta
davanti (alla porta il capo sta appena dietro alla prima casella e ne copriva metà). Il capo sulla battaglia da
vincere vale come la sua casella: toccandolo si riprova. Di ritorno dallo schieramento o dalla battaglia niente
scheda: la vista va sul capo e la casella da toccare si accende, come con Strada (la scheda si accende anche lei).
L'accensione è un rombo giallo che pulsa 3 volte in 1,7 s (FX.cellFlash), sopra la nebbia e sotto le cose in piedi;
senza effetti resta accesa ferma per lo stesso tempo. Nella scheda della strada, al posto di Avanza, la riga «Tocca la
casella che si accende per andare avanti». Nello schieramento, sulla riga dell'area, «partire costa 1 razione» (2 il
boss) o «si riprova senza pagare»: una riga in più toccava le pedine. Strada nel colore di Esplora (è la via per la
strada), i tre pulsanti larghi 248, 248 e 170. Nel simulatore della campagna il bot tocca la battaglia (apre lo
schieramento, il tempo di un passo) e parte al giro dopo, dopo la sfida se c'è: stessi tempi e stesse battaglie di
prima, le campagne non cambiano.
Misure: lint ok; prove senza grafica 204/204 (2 nuove), tutte le righe della base uguali, simulatore con semi fissi
identico (corta, media, lunga, 120 partite dal seme 1), campagne del bot identiche; e2e 10 su 10 senza errori in
console (road 22 controlli, FPS 57,6/57,2; village 57,2/57,3; fps 56,6/57,3 alle ondate 6 e 5; fuzz: strada dalla
casella 23 alla 42 passando per le battaglie).
Prove cambiate: settings.test (Strada al posto di Esplora, stessa riga); e2e road rifatta con i tocchi veri (Strada,
scheda dal capo, neutra, raccolta, trascinamento, battaglia senza pagare, Mondo, Parti, persa, riprova dal capo,
boss, scheda da un'altra casella e dall'area, senza razioni, Raccogli, lasciata a metà, ultimo boss), village
(Strada e battaglia dal capo), settings (Strada sotto il menu), lengths, fuzz e leak (la casella toccata con
tapRoad al posto di stepRequested; nel fuzz la battaglia parte con enterBattle prima di vincerla, nel leak le
battaglie si saltano). Nuove: A5 di meta-road (passi e battaglie su tutta la strada, costo totale) e di meta-actions
(pagata partendo, riprova gratis, boss, senza razioni).
Lasciati: la scheda della strada parla della prossima casella anche se si è toccata un'altra; la casella che si
accende non resta accesa (dopo 1,7 s si vedono solo i segni).

## A1 — più cantieri insieme, da un posto solo
L'utente, dopo aver giocato: vuole migliorare più edifici insieme, mettendo in cantiere più miglioramenti; all'inizio
un posto solo, con la possibilità di aumentare quanti edifici salgono insieme. Come si avranno i posti in più non è
ancora deciso (lo si chiederà): per ora li cambia solo il pannello di sviluppo.
File: `data/village.js` (VILLAGE.builders), `config/settings.js` (SAVE.version 3), `core/save.js` (migrazione 2 → 3),
`meta/profile.js` (village.sites, sitesFrom), `meta/village.js` (freeSlots, siteOf, firstSite; settle, canUpgrade,
startUpgrade, nextGoal, clampFuture sulla lista; timeLeft, useAccelerator, canChallenge, startChallenge, winChallenge
con l'edificio), `meta/actions.js` (useAccelerator e startChallenge con l'edificio, la sfida di context.building,
started), `core/events.js` (commento), `view/worldWords.js` (goalText, sitesText, timeLeftText con l'edificio,
rationsText), `scenes/worldSheets.js` (drawSites, il cantiere dell'edificio della scheda), `scenes/WorldUI.js`
(goToGoal), `scenes/World.js` (un tempo per cantiere: timers, state), `scenes/Lineup.js` (building, riga del premio),
`main.js` (commento), `config/hud.js` (labels.sites e allBusy al posto di building e oneAtATime), `debug/cheats.js`
(finishBuild e skipTime su tutti i cantieri, setBuilders), `debug/metaPanel.js` (posti cantiere, +1 e -1),
`config/debug.js` (scritte), `sim/campaign.js` (il bot riempie i posti liberi, accelera e sfida per cantiere); prove:
`tests/unit/meta-village.test.js`, `meta-actions.test.js`, `meta-save.test.js`, `debug-cheats.test.js` (A1 nuovi),
`meta-world.test.js`, `sim-campaign.test.js`, `tests/stats/167`, e2e `village`,
`cheats`, `road`, `fuzz`.
Regola: i cantieri aperti sono una lista (village.sites, in ordine di apertura), al massimo uno per edificio e
VILLAGE.builders in tutto (1). Un edificio sale se c'è un posto libero, non ha già un cantiere, non è al massimo e le
risorse bastano. Ogni cantiere finisce alla sua ora, anche ad app chiusa, uno dopo l'altro in ordine di fine (la
fattoria produce al livello di prima fino alla fine del suo); con l'orologio tornato indietro ognuno dura al massimo il
suo livello intero. Acceleratore e sfida valgono per il cantiere dell'edificio della scheda aperta (la sfida porta
l'edificio nello schieramento e fino al riepilogo), una sfida per cantiere; gli eventi CONSTRUCTION_* dicono
l'edificio. Il prossimo obiettivo è per un posto libero: tra gli edifici senza cantiere quello più indietro, con quanto
manca, come prima; senza posti liberi la riga dice i posti e il cantiere che finisce per primo («Cantieri: 2/2 · Fucina
liv. 1 finisce tra 2 min 58 s») e toccandola si va lì. Sul mondo ogni cantiere ha il suo tempo. La scheda
dell'edificio e il menu Costruisci hanno a destra del titolo «Cantieri: occupati/posti»; a posti tutti occupati, al
posto del costo, «Tutti i cantieri sono occupati», con Migliora e Costruisci spenti. Salvataggio alla versione 3: il
cantiere aperto di un salvataggio 2 diventa una lista con lui solo; alla lettura restano fuori i cantieri di edifici
sconosciuti o al massimo, con una fine non valida e i doppioni dello stesso edificio; quelli oltre i posti restano
(cambiato nella revisione della notte: prima restavano fuori, pagati e persi). Con un posto il gioco va come prima.
Scelte mie: l'obiettivo sceglie come prima (l'edificio più indietro, anche se non lo si può ancora pagare, con quanto
manca), saltando quelli già in cantiere: prendere «il migliore che si può pagare» avrebbe cambiato la scelta anche con
un posto solo, e con lei le campagne del bot. La riga a posti occupati dice sempre «Cantieri: 1/1 · Fattoria liv. 1
finisce tra …» (prima «Cantiere: Fattoria liv. 1, finisce tra …»), così dice anche perché non c'è un obiettivo. Nello
schieramento della sfida la riga del premio dice di quale edificio («Vinci: tempo del cantiere −50% · Caserma»).
Trucchi: «Finisci i cantieri» li chiude tutti; Posti cantiere -1 non scende sotto 1 né sotto i cantieri aperti (nessun
cantiere pagato si chiude), +1 non va oltre uno per edificio (3); un campo del pannello mostra i posti, e al limite
l'esito è «posti già al limite». Il bot della campagna apre cantieri finché ci sono posti e risorse, accelera e sfida
per cantiere nell'ordine di apertura, e aspetta le razioni al massimo fino al primo cantiere che finisce. I cantieri
finiti nello stesso momento si dicono nell'ordine degli edifici.
Misure: lint ok; prove senza grafica 196/196 (7 nuove), test:all 211/211; simulatore con semi fissi identico (corta,
media, lunga, 120 partite dal seme 1); campagna del bot identica con un posto (6 semi, 4 aree, contro l'A5); con due
posti (seme 1, 4 aree) il villaggio alla conquista è 2/2/1, 2/2/2, 3/3/2, 4/3/2 invece di 1/1/1, 2/2/1, 3/2/2, 3/3/2
(aree in 16, 19, 15, 11 minuti invece di 10, 20, 18, 12); e2e village, road, cheats, settings, fuzz e leak 6 su 6
senza errori in console (village 33 controlli, FPS 57,2/57,1; road 22, FPS 57,6/57,5; cheats 13).
Righe della base cambiate (8, tutte per la versione 3 o per la lista dei cantieri che stampano): campi sistemati e
profilo del villaggio ("construction":null → "sites":[], cantiere giusto in una lista, «null» → «[]»), copiato,
migrazione 1 → 2, salvataggio da zero, salvataggio (versione 3, migrazioni 2), strade rotte (stampava «versione 2»
scritto a mano: ora la versione di oggi), versione più nuova.
Prove cambiate: le prove del villaggio, delle azioni, del mondo, dei trucchi, della campagna e la 167 con la lista e
l'edificio (stesse righe, tranne quelle sopra); e2e village (cantiere nella lista, tempi sul mondo in timers, la sfida
dice la caserma), cheats (timers, cantieri), road (versione di oggi invece di 2), fuzz (svuota la lista). Nuove: A1 di
meta-village (due edifici insieme e fine in ordine, acceleratore e sfida su uno, obiettivo con posti liberi e
occupati, cantieri salvati rimessi a posto), meta-actions (due cantieri con i loro eventi), meta-save (migrazione
2 → 3, anche da un salvataggio 1), debug-cheats (Finisci e tempo saltato su due cantieri, limiti dei posti); e2e
village (con il trucco due posti: la fattoria dalla scheda e la fucina dal menu insieme, due tempi sul mondo, la
caserma che non sale, l'obiettivo, l'orologio avanti che li finisce tutti e due) e cheats (+1 e -1, due cantieri,
Finisci i cantieri, limiti).
Lasciati: i posti in più li dà solo il trucco e valgono finché la pagina resta aperta, come i valori del pannello:
ricaricando tornano 1, e i cantieri già aperti restano tutti (dalla revisione della notte; prima quelli oltre il primo
restavano fuori, pagati e persi); come avere posti in più è da decidere. Con due posti il bot finisce la prima area
più tardi (16 minuti invece di 10): il perché non l'ho cercato, con un posto le campagne non cambiano.

# Blocco B — fondamenta, senza cambiare il gioco (dopo il 4.10, prima del blocco A)
Riassunto dai messaggi di commit preparati (commit-B1..B14, nella cartella temporanea della sessione). In ogni step il
cancello del blocco: lint pulito, nessuna prova fallita, ogni riga di risultato di prima identica (salvo quelle dette),
simulatore con semi fissi identico; prove nel browser senza errori in console.

## A9 — pausa tra le ondate di 1,5 s e consolazione della prima sconfitta
Risposte dell'utente alle domande del blocco A: pausa tra le ondate 1,5 s (con le ondate corte 3 s erano più di un
decimo della battaglia); battaglia persa: un po' di esperienza, solo alla prima sconfitta su ogni casella.
File: `config/battle.js` (LEVEL.breakSeconds), `data/rewards.js` (REWARDS.consolation), `meta/rewards.js`
(grantRewards con consolation), `meta/road.js` (road.lost, loseRoadTile; step, storedRoad e restoredRoad con lost),
`meta/profile.js` (createRoad, roadFrom), `meta/actions.js` (finishBattle), `scenes/Summary.js` e `config/hud.js` (riga
della consolazione), `debug/cheats.js` (salti con lost); prove: `meta-actions` (consolazione nuova), `battle-chests`
(40), `meta-save`, `tests/support/suite.js` (onRoad), `stats/128` (margine del campione), `stats/campagna-quattro-aree`
(cinque semi), tolta `stats/167`; e2e `road`; `tests/fixtures/replay-corta.json` registrata di nuovo.
Regola: il cammino ricorda se la battaglia della casella dove si è è già stata persa (lost, salvato con l'area e il
posto e valido solo sulla sua casella); la prima sconfitta dà REWARDS.consolation.xp di esperienza in più, divisa
tra gli eroi come quella del premio; il passo dopo lo azzera. Né la vittoria né la sfida la danno.
Misure: simulatore 120 partite dal seme 1: corta 79% «Facile» (prima 83%), media 53% «Normale» (57%), lunga 36%
«Difficile» (38%); ondate con le pause: corta 37 s, media 77 s, lunga 117 s; tempo morto della media nell'ondata 2
da 5,1 a 3,5 s. Campagna di 6 aree su 6 semi senza blocchi, al massimo 6 perse di fila, 0% di attese.
Prove: la 167 (il ciclo delle prime quattro aree con un bot suo, doppione della campagna-quattro-aree: punto 29 della
revisione) con la pausa corta restava ferma 19 volte di fila su un seme; la campagna vera, che sfida e accelera, al
massimo 6. Tolta, e la campagna-quattro-aree gioca i suoi cinque semi. La 128 guarda le vittorie in più con il
margine del campione, come la 126. La 40 conta il ritmo degli scrigni dall'inizio di ogni ondata (con la pausa di 3
s il secondo inizio cadeva per caso sullo stesso ritmo).

## A4 — scorte dell'era 1: legno e pietra, ingranaggi e circuiti
Risposta dell'utente (domanda 4, proposta compatta): materiali in legno e pietra, rottami in ingranaggi e circuiti (i
circuiti solo dai boss), razioni uniche. Regola: un sottotipo ha senso solo se si ottiene e si spende in modo diverso.
File: `data/village.js` (start, costi per tipo), `data/rewards.js` (DROPS e premio della vittoria), `data/road.js`
(raccolte e conquista con il circuito), `config/battle.js` (colori e parole), `config/hud.js` (bottino in battaglia,
riepilogo, resourceLines), `config/settings.js` (SAVE.version 4, woodShare), `core/save.js` (migrazione 3 → 4),
`meta/village.js` (costi come mappa: upgradeCost.resources, canUpgrade, startUpgrade, nextGoal), `meta/rewards.js`
(tipi del bottino e del premio; restituisce resources), `systems/loot.js` (collected dai tipi di DROPS),
`view/worldWords.js` (costText), `scenes/WorldUI.js`, `scenes/BattleUI.js`, `scenes/Summary.js`,
`sim/campaignReport.js`, commenti in `config/fx.js`, `fx/lootFx.js`, `view/overlayView.js`, `view/words.js`,
`meta/profile.js`; prove: quasi tutte quelle del meta-gioco, la 171, e2e `cheats`, `lengths`, `road`, `settings`,
`village`; nuova la migrazione 3 → 4; `tests/fixtures/replay-corta.json` registrata di nuovo.
Regola: legno dai nemici leggeri e dalla vittoria; pietra da corazzati, tiratori, élite e conquista; ingranaggi da
élite, boss, raccolte e conquista; un circuito per area conquistata. Costi di oggi divisi: fattoria 70% legno, caserma
metà e metà, fucina 30% legno e più ingranaggi. Salvataggi di prima: materiali 60% legno e 40% pietra (per difetto il
legno), rottami in ingranaggi, un circuito per area conquistata; le scorte nuove che ci sono già restano.
Misure: simulatore come prima per le vittorie; il boss lascia legno e pietra separati, un premio in più che la fine
della battaglia aspetta (fase del boss della media da 5,7 a 6,2 s). Campagna di 24 aree su 4 semi in 5,1 ore senza
blocchi: alla fine 3061 legno, 4924 pietra, 711 ingranaggi, 24 circuiti in mano. Il gonfiarsi delle scorte resta: si
ritara con il centro città (passo dopo), che chiede edifici, scorte e circuiti per salire.

## A1b — centro città, Capanno dei mastri, razioni d'emergenza
Risposte dell'utente: un edificio nuovo, il Capanno dei mastri, che a certi livelli dà operai in più (scelti: il
secondo al liv. 2, il terzo al liv. 4); i livelli degli edifici non superano quello del centro città; il centro sale
solo con dei requisiti di costruzione (scelti: edifici precisi per livello, la tabella la propone Claude); le funzioni
nuove dei livelli del centro si progettano una alla volta con le fasi che le usano. Valvola anti-blocco (spiegata
all'utente: battaglie → razioni → fattoria → materiali → battaglie può chiudersi): il centro dà 1 razione ogni 10
minuti solo quando non bastano per la prossima battaglia.
File: `data/village.js` (center, lodge, commento), `config/worldView.js` (sagome, atlasMaxWidth),
`view/worldAtlas.js` (righe dell'atlante), `meta/village.js` (builders, lockOf, relieve, reliefIn; freeSlots,
canUpgrade, nextGoal, settle), `meta/road.js` (rationsNeeded), `meta/profile.js` (createVillage, homeOf, villageFrom
con il livello di partenza e relief), `view/worldWords.js` (sitesText, lockText, rationsText con now, effectText del
centro e del Capanno), `scenes/worldSheets.js` (lockText nella scheda e nel menu), `config/hud.js` (parole),
`debug/cheats.js` (skipTime), `data/road.js` e `data/rewards.js` (ritaratura); prove: `meta-village` (tre nuove),
`data` (centro e Capanno), `meta-actions`, `debug-cheats`, `meta-world`, `sim-campaign`; e2e `village`.
Regola: lockOf dice cosa tiene fermo il prossimo livello oltre a scorte e posti: per il centro gli edifici della sua
tabella sotto il livello chiesto, per gli altri il centro sotto il livello nuovo (per il Capanno almeno al 2). La
tabella chiede solo livelli che si possono avere con il centro un livello sotto (lo controlla la prova dei dati). La
valvola conta da quando mancano le razioni (relief.since, null se bastano; salvato), dà una razione ogni reliefMinutes
fino a bastare e poi smette; quando comincia o smette di contare lo salva subito, così vale anche ad app chiusa.
Misure (campagna di 24 aree su 6 semi): 5,5 ore (prima 5,1), nessun blocco, al massimo 7 perse di fila (con il centro
al 2 che chiedeva anche la fucina e 25/25 erano 11 in un seme). Centro al 3 verso l'area 4, al 4 verso l'area 8, al 5
verso l'area 17; villaggio completo verso l'area 24. Scorte in mano all'area 4: 216 legno, 110 pietra (prima della
ritaratura 314 e 200); all'area 24: 1584 legno, 1680 pietra (prima 2544 e 4298), che restano per le armi della 4b.
Rapporto di potenza tra 3 e 3,8 dall'area 6 in poi: la strada resta facile per il bot dopo le prime aree (da
ritarare con la crescita dei nemici, da decidere con l'utente).

## A6 — barra a icone, barra dell'edificio, striscia Costruisci e Catalogo
Risposte dell'utente (domande 5 e 6): barra in basso a 4 icone (Eroi · Costruisci · Strada · Catalogo), con armi,
inventario e missioni come schede del Catalogo quando arriveranno; l'edificio toccato apre una barra bassa a comparsa
con al massimo 4 icone e il mondo visibile, non una scheda grande né un pannello fisso.
File nuovi: `config/icons.js` (le icone provvisorie, forme semplici con un nome), `view/icons.js` (drawIcon),
`scenes/worldBars.js` (barra in basso, striscia Costruisci, barra dell'edificio), `meta/catalog.js` (stati e voci),
`view/catalogWords.js` (scritte), `scenes/Catalog.js`. Cambiati: `scenes/WorldUI.js` (le barre al posto della scheda e
del menu; sheet e placing all'avvio), `scenes/worldSheets.js` (solo la scheda della strada e le parti comuni),
`scenes/World.js` (worldTarget dal Catalogo), `scenes/buttons.js` (style), `scenes/Heroes.js` e `view/words.js`
(starText), `main.js` (scena Catalog), `config/hud.js` (bar, buildingBar, strip, catalog; tolti i vecchi pulsanti,
la scheda dell'edificio e il menu), `config/balance.js`; prove: `meta-catalog` (nuova), `settings`, e2e `catalog`
(nuova), `village`, `cheats`, `errors`, `road`, `settings`.
Regola: gli stati del Catalogo si leggono dal profilo e dai dati: un edificio è bloccato se lockOf lo tiene fermo al
livello 0, ottenibile se si può costruire, posseduto se costruito o in cantiere, potenziabile se in più può salire
adesso (niente lo tiene fermo, scorte che bastano, un posto libero); un eroe posseduto è potenziabile con i frammenti
della stella, gli altri sono ottenibili con il reclutamento; una scorta è posseduta se ce n'è, e dice da dove arriva
(i nemici che la lasciano, vittorie, raccolte, conquiste; le razioni anche fattoria e centro città) e a cosa serve
(gli edifici che la chiedono, battaglie, reclutamento, cantieri). Vai: l'edificio messo nel mondo con la sua barra,
quello da mettere che si può costruire comincia a mettersi, gli altri aprono la striscia Costruisci; l'eroe tra gli
eroi, che tornano al Catalogo. Le icone si toccano in rettangoli di almeno 90 pixel (48 dp nel layout da 720).
Misure: il mondo resta visibile per il 70% sopra la barra dell'edificio (300 pixel su 1016 tra le due fasce);
simulatore delle battaglie identico. La prova leak contava tutte le immagini registrate, ma ogni scritta di Phaser ne
registra una sua: con il segno "!" della barra il totale cambiava con quello che si vede. Ora conta quelle che non
sono di una scritta viva (8, ferme dall'inizio alla fine).
Revisione indipendente di A9, A4, A1b e A6: nessun errore nella logica (valvola, consolazione, migrazione, blocchi
del centro, catalogo, navigazione, controllati anche con prove in node). Corretti tre punti: la riga «Servono …» del
centro città nella sua barra usciva dallo schermo (778 pixel su 642: ora le righe troppo larghe si stringono, come
nella scheda della strada); nel Catalogo i requisiti del centro al liv. 2 andavano su quattro righe e l'ultima (i
circuiti) finiva sotto la scheda dopo (ora Vai sta accanto alle righe degli edifici, i requisiti hanno tutta la
larghezza e la scheda è alta 176: l'ultima riga finisce a 423 su 428, lo controlla la prova catalog); la migrazione
3 → 4 metteva 0 ingranaggi ai salvataggi senza rottami (quelli del 4.2), ora alla lettura prendono quelli di
partenza. «Pronta da costruire» diventa «si può costruire», che va bene anche al maschile. Lasciato: il trucco dei
posti cantiere non conta gli operai del Capanno quando li tiene dentro i limiti (solo nel pannello di sviluppo).

## R — battaglie da 45 s a campo fermo, porte con i colpi, forza, gemme e missioni
Richiesta dell'utente (prima del commit del blocco A): tempi di costruzione ragionevoli; un modo di fare farming di
acceleratori (gemme) con missioni e sfide; nemici che crescono con gli eroi, con un livello di forza; difficoltà dalla
gestione delle orde, non da uno squilibrio di numeri; colpi degli scrigni che seguono la potenza di fuoco; porte di
nuovo con i colpi, positive all'inizio e poi solo negative da girare o evitare; esercito largo al massimo due corsie;
battaglia di default con l'esercito fermo e tutto che scende. Risposte ai questionari: campo fermo; porte positive e poi
solo negative; due corsie; ogni partita circa 45 s, ogni 10 una da 90, ogni 50 da 135, ogni 100 da 180, con un contatore
in alto; 10 battaglie per area; boss solo nelle lunghe, a crescere (1, 2 insieme, 2 insieme e poi il più grande);
cantieri entro 1 ora; gemme da missioni e sfide.
Passi, fatti in fila e senza istantanee intermedie (la taratura li tiene insieme): campo fermo e due corsie
(`systems/formation.js` maxLanes, `view/fieldView.js`); tipi di battaglia, contatore e boss insieme (`data/waves.js`
BATTLE_TYPES, `data/road.js` cadence, `meta/road.js` battleType, `systems/boss.js` con la lista dei boss, `spawn.js`,
`waves.js` a gruppi, `scenes/BattleUI.js` barre affiancate e "Battaglia N", `view/marksView.js`, `sim/bot.js`; la
distanza sparisce da risultato, statistiche, schieramento, riepilogo e `systems/scroll.js`); porte con i colpi
(`systems/gates.js` GATE_HIT e stopsShots, `combat.js` firstGate, `fx/gateFx.js` lo scatto, `data/gates.js`
plus/minus/deep, massimi per ondata); forza (`meta/road.js` battleRules, `systems/power.js` con arrivi e tipi speciali,
`spawn.js` specialsScale, schieramento, scheda della strada, titolo degli eroi); gemme (`data/village.js` minuti e
gemMinutes, salvataggio 5); missioni del giorno (`data/daily.js`, `meta/daily.js`, `systems/feats.js`,
`scenes/Daily.js`, `meta/actions.js`, `Lineup` mode daily, `Summary`, quinta icona della barra, fonti delle gemme nel
Catalogo); taratura; due revisioni indipendenti.
Regole: le battaglie si contano dalla porta e il numero dice il tipo (il primo di cadence che lo divide); la decima di
ogni area è quella del boss e la conquista. Ogni battaglia chiede la forza attesa della squadra lì (ROAD.strength:
expected all'inizio di ogni area, misurata con la campagna del bot, interpolata dentro l'area) diviso il rapporto del
suo tipo (normale 1,3, boss 1,25, doppia 1,3, tripla 0,9) e per ease nelle prime sette aree (1,4, 1,25, poi 1,15 fino
alla sesta, 1,08 alla settima: l'inizio facile e il passaggio alle porte negative più morbido; mai in salita, così la
forza richiesta cresce sempre), tarata senza la difficoltà di prova, che vale una volta sola in battaglia: di quanto la
squadra è cresciuta, un quarto va in arrivi in più (al massimo ×1,6), il resto in vita; corazzati ed élite arrivano fino
a 1,8 volte più spesso, e se le quote dei tipi speciali passano 1 si stringono tutte nella stessa proporzione (nessun
tipo sparisce). Le porte: ogni colpo dritto +1 fino al massimo, fermano i colpi finché non ci arrivano (quelle già
mancate no); dall'area 4 tutte profonde, dal 20% della loro profondità, 7 punti in più per area. Colpi degli scrigni e
numeri delle porte × (1 + 0,005 a battaglia). Due boss insieme non passano mai uno attraverso l'altro: un boss cambia
corsia solo verso una libera senza un altro boss in mezzo; la scorta chiamata nella corsia di un altro boss esce davanti
a lui. Il giorno delle missioni cambia a mezzanotte del telefono (nel simulatore a mezzanotte UTC, così la campagna è
uguale su ogni computer); le azioni lo portano ad adesso prima di ogni cambio, ma il cambio di giorno da solo non scrive
(le missioni si ripescano uguali dal giorno: leggere non scrive); si pescano con il seme del giorno tra quelle che si
possono finire (abbastanza battaglie, boss o livelli da costruire davanti). Le sfide del giorno usano le regole della
prossima battaglia della strada con il loro tipo e rapporto, senza il numero della strada; si spendono partendo (niente
Ricomincia nella pausa) e vinte danno gemme al posto del premio della vittoria. Salvataggi 1 (fino al 4.10): la casella
è quella della strada di prima, con la prima area di 10 caselle (SAVE.legacyFirstArea): le caselle dopo si spostano di
quattro, e un boss salvato torna sempre sul boss della sua area, così un'area conquistata resta conquistata.
Misure: durate con una squadra che vince (prova 180) normale 52 s, boss 95, doppia 128, tripla 176 (la doppia è passata
da 8 a 7 ondate e la tripla da 11 a 9: con 8 e 11 duravano 144 e 208 s); bot con la squadra di partenza: normale 83%
«Facile», boss 66% «Normale», doppia 33% «Difficile», tripla 17% «Molto difficile» (pesi dei tipi 1,44, 0,76, 0,69, 0,5;
nella normale metà delle vittorie a rapporto 1,17, la tripla resta intorno a metà anche con nemici deboli perché si
perde per l'orda che passa); fase dei boss nelle vinte 13, 16 e 32 s (la tripla con la pausa tra i due gruppi). Campagna
di 24 aree su 6 semi: tutte in fondo in 8,7-10,0 ore, al massimo 9 perse di fila, attese 7%, niente da segnalare;
durante la taratura le porte tutte negative facevano muri alle aree 4-7 (fino a 36 perse di fila), sistemati con la
profondità che cresce più piano, la tabella della forza attesa rifatta, il passaggio più morbido e i boss d'area un poco
più facili (1,25: il boss chiude l'area, un muro lì ferma tutto). Materiali dai nemici nella battaglia col boss: 19 a
battaglia, 14 al minuto (con le porte a colpi l'esercito è più grande e abbatte di più). Esercito dopo la prima ondata:
38 soldati (prima 24).
Revisioni: la prima (un agente) ha trovato 8 difetti, tutti corretti: Ricomincia nella sfida del giorno, il ritorno
dagli eroi allo schieramento della sfida, la scorta che nasceva dentro l'altro boss, il numero della strada nelle sfide
del giorno, l'arrivo al boss tra due gruppi, la fase dei boss nel simulatore, le missioni impossibili in fondo alla
strada, la distanza rimasta; più commenti. La seconda (quattro revisori e uno scettico per ogni punto) ne ha confermati
21 su 26, tutti corretti: i due boss che si attraversavano, le quote dei tipi speciali che facevano sparire élite e
tiratori, la zona del boss dietro la telecamera (bloccava il gioco), BOSS.lane rimasto, missioni con il traguardo
irraggiungibile, il salvataggio 1 sulla strada nuova, la difficoltà di prova annullata nelle sfide del giorno, il
commento delle missioni, le fonti delle gemme nel Catalogo, il contatore in battaglia sopra l'esercito (si stringe), il
titolo delle sfide più largo dello schermo (si stringe), le Missioni ferme (ora contano i secondi e cambiano a
mezzanotte, anche il segno sulla barra), la scheda della strada troppo lunga (parole più corte), Indietro dalla sfida
(dice Missioni), le regole sopra gli eroi (più strette), la scritta della gemma più larga del pulsante, la prova 191
sulla tripla, la prova degli FPS che cercava le battaglie lunghe, la campagna che cambiava con il fuso orario, scritte
vecchie nelle prove e nel resoconto. Scartati 5 (la gemma su un cantiere quasi finito toglie meno di 10 minuti ma lo
finisce: va bene; la battaglia registrata, già rifatta; tre su prove poco severe).
Lasciati: le sfide del giorno non le gioca il bot della campagna (ritira solo le missioni); la sfida dei cantieri resta
con le sue regole fisse (vita ×1,2, normale).

## B1 — registro e architettura
Questo registro entra nel progetto (finora in una cartella temporanea); CLAUDE.md con l'albero vero e da aggiornare a
fine step.

## B2 — prove senza grafica nel progetto
I 146 controlli della vecchia suite in tests/unit (veloci, npm test, circa 4 s) e tests/stats (lunghe con il bot, una
per file, in parallelo, npm run test:stats, circa 2 minuti), risultati identici riga per riga; tests/support con il
codice comune e il controllo che scrive OK o ERR con quello che misura; il controllo dei dati (data.test.js); Node 24.

## B3 — stile, pubblicazione dopo le prove, prove nel browser
eslint (righe di 120, niente variabili inutilizzate, casualità solo da core/rng.js, niente Phaser nella logica);
deploy.yml pubblica solo dopo lint e prove (a mano si potevano saltare); tests/e2e con un server di Vite suo, Edge o
Chrome senza finestra, profili fuori dal progetto, npm run test:e2e.

## B4 — salvataggio 2, il posto sulla strada regge i cambi delle aree
SAVE.version 2 e la prima migrazione: il cammino {at, done} diventa {area, offset, done}; una migrazione che manca o si
rompe non blocca l'avvio (status corrupt). Cambiate solo le due righe che scrivevano la versione.

## B5 — copia di riserva, salvataggio rovinato, avvisi
SAVE.backupKey (un passo) e SAVE.brokenKey; ripresa della copia (restored) o da zero (corrupt); writeSave dice se ha
scritto; un avviso per tipo nel mondo. (Rivisto nella revisione della notte: leggere non scrive più niente.)

## B6 — un orologio unico
core/clock.js now(), che va solo avanti; il villaggio regge l'orologio del telefono tornato indietro (la fattoria
riparte da adesso dopo un salto lungo, un cantiere non dura mai più del suo livello); il lint vieta Date.now().

## B7 — impostazioni dal mondo, dagli eroi e dallo schieramento
L'ingranaggio in alto a sinistra in tutte e tre; cancellare il salvataggio fuori dalla battaglia riparte dal mondo.

## B8 — trucchi di prova e salvataggio da copiare
debug/cheats.js e la cartella «Meta · trucchi di prova» (risorse, cantieri, tempo, caselle, aree, eroi, Vinci e
Perdi); exportSave e importSave con la scheda per copiare e incollare.

## B9 — pausa quando si perde il fuoco, tastiera
La pausa si apre anche perdendo il fuoco, Esc la apre e la chiude; frecce e A/D guidano a 900 al secondo; il mondo
dimentica i gesti a metà quando perde il fuoco.

## B10 — versione, errori, uscita
La versione (package.json 0.4.10 e il commit) sotto le impostazioni e nel pannello; il registro degli errori sul
telefono e la schermata dell'errore; npm run build:release senza gli strumenti di sviluppo. La prova lengths è passata
alla seconda volta (la prima non trovava la scheda pronta: vedi la revisione, che ha tolto le attese fisse).

## B11 — battaglie rigiocabili e registro degli eventi
systems/replay.js registra seme, loadout, ritocchi, frame e comandi e rigioca identico su V8; Copia l'ultima battaglia
nel pannello, npm run replay; il registro degli ultimi eventi della battaglia nelle voci degli errori.

## B12 — simulatore della campagna intera
sim/campaign.js gioca campagne intere con le azioni del gioco e un orologio finto; npm run sim -- --campagna; la prova
campagna-quattro-aree tiene le regole del vecchio 167 con due semi (la 167 è rimasta: vedi la revisione, punto 29).
Campagna intera con 4 semi: 24 aree in 6,3 ore, niente da segnalare.

## B13 — le azioni del giocatore in un posto solo
meta/actions.js: ogni azione rilegge il salvataggio, porta il villaggio ad adesso, cambia, salva e lo dice con
META_EVENTS; le scene chiamano solo le azioni.

## B14 — pulizie e file divisi
fx/effects.js, view/camera.js inFront, core/format.js, view/canvas.js, core/angles.js; il mondo diviso in worldInput,
worldPlacement, worldSheets, view/worldGround e view/worldWords; config/balance.js diviso per tema e tenuto come
raccolta. Disegni degli atlanti confrontati chiamata per chiamata.

# Revisione della notte (blocchi A e B, prima del commit)
Una revisione di tutto il lavoro della notte (35 punti, 1 alto, 9 medi, 25 bassi) e le correzioni, dentro il cancello
del blocco B. Per ogni punto, dove si poteva, una prova che l'avrebbe preso.
Salvataggio (core/save.js, meta/road.js, meta/profile.js):
- Leggere non scrive più niente: loadSave gira all'avvio e a ogni rilettura (anche a ogni secondo del mondo, che
  riscriveva la copia di riserva o quella del rovinato); le copie le fa la prima scrittura (store): nella copia di
  riserva il salvataggio di prima se si può riprendere, se no da parte com'era (SAVE.brokenKey). (Punti 9 e 4)
- La rilettura prende solo un salvataggio della versione di oggi o di una più nuova: uno vecchio, scritto dal gioco di
  prima aperto in un'altra finestra (che scrive senza rileggere), prendeva il posto del profilo in memoria, e la
  scrittura dopo perdeva tutto quello fatto qui; ora resta il profilo in memoria e il vecchio va nella copia. (Punto 1)
- Nella copia di riserva va solo un salvataggio che si può riprendere: una versione valida con una migrazione che si
  rompe la cancellava; un salvataggio senza profilo (o con un profilo che non è un oggetto) è rotto, come per
  importSave, e si riprende la copia. (Punto 4)
- Strada: si salva anche il tipo della casella (kind); una casella fatta che, con le caselle della sua area cambiate,
  finisce su una battaglia o sul boss non suoi va combattuta (prima un'area si conquistava senza il boss né il suo
  premio). Senza il tipo vale come la sua solo la casella allo stesso posto. (Punto 2)
- I cantieri oltre i posti restano alla lettura: i posti del trucco non si salvano, e ricaricando i cantieri pagati
  oltre il primo sparivano. La regola e i Lasciati dell'A1 sono riscritti. (Punti 14 e 3)
- Prova dei dati del villaggio: costi, minuti e tabelle per ogni livello, numeri finiti, posti cantiere. (Punto 5)
Mondo:
- Scheda della strada: «Qui» della battaglia da riprovare dice «si riprova senza pagare» invece del costo; «boss tra 1
  casella». (Punti 6 e 11)
- Avvisi del salvataggio: contano come dati quando si chiudono (da soli o toccandoli), non quando compaiono: lasciando
  il mondo prima, nel prossimo tornano. Quello della versione più nuova dice «puoi giocare, ma da adesso non si salva
  niente». (Punti 7 e 12)
- Tenere premuto prende quello che prenderebbe un tocco (pickAt): il capo davanti a un edificio non fa prendere
  l'edificio. (Punto 8)
- Strada da più lontano dello zoom di partenza porta subito la vista a quello zoom, poi dal capo. (Punto 10)
- Pulsanti delle schede toccabili in un rettangolo più alto del disegno (hitHeight 64, Raccogli della fattoria 84,
  senza sovrapporsi), la bolla della fattoria fino a 44 dal centro; il disegno non cambia. (Punto 13)
Strumenti:
- Battaglie registrate al formato 2: i ritocchi cambiati a metà battaglia (pausa, pannello) diventano un comando
  tweaks, prima dei comandi che seguono; Vinci e Perdi del pannello un comando end; npm run replay legge anche il
  formato 1. (Punti 15 e 16)
- Un errore del gioco ferma il ciclo dei frame (game.loop.sleep), come dice la schermata; quelli che non vengono dal
  gioco (Script error. senza l'errore, file o stack di un'estensione) vanno nel registro senza schermata; gli strumenti
  di sviluppo che non si caricano vanno nel registro senza schermata. (Punti 17 e 18)
- La versione dice -dirty quando ci sono cambi non ancora in un commit (anche file nuovi). (Punto 19)
- Prova veloce che la build per l'uscita, fatta in memoria, non abbia src/debug, Tweakpane né systems/replay.js.
  (Punto 20)
Battaglia:
- Dove si prende un premio resta solo l'anello a terra: la scritta lì ripeteva quella vicino agli eroi e scorrendo
  passava sul numero dei soldati e sulle barre degli eroi (foto A8-bottino-preso). Era una scelta mia dell'A8: da
  confermare; per rimetterla, sopra le barre degli eroi, basta il disegno in view/overlayView.js. (Punto 21)
- La riga del bottino in alto dice «1 materiale». Pool dei colpi a 800: picco misurato con il bot, 60 battaglie per
  durata, 721 senza villaggio e 781 con caserma e fucina al livello 5 (prima 200, e a metà battaglia se ne creavano
  più di 500). placeGate delle prove rimette missed. (Punti 23, 24 e 22)
Prove e CI:
- Le prove statistiche 94 e 181 (salti di perse) e 126 e 136 (vittorie in più) guardano le soglie con il margine del
  campione (tests/support/stats.js): un ritocco che lascia le cose come sono non le fa più fallire a caso. Le righe
  che scrivono non cambiano. (Punto 25)
- deploy.yml: check (lint e prove veloci) sempre, stats (prove statistiche) saltabili da sole con salta_prove, la
  pubblicazione dopo tutte e due. (Punto 26)
- e2e: reload in tests/e2e/lib.mjs per tutte le prove (aspetta la pagina nuova, Phaser, e il mondo pronto); lengths
  aspetta la riga della scheda invece di attese fisse; send chiude la sua attesa (prima ogni prova restava ferma circa
  18 s dopo la fine); un browser che non parte si chiude con il suo profilo; run.mjs rifiuta i nomi sconosciuti e
  ferma una prova dopo 10 minuti. (Punti 27, 28, 32 e 33)
- Le prove rimettono i valori di config com'erano (restore in tests/support/suite.js; nell'e2e quelli letti prima),
  non numeri scritti a mano. sim/run.js rifiuta --partite e --seme che non sono interi da 1. (Punti 30 e 31)
- CLAUDE.md: regole 11-14 (azioni del meta-gioco, orologio, niente Phaser nella logica, righe di 120), le prove e la
  build per l'uscita, l'albero con i file di oggi come esempi; qui il blocco B. (Punti 34 e 35)
Non fatti: 29 (unire 94, 191, 63 e 72 nel file della 181 e togliere la 167): cambia la forma delle prove statistiche e
toglie righe della base, da decidere insieme; la parte facoltativa del 9 (il secondo del mondo senza rileggere il
salvataggio quando niente cambia: leggere ora non scrive, e rileggere tiene il mondo uguale a un'altra finestra).
Righe della base cambiate (7, ognuna misura quello che si è corretto): cantieri salvati (con 1 posto anche la caserma,
al suo posto); copia di riserva (il salvataggio della versione 1 letto non cambia il telefono, ci va alla prima
scrittura); migrazione 1 → 2 (il cammino sul telefono ha anche "kind"); rovinati tutti e due e rovinato con la copia
buona (il rovinato si tiene da parte alla prima scrittura, la copia buona resta; un caso in più, il profilo che non è
un oggetto); stati (un salvataggio di una versione vecchia non prende il posto della memoria: false → true); la 189
(dove si prende un premio solo l'anello). Nuove: 10 righe. Base vecchia in gate/old-bases/base-labels-preReview.txt.
Misure: cancello OK (lint pulito, 221 prove senza grafica senza errori, le 7 righe sopra cambiate e 10 nuove, ogni
altra riga della base identica, simulatore con semi fissi identico: la revisione non cambia nessuna battaglia del
bot); nel browser 10 su 10 senza errori in console (FPS 56,6/57,4 alle ondate 6 e 5, mondo 57,0/56,9 e 57,4/57,3). Al
primo giro la nuova prova del villaggio sul capo tenuto premuto cadeva per un punto sul bordo della sagoma del capo:
ora prende il centro della parte comune al capo e alla fattoria.

# Blocco C — Fase 4b: eroi, poteri, caserma e fucina (dal 2026-10-27, ramo blocco-c)

Scelte dell'utente (questionario del 27 ottobre, con due risposte sue al posto delle opzioni): poteri automatici ma più
furbi; un potere per categoria, più forte con la rarità e con un effetto in più dal viola; i poteri riducono schianto e
porte negative, non li annullano; gradi dei poteri pagati con i frammenti. Caserma (sua idea): con i livelli si
addestrano fucilieri, raffica, lanciatori e al 5 le élite, l'esercito si forma in caserma, i caduti si riaddestrano con
razioni e pochi secondi a soldato, le porte danno soldati nelle proporzioni dell'esercito, i tipi si mettono da soli per
gittata. Nessuna anteprima delle minacce. Fucina: 5 livelli per arma con effetti visibili, coda sua da 5 a 30 minuti,
mira del lanciatore in due passi. La forza nuova entra nei nemici (strada rimisurata con un giocatore medio). Eroi (sua
idea): niente esperienza automatica, le battaglie danno esperienza, materiali e frammenti da spendere su chi si vuole,
il centro città fa da tetto al livello; 6 rarità (grigio, verde, blu, viola, oro, cangiante) e 54 eroi, uno per rarità
per categoria; reclutamento con garanzie, il cangiante solo dai frammenti. I 36 step sono nella tabella di marcia.

## C1 — sei rarità e nove categorie
I 9 eroi di oggi diventano 9 categorie (`data/heroes.js` CATEGORIES: ruolo, vita, segno e colori della pedina, arma e
abilità, con gli stessi numeri di prima); un eroe è nome, categoria e rarità, e prende una copia dei numeri della sua
categoria (così pannello di sviluppo e simulatore ne cambiano uno senza toccare gli altri). Rarità da 3 a 6: Comune
(grigio), Non comune (verde), Raro (blu), Epico (viola), Leggendario (oro), Mitico (cangiante); forza 1, 1,1, 1,2, 1,35,
1,5, 1,7 (raro ed epico prima 1,15 e 1,3), parti del reclutamento 55, 27, 12, 4,5, 1,5 e 0% (il mitico solo dai
frammenti, step C5), frammenti dei doppioni 5, 8, 10, 20, 40, 80. Il reclutamento pesca solo tra le rarità che hanno
eroi da reclutare (fino al C4 mancano Non comune e Leggendario). Salvataggio invariato: la migrazione alla versione 6
arriva con il C2, quando cambia l'esperienza. Nomi scelti da me: Leggendario per l'oro e Mitico per il cangiante.
Prove: nuova prova dei dati (ogni eroe ha categoria e rarità vere, ogni categoria ha eroi, un capo solo, le parti fanno
1); la 124 del reclutamento confronta i comuni con la loro parte tra le rarità che escono. 241 prove verdi; cambiano
solo due misure: il reclutamento (comuni 76% su una parte del 77%) e la campagna di quattro aree (stesse durate, al
massimo 6 perse di fila).

## C2 e C3 — esperienza da spendere, tetto del centro città, il bot che addestra
Gli eroi non crescono più da soli: l'esperienza delle battaglie (raccolta, premio della vittoria, consolazione) entra
nelle scorte (`resources.xp`), e la si spende sull'eroe che si vuole con Addestra (`meta/heroes.js` trainHero, azione
`trainHero` con l'evento HERO_TRAINED): un livello alla volta, con la stessa curva di prima (round(40 × n^1,3) punti dal
livello n al successivo) più un po' di materiali (`data/growth.js` levelMaterials: 6 × n di legno fino al livello 10,
poi 3 × (n − 9) ingranaggi). Il centro città fa da tetto (levelCaps: 6, 9, 12, 16, 20 con il centro da 1 a 5);
`trainBlock` dice perché non si può (non tuo, massimo, tetto, scorte). L'eroe salvato ha il livello al posto
dell'esperienza.
Salvataggio 6 (`core/save.js`, migrazione 5 → 6): ogni eroe prende il livello che la sua esperienza dava con la curva di
prima (SAVE.legacyXp), e l'esperienza dentro il livello va nelle scorte; nessuno perde forza. Un eroe sopra il tetto del
centro lo resta, ma non sale finché il centro non cresce.
Schermate: nella scheda dell'eroe livello e stelle (il livello acceso se si può addestrare), niente più barra
dell'esperienza; nel dettaglio "Liv. N · tetto del centro M" e il pulsante "Addestra · 52 esperienza · 6 legno" (al
tetto "Tetto del centro città: alza il centro"); sotto il reclutamento anche l'esperienza da spendere. Il riepilogo di
fine battaglia mette l'esperienza tra le scorte (bottino, premio, "Ora hai"), non più nelle righe degli eroi; le
piastrine escono da "Ora hai", che con l'esperienza non ci stava più nello schermo (restano nella schermata degli eroi).
Trucco del livello: imposta il livello, anche oltre il tetto.
Bot della campagna (`sim/campaign.js` train): dopo il villaggio, il reclutamento e le stelle spende l'esperienza sugli
eroi schierati, un livello alla volta a quello più basso. Campagna di 24 aree su 3 semi: 9,2-9,8 ore (prima 8,7-10), al
massimo 7 perse di fila, attese 8%, niente da segnalare; eroi al livello 12,5 in fondo (prima 12,0), centro città al 4
dall'area 9 e al 5 dall'area 14; scorte avanzate in fondo: legno 1437 (prima 2793), pietra 1112, ingranaggi 306 (prima
362). Il costo dei livelli si ritocca con la nuova misura della forza (C34-C35).
Prove: 120 riscritta (Addestra con e senza scorte, fino al tetto, poi al massimo, costi pagati giusti, legno e poi
ingranaggi), 121 (livelli salvati dentro i limiti), nuova "Migrazione 5 → 6", consolazione e premi nelle scorte,
l'azione trainHero con il suo evento, trucchi e prova nel browser dei trucchi con il livello; 126 e 128 con il livello 6
(prima 1200 di esperienza, lo stesso livello).

## C4, C5 e C6 — 54 eroi, reclutamento con tre garanzie, mitici dai frammenti, la collezione che scorre
Eroi (`data/heroes.js` ROSTER): uno per ogni rarità di ogni categoria, 54 in tutto; i 9 di prima restano con la loro
rarità (Capo, Fuciliere, Difensore, Esploratore e Cecchino comuni, Granatiere e Guardiano rari, Tiratore scelto e
Veterano epici), gli altri 45 nuovi, con nomi scelti da me (per categoria, dal non comune al mitico: Sergente, Capitano,
Comandante, Generale, Condottiero; Assaltatore, Incursore, Ariete, Lampo, Tempesta; Sentinella, Bastione, Baluardo,
Muraglia, Roccaforte; Predone, Segugio, Lupo, Vipera, Scorpione; Vedetta, Falco, Aquila, Lince, Astore; Artificiere
comune, Bombardiere, Mortaio, Catapulta, Vulcano; Scudiero comune, Custode, Paladino, Egida, Aurora; Tiratore comune,
Puntatore, Balestriere, Infallibile, Saetta; Attaccabrighe comune, Rissoso, Furioso, Ciclone, Fenice). Stessa sagoma,
segno e colori della categoria; la base della pedina ha il colore della rarità (RARITIES.rim: grigio, verde, blu, viola,
oro; il mitico sfumato rosa-azzurro-giallo). L'atlante delle pedine va a capo a 2048 pixel (PAWNS.atlasWidth): in una
fila sola, con 54 eroi, sarebbe stato largo più di 9000 pixel, troppo per i telefoni.
Reclutamento (`meta/heroes.js` recruit): garanzie a tre rarità (RECRUIT.pity: almeno un raro ogni 10 tiri, un epico ogni
30, un leggendario ogni 100; un non comune non azzera il conto del raro); il profilo conta i tiri senza ognuna
(recruitState.since; i salvataggi di prima portano il loro sinceRare nel conto del raro). Misura su 15000 tiri: comune
52%, non comune 26%, raro 14%, epico 5,3%, leggendario 1,9%. I mitici non escono dal reclutamento: si ottengono con 60
dei loro frammenti (RECRUIT.assemble, azione assembleHero, evento HERO_ASSEMBLED), che arrivano dalla conquista di
un'area (10 al mitico di quell'area, a giro tra i nove: assembledFor) e dalla sfida del giorno vinta (5 al mitico del
giorno). La notizia della conquista e il riepilogo della sfida dicono quanti e di chi ("+10 frammenti di Condottiero").
Schermata Eroi (`scenes/Heroes.js`): la collezione. Sotto lo schieramento i filtri (Tutti, Tuoi, Da trovare) e la
categoria, che cambia a ogni tocco (Ogni categoria, poi le nove); la lista scorre col dito (o con la rotella), tre
schede per riga, due righe per categoria, nell'ordine dei dati: pedina, nome del colore della rarità, livello e stelle
(acceso se si può addestrare o alzare di stella); chi manca in ombra con la rarità (i mitici con i frammenti, "framm.
12/60"). Il dettaglio di chi manca dice dove si trova ("Dal reclutamento: 1,5% dei tiri"; "Solo con i frammenti: 12/60",
"Dalla conquista delle aree e dalle sfide del giorno") e per i mitici ha Ottieni. Sotto Recluta: "Hai 10 piastrine · 400
esperienza" e "Garantiti: raro tra 10 · epico tra 30 · leggendario tra 100". Anche il Catalogo scorre (la scheda Eroi ha
54 voci); i mitici sono "Dai frammenti", bloccati finché non bastano; tra le risorse c'è l'esperienza (da nemici,
vittorie, prima sconfitta su una casella; per addestrare gli eroi), e legno e ingranaggi servono anche ad addestrare.
Liste che scorrono (`scenes/scrollArea.js`, nuovo): una seconda camera grande quanto il riquadro della lista mostra solo
le voci (messe in un contenitore), la principale tutto il resto; il dito che trascina dentro il riquadro sposta la
lista; un tocco su una voce vale se il dito si è mosso al massimo di 14 pixel (HUD.scroll.tapSlop); i pulsanti dentro la
lista (Vai del Catalogo) hanno il loro posto da toccare che segue lo spostamento. Con il dettaglio aperto la lista si
spegne. Phaser 4 rispetta le camere anche per i tocchi (un oggetto ignorato da una camera non si tocca attraverso di
lei).
Frammenti: con 54 eroi i doppioni del reclutamento finiscono su eroi diversi da quelli schierati, e le stelle crescevano
meno (3,2 in fondo alla strada invece di 4,5): élite che lasciano un frammento il 30% delle volte (prima 20%), boss 5
frammenti (prima 3). Il bot della campagna prende i mitici quando può. Ho provato a fargli cambiare eroe quando uno
fuori alza la forza del 5%: un seme si bloccava all'area 17, perché la forza di oggi sbaglia il valore di alcuni eroi
(lo scudo vale 0, il colpo perforante troppo) e l'esperienza già spesa si perde; tolto, torna con la forza nuova
(C32-C33).
Misure: campagna di 24 aree su 3 semi 9,8-11,8 ore (C2 9,2-9,8), nessuna bloccata, stelle 3,6 in fondo; un seme perde 20
volte di fila la battaglia con tre boss dell'area 20. Resta da tarare con la nuova misura della forza (C34).
Prove: dati (un eroe per ogni rarità di ogni categoria), 124 riscritta (le tre garanzie non mancano mai su 15000 tiri,
nessun capo né mitico, le parti delle rarità), nuova C5 (mitici con i frammenti, a giro per area e giorno), azioni
assembleHero e i frammenti della conquista, sfida del giorno con i frammenti del mitico del giorno, Catalogo (mitici
bloccati o ottenibili, l'esperienza tra le scorte), ingranaggio libero dai filtri e dalla lista; prove nel browser del
villaggio e dei trucchi sulla lista nuova.
Revisione di C1-C6 (tre revisori: difetti, salvataggio e dati, schermo e regole; uno scettico per ogni punto):
confermati 11 su 12, tutti corretti. Il più grave: perdendo una sfida del giorno il riepilogo si fermava a metà
(scriveva i frammenti di un premio che non c'era) e la partita restava bloccata; ora il premio lo scrive prizeText, che
con la sfida persa dice solo "Sfida del giorno persa". I posti dello schieramento reagivano al dito che si alzava sopra
di loro anche finendo uno scorrimento della lista (e il tocco dopo cambiava lo schieramento): ora, come tutti i
pulsanti, solo se il dito si è appoggiato lì (addTapZone). La migrazione 5 → 6 dà anche i frammenti dei mitici delle
aree già conquistate, come se la conquista li avesse dati. Scritte: i pulsanti stringono la scritta più larga di loro
(HUD.screenButton.padding: "Addestra · 1012 esperienza · 9 ingranaggi" al livello 12 era più larga del riquadro), e le
righe del riepilogo più larghe di 680 pixel si stringono (con l'esperienza a 4-6 cifre il bottino e "Ora hai" uscivano
dallo schermo); "Sfida del giorno vinta" diventa "Sfida vinta" (con "Condottiero" usciva). Prove: la 125 controlla di
nuovo il livello (aveva ancora l'esperienza), la migrazione 5 → 6 anche le aree conquistate e il vecchio conto del raro
(sinceRare); commenti superati in rewards.js, catalog.js e nel riepilogo. Scartato: le schede del legno e degli
ingranaggi nel Catalogo non escono dal loro riquadro.

## C7 — motore dei poteri a dati
I poteri stanno in un registro (`systems/powers.js` POWERS, nuovo): per ogni tipo targets (se adesso serve, e su cosa) e
use (cosa fa); il ciclo delle ricariche (`systems/heroes.js`) chiama il potere dell'eroe senza conoscere i tipi. I
quattro di oggi (onda d'urto, colpo perforante, scudo, fuoco rapido) sono gli stessi di prima: il simulatore dà gli
stessi numeri, uno per uno. Gli eroi leggono vita, arma, abilità, ruolo e pedina dalla loro categoria (`data/heroes.js`,
non più una copia): il pannello di sviluppo ha una cartella per la vita e una per l'abilità di ogni categoria (18, fatte
dai dati, con i campi che l'abilità ha), che valgono per tutti i suoi eroi; il simulatore cambia vita e danno delle
categorie (`sim/variants.js`). La forza (`systems/power.js`) conta ancora le abilità per tipo: passa al registro con la
forza nuova (C32).
Prove: ogni categoria ha un potere che esiste; 243 prove verdi, misure del simulatore uguali.

## C8 — danno dei poteri in quota della vita
Onda d'urto e colpo perforante non hanno più un danno fisso ma una quota (ability.share, `data/heroes.js`): 0,24 il
Comando, 0,18 il Corto raggio, 0,22 l'Assedio, 0,3 il Lungo raggio, 1,4 la Precisione, cioè il danno di prima su un
nemico normale della prima battaglia (50 di vita). La quota si conta sulla vita di un nemico normale dell'ondata più
dura della battaglia (`systems/battle.js` powerHp), per l'hpScale del tipo colpito (mai meno di un normale: un'onda
spazza ancora le pedine degli sciami); sul boss sulla sua vita. Élite e boss ne prendono una parte
(HERO_POWERS.targetShare in config/battle.js: 0,5 e 0,08); conta il danno in più di scrigni e riserve. La quota cresce
con la forza dell'eroe (rarità, livello, stelle e il danno in più delle stelle dell'abilità) elevata a 0,75
(HERO_POWERS.growthExponent). Così dentro una battaglia un potere colpisce ogni tipo sempre uguale, come prima, e lungo
la strada cresce con i nemici: a fine strada non è più un graffio. Lo scrigno della vita ridà il 40% della vita piena
(prima +2 fissi, che a fine strada non valevano niente). La forza conta ancora i poteri su un nemico di 50 di vita
(POWER.abilityHp), finché non li conta per davvero (C32).
Prove fatte prima di scegliere: la quota sulla vita di ogni nemico (e non di un normale della battaglia) faceva perdere
al bot l'effetto del potenziamento (prova 126: 86 contro 82 su 100, prima 92 contro 84), perché nelle prime ondate i
nemici hanno meno vita e il potere pesava meno proprio lì; con il normale dell'ondata più dura torna 92 contro 85. Nella
battaglia con due boss il bot sembrava perdere di più nella fase dei boss (54% di chi ci arriva, prima 38%): su 640
battaglie il modello nuovo, quello senza bonus e il danno fisso di prima danno 28%, 29% e 27% di vittorie e 44%, 39% e
45% di perse ai boss, cioè la stessa cosa; il salto c'era anche prima (dal 21-23% dell'ultima ondata al 45%), e la prova
181 passava per la fortuna dei primi 160 semi.
Prove cambiate: 181 controlla il salto di perse solo tra un'ondata e l'altra; la fase dei boss, dura apposta, ha un suo
tetto (SIM.flags.bossLoss: al massimo il 55% di chi ci arriva perde lì), e il resoconto del simulatore la segnala con la
stessa regola. 128 potenzia il capo al livello 10 con 4 stelle (al 6 con 3 il guadagno, su 200 battaglie, era di 2
vittorie: troppo poco per 60). Onda d'urto e colpo perforante: colpi contati sulla quota; scrigno della vita in
percentuale; la battaglia registrata rifatta. Nel dettaglio dell'eroe "30% della vita in colonna", e le righe più larghe
del riquadro si stringono.
Misure: bot di riferimento normale 83%, boss 68%, doppia 24%, tripla 20%; campagna di 24 aree su 3 semi 9,4-10,2 ore,
niente da segnalare (C4 9,8-11,8, con 20 perse di fila).

## C9 — poteri più furbi: provati, e tenuti per i poteri nuovi
Ho provato a far aspettare ai poteri un bersaglio che valga (ogni nemico con il peso del suo tipo: sciami 0,5, corazzati
e tiratori 1,5, élite 3, boss 6; almeno 3, al massimo 1,5 secondi di attesa, poi si parte con quello che c'è), contro i
poteri che partono appena serve. Su 640 battaglie per tipo: normale 82% contro 81%, boss 63% contro 63%, doppia 28%
contro 27%, tripla 12% contro 16%: aspettare non aiuta mai e nelle fasi dei boss della tripla fa danno (42% e 52% di
perse ai boss contro 32% e 42%). Anche facendo partire l'onda d'urto subito con i nemici addosso, o facendo aspettare
solo colpo perforante e fuoco rapido, la tripla resta al 13%. Con poteri che non mirano (un raggio o una colonna attorno
all'eroe) il momento giusto è appena servono. Tolto: il codice resta quello del C8. La furbizia arriva con i poteri
nuovi di categoria (C11-C15), ognuno con la sua condizione (il boss per il Bombardamento e il Marchio, l'eroe ferito per
il Soccorso, l'avviso dello schianto per la Barricata).

## C10 — poteri leggibili in grigio
Sotto ogni eroe con il potere pronto (che aspetta qualcosa su cui usarlo) un anello giallo a terra che pulsa
(FX.powerReady, `view/marksView.js`); quando un potere parte, il suo nome sale sopra l'eroe e sfuma in un secondo
(FX.powerName, `fx/heroFx.js` names, `view/overlayView.js`). Le forme per tipo c'erano già: l'anello che si allarga
dell'onda d'urto, la scia del colpo perforante, l'anello dello scudo attorno all'esercito, l'anello del fuoco rapido
attorno al suo eroe. Tutto si spegne con gli effetti (FX.enabled). Misure del simulatore uguali al C8.

## C11-C16 — un potere per categoria
Ogni categoria ha il suo potere automatico (`data/heroes.js`, logica in `systems/powers.js`), che parte appena serve;
dall'epico in su ha un effetto in più (ability.upgrade). Comando, Adunata: con nemici a tiro, per 4 s tutto l'esercito
fa il 30% di danno in più (dall'epico anche il 20% di cadenza). Assalto, Fuoco rapido: com'era (dall'epico il 20% di
danno in più). Difesa, Barricata: lo scudo di prima, che si alza anche quando il boss sta per schiacciare dove c'è
qualcuno dell'esercito e toglie allo schianto metà dei soldati colpiti e della vita tolta agli eroi (dall'epico tre
quarti). Corto raggio, Onda d'urto: colpisce intorno, spinge indietro e ferma i nemici per 0,8 s (dall'epico 1,5 s),
fermi davvero anche a campo in moto (`systems/spawn.js` closingSpeed). Lungo raggio, Colpo perforante: la colonna di
prima e 3 colpi alle porte che ci trova (dall'epico 6). Assedio, Bombardamento: il 22% della vita in un raggio di 160
attorno al boss, se è a tiro, se no dove i nemici sono più fitti (dall'epico raggio 220). Protezione, Soccorso: quando
un eroe scende sotto il 70% della vita o l'esercito ha perso almeno 6 soldati (minLost) contro i nemici, il 30% della
vita a tutti gli eroi e fino a 6 soldati persi che tornano (dall'epico 12); quelli tolti dalle porte non contano.
Precisione, Marchio: colpisce il nemico più duro a tiro (prima i boss, poi le élite, poi chi ha più vita) e per 5 s gli
fa prendere il 50% di danno in più da tutti (dall'epico i due più duri); il danno in più lo conta chi colpisce
(`systems/spawn.js` markedDamage), così numeri, statistiche e migliore della battaglia lo vedono. Furia, Furia: un fuoco
rapido più forte (×2,5, dall'epico ×3) i cui colpi passano la corazza. Come chiesto, schianto del boss e porte negative
i poteri li riducono e basta.

Leggibili: anello dorato dell'adunata attorno all'esercito, anello bianco attorno ai marchiati (fuori dalla pedina),
onda verde del soccorso; i nomi dei poteri stanno in fila sopra la testa più alta degli eroi, ognuno nella sua riga, e
non salgono più (salendo passavano sopra la riga sopra). Scheda dell'eroe: il nome del potere con la ricarica e sotto
cosa fa con i numeri della sua rarità ("75% della vita ai 2 più duri, +50% danni presi per 5 s"). Pannello di sviluppo:
per ogni categoria anche "Abilità dall'epico" (i numeri di ability.upgrade, che per quegli eroi vincono sugli altri). La
forza conta i poteri nuovi alla buona fino al C32: bombardamento e marchio come l'onda d'urto (su POWER.blastTargets e
marks nemici), la furia come il fuoco rapido; adunata, barricata e soccorso no, perché non tolgono vita da soli (come lo
scudo). Contata come danno in più medio di tutti, l'adunata alzava la forza del Capo del 4% mentre lui, senza l'onda
d'urto, nelle battaglie dure vince un po' meno: la taratura (prova 95) metteva la metà delle vittorie a rapporto 1,21,
fuori dalla sua fascia; senza, 1,16 (prima 1,13). Così la doppia, col bot di riferimento, scende da rapporto 0,76 a
0,75, cioè da «Difficile» a «Molto difficile», con il 23-27% di vittorie, a cavallo delle due fasce (25%).

Revisione con 4 revisori e una verifica che prova a smentire ogni segnalazione: 24 confermate, 13 difetti distinti,
tutti corretti. L'onda d'urto non fermava nessuno a campo in moto (toglieva solo la camminata in più, che hanno solo i
veloci); il soccorso contava come persi i soldati tolti dalle porte e li riportava (una porta da -6 non costava niente);
il danno in più del marchio non arrivava a numeri, statistiche e migliore; il colpo del marchio contava il suo stesso
marchio; la spinta dell'onda d'urto veniva tagliata dal suo stesso colpo; con l'effetto in più dell'epico il soccorso
partiva solo dopo 12 persi (ora minLost a parte); la scheda non diceva "ai 2 più duri" né il raggio del bombardamento;
dal pannello i numeri dell'epico non si regolavano; i nomi dei poteri partiti a mezzo secondo l'uno dall'altro si
accavallavano; quattro prove passavano anche se il potere sbagliava (porta "lontana" senza posto, taglio dello schianto
a 0,5 uguale al resto, gruppo più fitto che era anche il primo, spinta qualunque).

Prove nuove: 192-198, una per potere (adunata, barricata con lo schianto, porte del colpo perforante, bombardamento sul
gruppo e sul boss, soccorso con porte e Paladino, marchio con il danno vero, furia sulla corazza); 5 controlla che
l'onda d'urto fermi davvero e spinga almeno a pushSpeed; 128 accende insieme il fuoco rapido del Fuciliere e la furia
dell'Attaccabrighe; battaglia registrata rifatta.

Misure su 640 battaglie per tipo col bot di riferimento (schieramento di partenza: Capo, Fuciliere, Cecchino,
Difensore): normale 82% (C8 81%), boss 63% (63%), doppia 27% (27%), tripla 15% (C10 18%). Il Capo ha perso l'onda
d'urto, che spazzava gli sciami attorno all'esercito: nella tripla la nona ondata, con sciami da 40 (30 nelle ondate
4-8), saliva dal 35% al 41% di perse contro il 14% dell'ottava, un salto che la prova 181 segnala. Un'adunata più forte
(+40%, 5 s o ricarica di 10 s) non cambia niente (14% di vittorie); con sciami da 35 la nona ondata torna al 35%, come
al C10, e la prova passa, ma la fase dei boss della tripla perde il 49-51% di chi ci arriva (C10 41%, tetto 55%). Punto
aperto per il C35: con il bot del giocatore medio e gli schieramenti scelti, da rivedere la fine della tripla. Campagna
di 24 aree su 3 semi: da 9,6 a 10,6 ore (C8 da 9,4 a 10,2), nessuna bloccata, niente da segnalare.
