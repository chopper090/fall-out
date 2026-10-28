# Grafica «Latta e sole» — scheda tecnica

Lo stile del gioco è la direzione A della prova di stile del 28 ottobre 2026: contorni marroni spessi, ombre a due
toni con un riflesso netto, colori caldi e saturi, il blu della squadra ben visibile. Per le pedine vale la versione
«A leggero»: meno pezzi, due toni, facce semplici. Il dettaglio va su carte, mappa ed effetti. Il piano a step è il
blocco L della tabella di marcia; la storia è in `docs/STORIA.md`.

## Lo stile

- **Contorno:** marrone scuro `#3b2314`, giunti tondi. Lo spessore dipende da quanto è grande il pezzo sullo schermo,
  così non sparisce sui piccoli e non pesa sui grandi (misure nel sistema di coordinate del disegno, il suo `viewBox`):

  | Pezzo | Sullo schermo | Contorno esterno | Linee interne |
  | --- | --- | --- | --- |
  | Soldati, sciame, colpi | 20-30 px | 1,5 | 1 |
  | Eroi, nemici normali | 50-100 px | 2,5 | 1,5 |
  | Élite, boss | 120-250 px | 3 | 2 |
  | Edifici, segni della strada | 100-480 px | 3 | 2 |
  | Icone | 32-64 px (viewBox 64) | 3,5 | 2 |

- **Luce:** dall'alto a sinistra. Ogni materiale ha due toni, la Base in luce e l'Ombra in basso a destra, più un
  riflesso netto nel colore Chiaro; negli edifici il Chiaro va anche sulle facce di sopra. Niente sfumature morbide
  sulle pedine.
- **Colori** (dalla prova A):

  | Nome | Chiaro | Base | Ombra |
  | --- | --- | --- | --- |
  | Blu della squadra | `#86c6ff` | `#2f80e4` | `#1c56b0` |
  | Senape | `#ffe27e` | `#f6b92c` | `#c98614` |
  | Ruggine | `#f8a15c` | `#de6b2b` | `#a9461b` |
  | Sabbia | `#fcebc4` | `#ecce93` | `#c9a466` |
  | Erba | `#ade36a` | `#7ec443` | `#58972c` |
  | Verde acqua | `#8be6db` | `#3dbab1` | `#26898a` |
  | Legno | `#e2a868` | `#bd7c40` | `#8a5326` |
  | Metallo | `#e2eaee` | `#aab6bd` | `#76848c` |
  | Gomma | `#6e6666` | `#4b4545` | `#2f2a2a` |
  | Pelle | `#ffe0c4` | `#f6bf90` | `#da9461` |
  | Pietra | `#e8e0d3` | `#bcb2a3` | `#8b8072` |

  I colori di riconoscimento restano: **blu = noi, rosso = nemici, giallo = bonus**. I nemici dell'era 1 vestono di
  nero, con fascia, mostrine e strisce rosse ben visibili.
- **Proporzioni:** eroi alti 2,5 teste, mani e scarponi grandi; tutti i nostri hanno un casco o un cappello blu. Pezzi
  di recupero: latta rivettata, copertoni, cinghie, nastro.
- **Simboli:** solo inventati (la torre chiusa del Patto, il germoglio della Brigata). Mai simboli, bandiere o insegne
  reali.

## Dove vanno i file

Un disegno è un file SVG in `src/art/<gruppo>/<nome>.svg`. All'avvio la scena Preload lo carica alla misura del suo
riquadro e l'atlante lo disegna al posto della figura fatta dal codice. Senza il file resta quella: i pezzi si
sostituiscono uno alla volta. La prova `tests/unit/art.test.js` controlla che ogni file stia nella cartella del suo
gruppo e abbia un riquadro, che non usi elementi vietati, che il suo `viewBox` abbia le proporzioni del riquadro e che
non pesi troppo.

| Gruppo | Nomi dei file |
| --- | --- |
| `pawns` | soldati `rifleSoldier`, `burstSoldier`, `launcherSoldier`, `eliteSoldier`; eroi per categoria `commandHero`, `assaultHero`, `defenseHero`, `shortRangeHero`, `longRangeHero`, `siegeHero`, `protectionHero`, `precisionHero`, `furyHero`; un eroe da solo (i mitici) `<id>Hero`, per esempio `tempestHero`; nemici `grunt`, `swarm`, `fast`, `armored`, `elite`, `shooter`, `boss` |
| `buildings` | `center`, `lodge`, `farm`, `barracks`, `forge` e i loro cantieri `centerSite`, `lodgeSite`, `farmSite`, `barracksSite`, `forgeSite` |
| `markers` | segni della strada `battle`, `boss`, `double`, `triple`, `collect`, `conquered`, `unknown` |

Un eroe usa il disegno con il suo nome, se c'è, se no quello della sua categoria.

