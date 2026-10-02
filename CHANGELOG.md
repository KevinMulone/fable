# Versioni di Jarvis

## v1.0 — risveglio

- Sequenza di risveglio a schermo intero quando dici «Jarvis» da solo (una volta al giorno), con il pulsante «Risveglio» o con «Jarvis, riavvia il sistema»: un neurone, la rete che si espande, le etichette dei cluster, il controllo guasti e «È tutto sotto controllo».
- Numeri veri con minimo garantito: neuroni dall'archivio, sistemi dai controlli reali (`/api/brain/status`), agenti dalle funzioni attive.
- Controllo guasti con riparazione automatica (archivio SQLite, cartella dati, cache vocale) e battuta diversa se c'è stato un guasto riparato, uno non riparabile o nessuno.
- Musica di avvio dal file locale `assets/music/intro.mp3` (non distribuito), con dissolvenza e volume abbassato mentre Jarvis parla.
- Battute fisse pre-generate e messe in cache (`data/tts-cache`) quando c'è la chiave API: la sequenza parte senza attese.
- Cervello 3D riorganizzato in cluster (voce, memoria e metodi, agenti, archivio, privacy, sistemi, portabilità, identità) con il numero reale di neuroni.

## v0.9 — voce naturale originale

- Sintesi vocale AI più fluida quando Jarvis è avviato con una chiave API, con tono originale caldo e tecnologico, senza imitare una persona reale.
- Ripiego automatico sulla voce italiana del dispositivo se il servizio vocale o la riproduzione non sono disponibili.
- Pulsante per attivare o disattivare la voce naturale e informativa sul fatto che l'audio è generato dall'AI e può avere costi API.
- Chiave mantenuta sul server locale: la pagina riceve solo il file audio, non la chiave.

## v0.8 — avvio in Chrome su Mac

- Sul Mac, `Avvia Jarvis.command` apre la pagina locale in Google Chrome quando è già installato.
- Messaggio «network» corretto: indica un servizio di trascrizione non raggiungibile dal browser, non necessariamente assenza di Internet.
- Se il browser ha già disponibile il riconoscimento italiano sul dispositivo, Jarvis lo preferisce senza scaricare pacchetti.

## v0.7 — diagnosi dell'ascolto continuo

- Il clic su «Avvia ascolto continuo» mostra subito l'avanzamento, anche mentre il browser chiede il permesso al microfono.
- Lo stato «attivo» appare solo quando il browser conferma l'avvio del riconoscimento; dopo sei secondi senza conferma viene mostrato un errore.
- Messaggi distinti per microfono negato, assente, occupato, servizio indisponibile, rete e lingua non supportata.
- Il pulsante non resta inerte se il profilo non è presente o il browser non supporta il riconoscimento.
- Avvio della cattura audio anche all'evento di suono, nei browser che non segnalano l'inizio della frase.

## v0.6 — attivazione vocale

- L'ascolto si avvia automaticamente dopo il terzo campione, se il browser lo consente, e si riattiva alla riapertura salvo arresto esplicito.
- Le frasi più brevi possono superare la verifica vocale; se sono troppo brevi, viene mostrato un messaggio concreto.
- Stato più chiaro quando manca l'audio di verifica, manca «Jarvis» o il riconoscimento non parte.
- Istruzioni per distinguere il profilo vocale salvato in `file://` da quello della pagina avviata in locale.

## v0.5 — voce e verifica audio

- Ripristinata la lettura ad alta voce anche delle risposte ai messaggi digitati.
- Aggiunto il pulsante «Prova voce» per verificare immediatamente l'uscita audio del browser.
- Lo stato indica quando Jarvis inizia a parlare, termina o incontra un errore; il filtro per le richieste dal microfono resta attivo.

## v0.4 — neuroni 3D e memoria automatica

- Rete di 146 neuroni proiettati in 3D, ruotabile con mouse o tocco, con collegamenti e segnali animati.
- Pulsanti accessibili per esplorare i moduli e vedere lo stato selezionato.
- Ogni richiesta e risposta viene archiviata automaticamente; rimosso il modulo di salvataggio manuale.
- Ricerca nelle conversazioni precedenti e recupero tramite domande in linguaggio naturale semplice.
- Modalità programma: archivio completo in SQLite. Modalità file diretto: archivio in IndexedDB con importazione dei dati precedenti.

## v0.3 — ascolto continuo e profilo vocale

- Ascolto continuo durante la sessione del browser, riavviato automaticamente quando il riconoscimento si interrompe.
- Tre campioni per creare un'impronta vocale locale e filtro sperimentale prima di ogni richiesta parlata.
- Attivazione con «Jarvis» e finestra di otto secondi per dire il comando successivo.
- Risposte vocali rivolte a «Signor Kevin» o «Signore», secondo la preferenza scelta.
- Controlli per fermare l'ascolto ed eliminare il profilo vocale.
- Jarvis sospende il riconoscimento mentre parla, per evitare di rispondere alla propria voce.

## v0.2 — interfaccia neurale

- Nuova mappa in stile HUD olografico: nucleo centrale, orbite, connessioni luminose e segnali animati.
- Selezione dei moduli con mouse o tastiera e indicazione del loro stato reale.
- Apertura diretta di `index.html` con funzioni locali e memoria del browser.
- Rispetto della preferenza di sistema per ridurre le animazioni.

## v0.1 — prima consegna

- Interfaccia in italiano con chat e risposta vocale.
- Dettatura tramite le funzioni del browser, quando disponibili.
- Memoria locale con aggiunta e cancellazione esplicite.
- Mappa interattiva delle funzioni e del loro stato.
- Avvio da cartella trasferibile su chiavetta USB per macOS, Windows e Linux.
- Modalità locale essenziale e modalità AI opzionale.
- Test automatici di chat, memoria e validazione delle richieste.

Non ancora implementati: verifica biometrica della voce, parola di attivazione, cifratura interna, app mobili e integrazioni con servizi esterni.
