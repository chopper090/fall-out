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
premio della vittoria restano a battaglia, quindi al minuto crescono; il boss resta un tratto piatto.
