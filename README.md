# Jarvis v1.1 — maggiordomo

Jarvis è un assistente personale locale che ascolta dal browser, risponde a voce, archivia automaticamente le conversazioni e mostra una rete 3D di neuroni ruotabile. Mantiene l'ascolto continuo e il confronto sperimentale della voce introdotti nella v0.3. Funziona senza installare pacchetti Python.

## Risveglio

Di' **«Jarvis»** da solo (con l'ascolto continuo attivo) e parte la sequenza di risveglio a schermo intero: un neurone, la rete che si espande, le etichette dei cluster, il controllo dei guasti e «È tutto sotto controllo». La sequenza completa parte una volta al giorno; le altre volte Jarvis risponde «Sì, signore?» e aspetta la richiesta. Per rivederla premi **«Risveglio»** in alto oppure di' «Jarvis, riavvia il sistema». «Salta» o il tasto Esc la interrompono.

- **Numeri veri.** Neuroni = messaggi e ricordi archiviati più moduli, agenti e metodi; sistemi attivi = controlli reali superati (server, archivio, cache vocale, musica, riconoscimento vocale…); agenti pronti = funzioni di risposta disponibili. Sotto le soglie minime (120 neuroni, 8 sistemi, 3 agenti) Jarvis dice il minimo; sopra, crescono con l'uso. L'elenco completo è in `http://127.0.0.1:8765/api/brain/status`.
- **Controllo guasti.** Al risveglio Jarvis verifica archivio, cartella dati e cache vocale e ripara quello che può (per esempio ricrea un archivio danneggiato, conservando una copia `.danneggiato`). Se ha riparato qualcosa lo dice; se un problema richiede il tuo intervento lo nomina; altrimenti «Nessun guasto rilevato».
- **Musica.** Copia il brano che vuoi in `assets/music/intro.mp3` (non è incluso e non viene salvato su git). Parte da circa 7 secondi dall'inizio: il valore `MUSIC_START_SECONDS` in `boot.js` si regola a orecchio. Il volume scende mentre Jarvis parla e si chiude in dissolvenza alla fine.
- **Audio e browser.** I browser avviano l'audio solo dopo un tocco sulla pagina: il clic su «Avvia ascolto continuo» o su «Risveglio» basta. Se la sequenza parte dalla voce prima di qualunque clic, Jarvis mostra «Attiva il risveglio» e parte al tocco.
- **Voce.** Con la chiave API le battute fisse vengono generate all'avvio e conservate in `data/tts-cache`; quelle con i numeri vengono generate prima di iniziare, così la sequenza non aspetta la rete. Senza chiave si usa la voce del dispositivo.
- **Ora e meteo.** Jarvis saluta in base all'ora, dice che ore sono con un commento e il meteo: temperatura attuale, pioggia prevista (con probabilità) o bella giornata. I dati vengono da Open-Meteo, senza registrazione. Scrivi la città nel pannello «La tua voce»; se la lasci vuota, Chrome chiede la posizione; in alternativa crea `data/citta.txt` con il nome della città o imposta `JARVIS_CITY`.
- **Chiave senza Terminale.** Se metti la chiave OpenAI in `data/openai.key` (una riga), Jarvis la trova da solo anche col doppio clic. La variabile `OPENAI_API_KEY`, se presente, ha la precedenza.

## Scegliere la voce

Jarvis può parlare con due servizi; nessuno dei due imita persone reali o personaggi.

