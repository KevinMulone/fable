# Piano: Jarvis v1.0 — «come quello di Tony Stark»

Obiettivo: quando dici **«Jarvis»**, parte la sequenza di risveglio vista nel video di riferimento
(schermo nero → un neurone → la rete esplode → cluster → guasto riparato → «È tutto sotto controllo»),
con la **stessa musica** (The Clash – *Should I Stay or Should I Go*) e le **stesse battute**, ma con
numeri **veri** calcolati dal tuo sistema (con un minimo garantito).

Base di partenza: Jarvis v0.9 (già in questo repo). Decisioni prese con Kevin il 02/10/2026:
numeri veri con minimo garantito · voce OpenAI TTS già presente · codice nel repo `fable` · musica fornita come file.

---

## 1. Sequenza di riferimento (ricavata dal video, 0–12 s)

| # | Schermo | Jarvis dice | Note |
|---|---------|-------------|------|
| 0 | Pagina normale | — | Tu dici **«Jarvis»** (wake word già esistente in `voice.js`) |
| 1 | Tutto nero, parte la musica, compare **un solo neurone** con 3 rami | «Buongiorno, signore.» | Fade-in musica ~0,8 s |
| 2 | La rete **esplode** in 3D: centinaia di nodi e collegamenti, camera che arretra | «534 neuroni online.» | Contatore in basso che sale fino al numero reale |
| 3 | Compaiono le **etichette dei cluster** (es. CONTENUTI, MEMORIA E METODI, AGENTI, FINANZA, ARCHIVIO…) | «39 sistemi attivi, 5 agenti pronti.» | Contatori «sistemi attivi» e «agenti in squadra» |
| 4 | Un nodo **rosso** «RISPOSTE OUTREACH: FERMO» → diventa **verde** «RIPARATO» | «Stamattina ho già riparato quello che si era rotto.» | Se nessun guasto: battuta alternativa (vedi §5) |
| 5 | Rete stabile, in basso 4 contatori (neuroni / collegamenti / sistemi / agenti), a sinistra un log tipo terminale | «È tutto sotto controllo.» | Musica scende e si chiude in ~3 s, poi torna l'interfaccia normale |

Log a sinistra, riga per riga, in sincrono con la voce:
`> avvio cervello` · `> carico memoria N file` · `> carico metodi N` · `> collego neuroni N` · `> servizi in linea N` · `> agenti N pronti` · `> controllo guasti N trovati` · `> riparato`.

---

## 2. Musica

- File: `assets/music/intro.mp3` (quello che hai mandato). **Resta solo sul tuo computer**: è in `.gitignore`
  perché è un brano protetto e il repo è su GitHub. Chi clona deve rimettere il file a mano (`assets/music/README.md`).