## Misure e punto d'appoggio

**Pedine.** Il `viewBox` è largo e alto come la pedina nel mondo; il punto d'appoggio (dove la pedina tocca il terreno)
sta al centro in orizzontale, all'altezza scritta in tabella: lì va il centro dei piedi, o della base. La pedina può
stare in tutto il riquadro, ma niente deve uscirne.

| Riquadro | viewBox | Punto d'appoggio (y) | Caricato a (px) |
| --- | --- | --- | --- |
| `rifleSoldier` | `0 0 20 30` | 26,4 | 32 × 48 |
| `burstSoldier` | `0 0 20 30` | 26,6 | 32 × 48 |
| `launcherSoldier` | `0 0 20 30` | 26,2 | 32 × 48 |
| `eliteSoldier` | `0 0 26 40` | 35,3 | 42 × 64 |
| eroi (`<categoria>Hero`, `<id>Hero`) | `0 0 80 92` | 79,2 | 128 × 148 |
| `grunt` | `0 0 68 92` | 80,4 | 109 × 148 |
| `swarm` | `0 0 19 30` | 26,4 | 31 × 48 |
| `fast` | `0 0 48 80` | 72,8 | 77 × 128 |
| `armored` | `0 0 76 96` | 83,1 | 122 × 154 |
| `elite` | `0 0 102 146` | 129,7 | 164 × 234 |
| `shooter` | `0 0 62 112` | 101,5 | 100 × 180 |
| `boss` | `0 0 200 300` | 266 | 320 × 480 |

**Edifici e segni della strada.** Visti in isometria 2:1, con la luce dall'alto a sinistra. Il `viewBox` è il riquadro
caricato diviso 2 (un edificio di 2 × 2 celle: `0 0 192 212` per il Centro città). Il posto a terra sta in fondo al
riquadro ed è largo quanto lui: per un edificio di C × R celle, con A = altezza del viewBox − (C + R) × 24, i suoi
vertici sono in alto (R × 48, A), a destra ((C + R) × 48, A + C × 24), in basso (C × 48, A + (C + R) × 24), a sinistra
(0, A + R × 24). Per i 2 × 2 è un rombo con il vertice basso al centro del fondo; per la caserma (3 × 2) è più lungo
verso destra. Il punto d'appoggio è il centro del posto: (larghezza / 2, A + (C + R) × 12). Sopra il posto c'è lo
spazio per l'altezza dell'edificio.

| Riquadro | Celle | Caricato a (px) |
| --- | --- | --- |
| `center` | 2 × 2 | 384 × 424 |
| `lodge` | 2 × 2 | 384 × 292 |
| `farm` | 2 × 2 | 384 × 314 |
| `barracks` | 3 × 2 | 480 × 388 |
| `forge` | 2 × 2 | 384 × 376 |
| cantieri 2 × 2 (`centerSite`, `lodgeSite`, `farmSite`, `forgeSite`) | 2 × 2 | 384 × 272 |
| `barracksSite` | 3 × 2 | 480 × 320 |
| `battle` | 1 | 192 × 184 |
| `boss`, `double`, `triple` | 1 | 192 × 264 |
| `collect` | 1 | 192 × 136 |
| `conquered` | 1 | 192 × 200 |
| `unknown` | 1 | 192 × 160 |

Oggi l'altezza di ogni riquadro viene dalla figura fatta dal codice. Se un disegno ha bisogno di più spazio in alto, lo
step che lo porta nel gioco aggiunge la sua altezza nella configurazione.

## Regole dei file SVG

- Solo forme, tracciati, riempimenti, contorni e sfumature lineari o radiali. **Niente** filtri, maschere, testo, CSS
  (`<style>`), immagini incorporate, script o indirizzi esterni: sui telefoni Android si disegnano male o per niente.
- Sfondo trasparente; tutto dentro il `viewBox`.
- Un file leggero: per le pedine e i segni della strada al massimo 10 KB, per gli edifici 25 KB.

**Da Illustrator 2020:** File › Esporta › Esporta come… › SVG, con Stile «Attributi di presentazione», Caratteri
«Converti in contorni», ID oggetto «Minimo», Decimali 2, Minimizza attivo, Reattivo disattivo. La tavola da disegno va
fatta grande quanto il `viewBox` della tabella.

## Carte degli eroi (ComfyUI)

Ritratti a mezzo busto in verticale 2:3, generati a 832 × 1248 con SDXL e un'immagine di riferimento dello stile
(IP-Adapter), poi ingranditi × 2 e senza sfondo: lo sfondo a manifesto e la cornice di rarità li disegna il gioco.
Un file PNG per eroe, con il suo id (`tempest.png`). I prompt fissi (base, negativo, categorie, rarità, esempi) sono
nella pagina delle proposte grafiche.