- **OpenAI** (serve `data/openai.key`): voce predefinita `cedar`. Per una voce più profonda scrivi `openai:onyx` nel file `data/voce.txt` (altre voci maschili: `echo`, `ash`).
- **ElevenLabs** (voci più naturali; piano gratuito con un limite mensile di caratteri): crea un account su elevenlabs.io, copia la chiave API in `data/elevenlabs.key` e, se vuoi una voce precisa, scrivi `elevenlabs:ID_DELLA_VOCE` in `data/voce.txt` (l'ID lo copi dalla libreria voci). Senza `voce.txt`, Jarvis sceglie da solo una voce maschile della libreria, britannica se c'è. Se ElevenLabs non risponde o la quota è finita, Jarvis ripiega su OpenAI e poi sulla voce del dispositivo.

Quando cambi voce, le battute vengono rigenerate alla prima occasione (la cache in `data/tts-cache` distingue le voci). Il riquadro «La tua voce» mostra quale voce è attiva; se senti la voce del Mac, premi «Prova voce» e il riquadro di stato dice il motivo (chiave non valida, credito esaurito, servizio non raggiungibile).

## Avvio

- macOS: fai doppio clic su `Avvia Jarvis.command` oppure esegui `python3 server.py`. Se Google Chrome è installato nella cartella Applicazioni, Jarvis si apre automaticamente lì; altrimenti usa il browser predefinito.
- Windows: fai doppio clic su `Avvia Jarvis.bat`. È richiesto Python 3.9 o successivo.
- Linux: esegui `python3 server.py`.
- Apri `http://127.0.0.1:8765` se il browser non si apre automaticamente.
- Puoi anche aprire direttamente `index.html`: la rete 3D e le funzioni locali di base funzionano nel browser, con conversazioni conservate in IndexedDB. Per usare il database nella cartella, la modalità AI e la memoria portatile su chiavetta, avvia il programma come indicato sopra.

Consenti l'uso del microfono nel browser. Il riconoscimento vocale del browser è disponibile soprattutto in Chrome ed Edge; può richiedere Internet e l'audio può essere elaborato dal fornitore del browser. La sintesi vocale usa le voci installate sul dispositivo. Per controllare l'audio, premi **«Prova voce»**: Jarvis deve dire «Buongiorno, Signor Kevin…». Se non lo senti, controlla il volume del dispositivo, l'uscita audio, l'eventuale audio disattivato nella scheda e il messaggio di stato sotto la conversazione. Dopo ogni risposta, Jarvis parla anche quando gli scrivi nella chat.

## Configurazione della tua voce

1. Apri il pannello «La tua voce» e registra i tre campioni, leggendo ogni frase mostrata in un ambiente silenzioso.
2. Scegli se Jarvis deve chiamarti «Signor Kevin» o «Signore».
3. Dopo il terzo campione Jarvis prova ad avviare l'ascolto automaticamente. Di' «Jarvis, che ore sono?» tutto in una frase: una sola parola può essere troppo breve per verificare la tua voce. Se l'avvio automatico viene bloccato, premi «Avvia ascolto continuo» e consenti il microfono. Dopo un riavvio della pagina Jarvis prova a riattivare l'ascolto, se il browser conserva il permesso.
4. Premi «Ferma ascolto continuo» quando vuoi disattivarlo. L'ascolto cessa anche quando chiudi la pagina o il browser.

Jarvis analizza localmente alcuni tratti acustici e salva solo l'impronta numerica nel browser, non le registrazioni. Se la voce non corrisponde al profilo registrato, ignora la richiesta vocale. Le richieste dal microfono devono superare questo filtro; le richieste scritte manualmente nella chat producono comunque una risposta parlata. Puoi eliminare il profilo con «Elimina profilo».

**Limite importante:** questo confronto è sperimentale. Può sbagliare sia con la tua voce sia con la voce di altri e non blocca in modo affidabile registrazioni, imitazioni o voci sintetiche. Non è un sistema di autenticazione biometrica per dati riservati. L'impronta numerica è conservata nel browser senza cifratura aggiuntiva. Il servizio di trascrizione del browser può inviare l'audio al proprio fornitore anche se il confronto dell'impronta avviene localmente.

«Sempre in ascolto» significa finché la pagina è aperta, il dispositivo è sveglio, il microfono è autorizzato e il browser mantiene attivo il riconoscimento. Per l'ascolto anche con il browser chiuso servirà un'applicazione nativa, prevista in una fase successiva.

Se usi `index.html` direttamente, prova invece ad avviare Jarvis con `Avvia Jarvis.command` (macOS), `Avvia Jarvis.bat` (Windows) o `python3 server.py` (Linux) e apri `http://127.0.0.1:8765`. L'indirizzo `file://` e l'indirizzo `http://127.0.0.1` hanno archivi del browser distinti: un profilo vocale registrato in uno non compare automaticamente nell'altro. Controlla che il pannello dica «Profilo registrato» e che il pulsante dica «Ferma ascolto continuo» prima della prova. Se il browser non supporta il riconoscimento vocale, Jarvis lo indica nel pannello; nessuna versione web può garantire l'ascolto a browser chiuso.

Quando premi «Avvia ascolto continuo», sotto la conversazione compare subito «Sto attivando…». Se il browser non concede il microfono, non trova un dispositivo, non avvia il riconoscimento entro sei secondi o restituisce un errore, Jarvis mostra la causa in quello stesso riquadro. Il badge «Profilo registrato» indica solo che il campione è salvato, non che il microfono stia ascoltando. Il segnale di ascolto effettivo è il messaggio «Ascolto continuo attivo».

Se compare un errore di rete mentre usi Jarvis nel browser interno o con `file://`, non significa necessariamente che la tua connessione sia guasta: potrebbe essere il servizio di trascrizione di quel browser a non rispondere. Sul Mac avvia `Avvia Jarvis.command` e usa la pagina aperta in Chrome. Concedi il microfono quando richiesto. Il profilo vocale del vecchio indirizzo `file://` non è condiviso con Chrome: registra nuovamente i tre campioni una volta sola. Jarvis preferisce il riconoscimento sul dispositivo se il browser dispone già del pacchetto italiano; non installa pacchetti automaticamente. Se anche Chrome mostra «network», verifica la connessione o eventuali blocchi del servizio di riconoscimento.

## Intelligenza opzionale

Senza una chiave API, Jarvis funziona in modalità locale con comandi semplici e può ritrovare frasi precedenti cercando le parole indicate. Per le risposte con un modello AI, imposta la variabile d'ambiente `OPENAI_API_KEY` prima dell'avvio. Puoi scegliere il modello con `JARVIS_MODEL`; il valore predefinito è `gpt-4.1-mini`. La chiave resta sul computer e non deve essere copiata nella chiavetta o nell'archivio ZIP. Quando la modalità AI è attiva, il testo della richiesta, i ricordi precedenti e alcuni scambi recenti o pertinenti sono inviati al servizio API. L'interfaccia indica sempre la modalità attiva.

Con la chiave API attiva e Jarvis avviato tramite `server.py`, le risposte sono pronunciate con una voce AI originale più fluida, dal tono caldo, sicuro e leggermente tecnologico. Non è la voce di Tony Stark né una copia della voce dell'attore. Il pulsante «Voce naturale» permette di tornare alla voce del dispositivo; «Prova voce» riproduce un breve saluto. Se la generazione o la riproduzione AI non riesce, Jarvis usa automaticamente la voce del browser. Quando è attiva la voce naturale, il testo delle risposte viene inviato al servizio OpenAI per generare audio; ogni generazione può avere un costo API aggiuntivo. La voce ascoltata è generata dall'AI, non da un essere umano. Senza chiave API o aprendo direttamente `index.html`, funziona soltanto la voce installata sul dispositivo.

## Memoria automatica e chiavetta USB

Ogni richiesta rivolta a Jarvis e ogni sua risposta sono salvate automaticamente come testo. Non devi premere «Salva» e Jarvis non registra l'audio ambientale o le conversazioni a cui non risponde. Puoi chiedere, per esempio, «Cosa ti ho detto su colore?» per ritrovare uno scambio precedente. La memoria locale senza AI usa una ricerca per parole, quindi non riconosce necessariamente sinonimi o parafrasi.

Se avvii Jarvis dal programma, l'archivio completo è `data/jarvis.sqlite3`, creato al primo avvio. Per trasferire Jarvis su una chiavetta, copia l'intera cartella `Jarvis` sulla chiavetta e avvialo da lì su un computer compatibile: il database si aggiorna automaticamente nella cartella copiata. **Questa versione non cifra il database:** usa una chiavetta cifrata per dati riservati.

Se apri direttamente `index.html`, l'archivio è nel browser tramite IndexedDB. In questa modalità la memoria **non segue la chiavetta USB** quando cambi computer e può essere cancellata dal browser o soggetta ai suoi limiti di spazio. Le vecchie conversazioni della v0.2 salvate nel browser vengono importate automaticamente quando possibile.

## Cosa è pronto e cosa manca

Pronto: sequenza di risveglio con musica e numeri reali, controllo guasti con riparazione automatica, rete di neuroni 3D a cluster ruotabile e selezionabile, archivio automatico di richieste e risposte, recupero per parola, ascolto continuo nella pagina dove supportato dal browser, filtro vocale sperimentale per il microfono, risposta parlata alle richieste vocali riconosciute e ai messaggi digitati, voce AI naturale opzionale con ripiego sulla voce del dispositivo, pulsante per provare l'audio, avvio da cartella o chiavetta, funzionamento locale di base e modalità AI opzionale.

Da realizzare nelle prossime versioni: riconoscimento del parlante con un modello dedicato e verificato, parola di attivazione locale anche a browser chiuso, app native per telefoni, integrazioni con calendario/email/casa, cifratura interna, apprendimento controllato e modello AI completamente offline.

La rete 3D è una rappresentazione interattiva delle funzioni di Jarvis. I neuroni disegnati non sono i parametri interni del modello AI e la loro animazione non misura il ragionamento del modello.

## Privacy e limiti

Il server ascolta solo su `127.0.0.1` e non è raggiungibile direttamente dalla rete. La modalità AI usa l'API solo quando configuri la chiave. Le risposte locali sono limitate a funzioni basilari. Non sono presenti invio di email, pagamenti, controllo di file esterni o altre azioni automatiche.