- Il video non parte dall'inizio del brano: dall'allineamento audio il punto di partenza stimato è **~7 s**
  (confidenza media, nel video c'è la voce sopra). Diventa un parametro `MUSIC_START_SECONDS` in `app.js`,
  da aggiustare a orecchio.
- Comportamento: fade-in 0,8 s → **ducking** a −12 dB mentre Jarvis parla (Web Audio `GainNode`) → torna a volume
  pieno tra una battuta e l'altra → fade-out 3 s dopo «È tutto sotto controllo».
- Vincolo browser: l'audio può partire **solo dopo un gesto dell'utente** sulla pagina (politica autoplay di Chrome).
  Il clic su «Avvia ascolto continuo» sblocca l'`AudioContext` una volta per sessione; se la pagina viene riaperta
  con l'ascolto automatico senza nessun clic, Jarvis mostra «Premi per attivare l'audio» e la sequenza parte al clic.
- Il server serve il file su `/assets/music/intro.mp3` (aggiunta alla mappa `files` in `server.py`, `media-src 'self'` è già nella CSP).

---

## 3. Numeri veri con minimo garantito

Nuovo endpoint `GET /api/brain/status` in `server.py` (calcolato a ogni risveglio, < 100 ms):

| Voce | Come si calcola | Minimo |
|------|-----------------|--------|
| **Neuroni** | messaggi archiviati + ricordi + moduli + metodi/intenti riconosciuti | 120 |
| **Collegamenti** | neuroni × ~2,7 (deterministico dal seed, coerente con il grafo disegnato) | neuroni × 2 |
| **Sistemi attivi** | controlli reali che passano: server, database, chiave API, TTS raggiungibile, riconoscimento vocale, profilo vocale, memoria, archivio, ascolto continuo, … (uno per riga della tabella di self-check) | 8 |
| **Agenti pronti** | funzioni di risposta attive: chat locale, chat AI, ricerca memoria, orario/data, voce | 3 |

I minimi sono costanti in `server.py` (`BRAIN_MIN_*`) e si possono alzare. I numeri **crescono con l'uso**
(ogni conversazione aggiunge neuroni). Il grafo 3D disegna davvero il numero di neuroni dichiarato
(fino a un tetto di 1.500 per non rallentare il canvas).

---

## 4. Cervello 3D (`neurons-3d.js`)

Oggi: 146 nodi fissi, 5 moduli. Diventa:

- Nodi generati in **cluster** con etichetta, uno per area reale di Jarvis: NUCLEO, VOCE, MEMORIA E METODI, AGENTI,
  ARCHIVIO, PRIVACY, SISTEMI, KEVIN (i nomi del video sono di quel progetto; qui rispecchiano i tuoi moduli).
  Numero di nodi per cluster proporzionale ai dati reali (es. ARCHIVIO cresce con i messaggi).
- Modalità **cinema**: overlay a schermo intero nero (`#boot-overlay`), camera che parte sul singolo neurone e
  arretra fino a mostrare tutta la rete, nodi che si accendono a ondate.
- Stati nodo: normale / **guasto** (rosso, etichetta `: FERMO`) / **riparato** (verde, etichetta `: RIPARATO`).
- Barra contatori in basso con animazione del numero che sale; pannello log a sinistra.
- Dopo la sequenza il grafo resta nel pannello laterale già esistente, con i nuovi cluster.

---

## 5. Controllo guasti reale (`server.py`)

Self-check eseguito al risveglio; ogni voce = un «sistema»:

| Controllo | Riparazione automatica |
|-----------|------------------------|
| Database leggibile e tabelle presenti | `CREATE TABLE IF NOT EXISTS`, `PRAGMA integrity_check` |
| Cartella `data/` scrivibile | creazione |
| Chiave API presente e valida (chiamata minima) | nessuna → passa in modalità Locale |
| Servizio TTS raggiungibile | nessuna → ripiego su voce dispositivo |
| Cache vocale coerente (vedi §6) | rigenera i file mancanti |
| Riconoscimento vocale nel browser (`voice.js`) | riavvio del riconoscimento |
| Profilo vocale presente | nessuna → avviso |

Il risultato alimenta la battuta 4:
- guasti trovati **e** riparati → «Stamattina ho già riparato quello che si era rotto.» + nodo rosso→verde con il nome reale (es. `VOCE NATURALE: FERMO` → `RIPARATO`).
- guasti non riparabili → «Ho trovato un problema a *X*; serve il tuo intervento.» e il nodo resta rosso.
- nessun guasto → «Nessun guasto rilevato.» e si passa a «È tutto sotto controllo.»

---

## 6. Voce

- Le battute **fisse** («Buongiorno, signore.», «È tutto sotto controllo.», …) vengono generate con il TTS OpenAI
  già presente (`natural_speech`) **all'avvio del server** e salvate in `data/tts-cache/*.mp3`: la sequenza parte
  senza attesa di rete. Le battute con i **numeri** vengono generate al momento (≈1 s) oppure prese dalla cache
  se i numeri non sono cambiati.
- Nuovo endpoint `GET /api/boot/lines` che restituisce le battute della sequenza con i numeri già inseriti e, per
  ciascuna, l'URL dell'audio in cache.
- Senza chiave API: stessa sequenza con la voce del browser (`speakWithDevice`), nessun costo.
- Appellativo: «signore» come nel video, oppure «Signor Kevin» secondo la preferenza già esistente.

---

## 7. Trigger e flusso (`app.js` + `voice.js`)

1. `voice.js` rileva la wake word «Jarvis» (già c'è) **senza comando dopo** (oggi quella frase viene ignorata):
   nuovo evento `onWake()`.
2. `app.js`: se la sequenza non è ancora stata mostrata **oggi** (chiave `jarvis-boot-date` in `localStorage`)
   → avvia la sequenza; altrimenti risponde solo «Sì, signore?» e resta in ascolto come oggi.
   Comando vocale «Jarvis, riavvia il sistema» o pulsante **«Risveglio»** forzano la sequenza (utile per i video).
3. Durante la sequenza il riconoscimento è sospeso (il meccanismo esiste già: Jarvis non si ascolta mentre parla).
4. Sequenza = timeline guidata dalla **durata reale degli audio**: ogni battuta avanza la scena quando l'audio
   precedente finisce, non con tempi fissi, così resta sincronizzata con qualunque voce.

---

## 8. Ordine di lavoro e consegne

| Fase | Contenuto | File |
|------|-----------|------|
| 0 ✅ | Jarvis v0.9 nel repo, `.gitignore`, cartella musica | — |
| 1 ✅ | `/api/brain/status` + self-check + minimi + test | `server.py`, `test_server.py` |
| 2 ✅ | Cache TTS e pre-generazione (le battute si costruiscono nella pagina da `buildLines`, non serve `/api/boot/lines`) | `server.py`, `test_server.py` |
| 3 ✅ | Grafo 3D a cluster, stati nodo, modalità cinema, contatori, log | `neurons-3d.js`, `index.html`, `style.css` |
| 4 ✅ | Musica con fade/ducking e sblocco audio | `boot.js`, `app.js`, `index.html` |
| 5 ✅ | Wake word → sequenza, timeline sincronizzata con gli audio, pulsante «Risveglio» | `voice.js`, `app.js`, `boot.js`, `test_boot.js` |
| 6 ✅ | README, CHANGELOG v1.0, script di avvio invariati | `README.md`, `CHANGELOG.md` |

Decisioni prese al «procedi» (02/10/2026): appellativo secondo la preferenza esistente («Signore» → «signore» come nel video); cluster di Jarvis; sequenza completa al primo «Jarvis» del giorno, forzabile.

Ogni fase = un commit separato sul branch `claude/optimistic-lovelace-3244dj`, testabile da solo
(`python3 test_server.py`, `node test_voice.js`, prova manuale in Chrome).

---

## 9. Limiti dichiarati

- La musica non viene distribuita con il repo (diritti d'autore): va copiata a mano in `assets/music/intro.mp3`.
- L'audio parte solo dopo un gesto sulla pagina (regola dei browser, non aggirabile).
- La wake word funziona finché la pagina è aperta; a browser chiuso serve l'app nativa prevista nelle versioni future.
- I nomi dei cluster del video (HOSPITALITY, AGENCY, DENNIS…) appartengono a quel progetto: qui i cluster
  rispecchiano i moduli reali di Jarvis. Se vuoi nomi specifici (es. i tuoi progetti), dimmeli.
- Il punto di partenza della musica (~7 s) è una stima: da confermare ascoltando.

## 10. Da confermare prima della fase 3

1. Appellativo nella sequenza: «signore» (come nel video) o «Signor Kevin»?
2. Nomi dei cluster: quelli di Jarvis (proposti sopra) o una lista tua?
3. La sequenza una volta al giorno al primo «Jarvis», oppure a ogni «Jarvis» da solo?
