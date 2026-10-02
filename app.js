const $ = (selector) => document.querySelector(selector);
const elements = {
  messages: $('#messages'), notice: $('#notice'), prompt: $('#prompt'), mic: $('#mic'),
  mode: $('#mode'), memoryList: $('#memory-list'), memoryCount: $('#memory-count'),
  speechToggle: $('#speech-toggle'), voiceTest: $('#test-voice'), qualityToggle: $('#quality-toggle'),
  qualityNote: $('#quality-note'), nodeDetail: $('#node-detail')
};
let speechEnabled = true;
let speechSequence = 0;
let startingListening = false;
let naturalVoiceAvailable = false;
let naturalVoiceEnabled = true;
let activeAudio = null;
let activeAudioUrl = null;
const speechWaiters = new Map();
const AUTO_LISTEN_KEY = 'jarvis-auto-listen-v1';
const BOOT_DATE_KEY = 'jarvis-boot-date-v1';
try { naturalVoiceEnabled = localStorage.getItem('jarvis-natural-voice-v1') !== 'false'; } catch { /* Storage unavailable. */ }
const addressInput = $('#address');
let address = 'Signore';
try { if (['Signor Kevin', 'Signore'].includes(localStorage.getItem('jarvis-address-v2'))) address = localStorage.getItem('jarvis-address-v2'); } catch { /* Storage unavailable. */ }
addressInput.value = address;
const cityInput = $('#city');
let city = '';
try { city = (localStorage.getItem('jarvis-city-v1') || '').slice(0, 80); } catch { /* Storage unavailable. */ }
cityInput.value = city;
const standalone = location.protocol === 'file:';
const browserStore = window.JarvisBrowserStore;
let neural = null;

async function localReply(message) {
  const query = message.toLocaleLowerCase('it').trim();
  const topic = query.match(/(?:detto|parlato|ricordi).*?(?:su|di)\s+(.+)/);
  if (topic) {
    const found = (await browserStore.search(topic[1].replace(/[?!.]+$/, ''), 6)).filter((item) => item.text !== message);
    return found.length ? `Mi hai detto: ${found.slice(0, 5).map((item) => item.text).join('; ')}` : 'Non trovo scambi precedenti su questo argomento.';
  }
  if (query.includes('cosa ricordi') || query.includes('cosa sai di me')) {
    const found = (await browserStore.recent(7, 'user')).filter((item) => item.text !== message).slice(-5);
    return found.length ? `Ricordo questi scambi: ${found.map((item) => item.text).join('; ')}` : 'Non abbiamo ancora conversazioni precedenti da ricordare.';
  }
  if (query.includes('che ore')) return `Sono le ${new Date().toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})}.`;
  if (query.includes('che giorno') || query.includes('data di oggi')) return `Oggi è ${new Date().toLocaleDateString('it-IT')}.`;
  if (/^(ciao|buongiorno|buonasera)/.test(query)) return 'Ciao, sono Jarvis. Sono pronto ad ascoltarti.';
  return 'Ti ho ascoltato. In questa modalità posso mostrarti la rete, ricordare ciò che salvi e rispondere a comandi semplici. Per la modalità AI avviami tramite il programma nella cartella.';
}

async function localApi(path, options) {
  if (path === '/api/state') {
    await browserStore.migrateLegacy();
    return {mode: 'Locale (file)', natural_voice: false, history: await browserStore.recent(10, 'user'), history_count: await browserStore.count('user'), messages: await browserStore.recent(30), voice_identity: 'Sperimentale'};
  }
  if (path === '/api/chat' && options.method === 'POST') {
    const message = JSON.parse(options.body).message;
    await browserStore.append('user', message);
    const reply = addressed(await localReply(message));
    await browserStore.append('assistant', reply);
    return {reply, history: await browserStore.recent(10, 'user'), history_count: await browserStore.count('user')};
  }
  if (path.startsWith('/api/history')) {
    const query = new URL(path, 'http://localhost').searchParams.get('query') || '';
    return {history: await browserStore.search(query, 20), history_count: await browserStore.count('user')};
  }
  throw new Error('Funzione non disponibile in questa modalità.');
}

const nodeDetails = {
  voce: 'La voce viene trascritta dal browser e la risposta è letta ad alta voce. Disponibilità e trattamento dell’audio dipendono dal browser.',
  memoria: 'Archivia automaticamente ogni richiesta e risposta della conversazione. Puoi chiedere a Jarvis di recuperare gli scambi precedenti.',
  cervello: 'Coordina conversazione e memoria. Le risposte AI sono disponibili quando configuri una chiave API.',
  agenti: 'Le funzioni di risposta pronte: conversazione, ricerca nella memoria, ora e data, archivista, analista AI e voce.',
  archivio: 'Il database locale con ogni scambio e ricordo. Cresce con l’uso e fa crescere i neuroni del cervello.',
  sistemi: 'I controlli reali eseguiti al risveglio: server, archivio, cache vocale, musica, riconoscimento vocale. I guasti riparabili vengono sistemati automaticamente.',
  privacy: 'Il server è accessibile solo da questo computer. I ricordi sono in un database locale non cifrato in questa versione.',
  portabilita: 'Copia questa cartella su una chiavetta USB e avvia Jarvis su un computer con Python e browser compatibili.',
  identita: 'Confronto sperimentale dell’impronta vocale, conservata nel browser. Blocca le risposte vocali non riconosciute, ma non è una protezione sicura contro registrazioni o voci imitate.'
};
const nodeLabels = {cervello: 'NUCLEO CENTRALE', voce: 'INTERFACCIA VOCALE', memoria: 'MEMORIA E METODI', agenti: 'AGENTI', archivio: 'ARCHIVIO', sistemi: 'SISTEMI', privacy: 'PROTEZIONE DATI', portabilita: 'UNITÀ PORTATILE', identita: 'IDENTITÀ VOCALE'};

function showNotice(message, error = false) {
  elements.notice.textContent = message;
  elements.notice.classList.toggle('error', error);
}

async function api(path, options = {}) {
  if (standalone) return localApi(path, options);
  const response = await fetch(path, {headers: {'Content-Type': 'application/json'}, ...options});
  let data;
  try { data = await response.json(); } catch { throw new Error('Risposta non valida dal server.'); }
  if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.');
  return data;
}

function selectNode(name) {
  document.querySelectorAll('.node').forEach((node) => node.classList.toggle('selected', node.dataset.node === name));
  document.querySelectorAll('.links path').forEach((path) => path.classList.toggle('active', path.classList.contains(`link-${name}`)));
  document.querySelectorAll('[data-brain-node]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.brainNode === name)));
  neural?.select(name);
  $('#node-label').textContent = nodeLabels[name] || name.toUpperCase();
  const status = $('#node-state');
  status.textContent = name === 'identita' ? (voiceGate.hasProfile ? 'SPERIMENTALE' : 'DA CONFIGURARE') : 'ATTIVO';
  status.classList.toggle('pending', name === 'identita' && !voiceGate.hasProfile);
  elements.nodeDetail.textContent = nodeDetails[name];
}

function addMessage(role, text) {
  const node = document.createElement('div');
  node.className = `message ${role}`;
  node.textContent = text;
  elements.messages.appendChild(node);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function clearAudio() {
  if (activeAudio) {
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.pause();
    activeAudio = null;
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
  }
}

function stopOutput() {
  clearAudio();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function settleSpeech(sequence) {
  const resolve = speechWaiters.get(sequence);
  if (resolve) { speechWaiters.delete(sequence); resolve(); }
}

let bootHold = false; // While the wake-up sequence runs, the microphone stays paused between lines.

function finishSpeech(sequence, message, error = false) {
  settleSpeech(sequence);
  if (sequence !== speechSequence) return;
  clearAudio();
  if (!bootHold) voiceGate.resumeAfterSpeech();
  showNotice(message, error);
}

function speakWithDevice(text, sequence) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    finishSpeech(sequence, 'Questo browser non supporta la voce parlata. Prova Chrome, Edge o Safari.', true);
    return false;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'it-IT';
  utterance.rate = 0.97;
  utterance.pitch = 0.88;
  const voices = speechSynthesis.getVoices();
  const italian = voices.find((voice) => voice.lang.toLowerCase() === 'it-it') || voices.find((voice) => voice.lang.toLowerCase().startsWith('it'));
  if (italian) utterance.voice = italian;
  utterance.onstart = () => {
    if (sequence === speechSequence) showNotice('Jarvis sta parlando con la voce del dispositivo…');
  };
  utterance.onend = () => finishSpeech(sequence, 'Risposta pronunciata.');
  utterance.onerror = (event) => finishSpeech(sequence, `Non riesco a riprodurre la voce (${event.error || 'errore sconosciuto'}).`, true);
  try {
    speechSynthesis.speak(utterance);
    speechSynthesis.resume();
    return true;
  } catch (error) {
    finishSpeech(sequence, `Non riesco ad avviare la voce: ${error.message}`, true);
    return false;
  }
}

async function fetchSpeech(text) {
  const response = await fetch('/api/speech', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({text})
  });
  if (!response.ok) {
    let reason = 'Servizio vocale non disponibile.';
    try { reason = (await response.json()).error || reason; } catch { /* Non-JSON error. */ }
    throw new Error(reason);
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error('Il servizio ha restituito audio vuoto.');
  return blob;
}

// Resolves when Jarvis has finished speaking (or was interrupted). `blob` skips the network when audio is prefetched.
function speak(text, {blob = null} = {}) {
  if (!speechEnabled) {
    showNotice('La voce di Jarvis è disattivata. Premi «Voce disattivata» per riattivarla.');
    return Promise.resolve(false);
  }
  const sequence = ++speechSequence;
  for (const previous of [...speechWaiters.keys()]) settleSpeech(previous);
  const done = new Promise((resolve) => speechWaiters.set(sequence, resolve));
  stopOutput();
  voiceGate.pauseForSpeech();
  const start = async () => {
    if (!naturalVoiceAvailable || !naturalVoiceEnabled || standalone) return speakWithDevice(text, sequence);
    let fallbackStarted = false;
    const fallback = (reason) => {
      if (sequence !== speechSequence || fallbackStarted) return false;
      fallbackStarted = true;
      clearAudio();
      showNotice(`Voce naturale non disponibile: ${reason} Uso la voce del dispositivo.`);
      return speakWithDevice(text, sequence);
    };
    try {
      if (!blob) showNotice('Genero la voce naturale di Jarvis…');
      const audio = blob || await fetchSpeech(text);
      if (sequence !== speechSequence) return false;
      activeAudioUrl = URL.createObjectURL(audio);
      activeAudio = new Audio(activeAudioUrl);
      activeAudio.onplay = () => { if (sequence === speechSequence) showNotice('Jarvis sta parlando con voce AI naturale…'); };
      activeAudio.onended = () => finishSpeech(sequence, 'Risposta pronunciata con voce AI naturale.');
      activeAudio.onerror = () => fallback('riproduzione non riuscita.');
      await activeAudio.play();
      return true;
    } catch (error) {
      return fallback(error.message);
    }
  };
  return start().then((started) => started === false && sequence === speechSequence ? settleSpeech(sequence) : null).then(() => done).then(() => sequence === speechSequence);
}

function addressed(text) {
  if (text.toLocaleLowerCase('it').startsWith(address.toLocaleLowerCase('it'))) return text;
  return `${address}, ${text.charAt(0).toLocaleLowerCase('it')}${text.slice(1)}`;
}

function renderHistory(items, count) {
  elements.memoryList.replaceChildren();
  elements.memoryCount.textContent = `${count} ${count === 1 ? 'scambio' : 'scambi'}`;
  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'Nessuna conversazione ancora registrata.';
    elements.memoryList.appendChild(empty);
    return;
  }
  for (const item of [...items].reverse()) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = item.text;
    li.append(span);
    elements.memoryList.appendChild(li);
  }
}

async function loadState() {
  try {
    const state = await api('/api/state');
    elements.mode.textContent = `Modalità ${state.mode}`;
    naturalVoiceAvailable = Boolean(state.natural_voice);
    updateQualityControls();
    renderHistory(state.history, state.history_count);
    if (state.messages.length) {
      elements.messages.replaceChildren();
      for (const item of state.messages) addMessage(item.role, item.text);
    } else {
      elements.messages.firstElementChild.textContent = `${window.JarvisBoot.greeting(new Date().getHours())}, ${address === 'Signore' ? 'signore' : address}. Il cervello 3D è attivo e ricorderò automaticamente le nostre conversazioni.`;
    }
  if (standalone) showNotice('Modalità diretta dal file: la memoria resta in questo browser. Per l’ascolto vocale, usa «Avvia Jarvis.command» e apri la pagina locale; se hai già registrato la voce qui, il profilo non passa automaticamente all’altro indirizzo.');
  } catch (error) { showNotice(error.message, true); }
}

$('#chat-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = elements.prompt.value.trim();
  if (!message) return;
  elements.prompt.value = '';
  addMessage('user', message);
  selectNode('cervello');
  showNotice('Jarvis sta pensando…');
  try {
    const data = await api('/api/chat', {method: 'POST', body: JSON.stringify({message, address})});
    const reply = addressed(data.reply);
    addMessage('assistant', reply);
    renderHistory(data.history, data.history_count);
    selectNode('memoria');
    showNotice('Risposta pronta; avvio della voce…');
    speak(reply);
  } catch (error) {
    showNotice(error.message, true);
    if (!standalone) await loadState();
  }
});

function setSpeechEnabled(enabled) {
  speechEnabled = enabled;
  elements.speechToggle.textContent = speechEnabled ? 'Voce attiva' : 'Voce disattivata';
  elements.speechToggle.setAttribute('aria-pressed', String(speechEnabled));
  if (!speechEnabled) {
    speechSequence++;
    stopOutput();
    voiceGate.resumeAfterSpeech();
  }
}

function updateQualityControls() {
  elements.qualityToggle.disabled = !naturalVoiceAvailable;
  elements.qualityToggle.textContent = naturalVoiceAvailable
    ? `Voce naturale ${naturalVoiceEnabled ? 'attiva' : 'disattivata'}`
    : 'Voce naturale: serve API';
  elements.qualityToggle.setAttribute('aria-pressed', String(naturalVoiceAvailable && naturalVoiceEnabled));
  elements.qualityNote.textContent = naturalVoiceAvailable
    ? 'La voce naturale è generata dall’AI: il testo delle risposte viene inviato a OpenAI e può avere un costo. Puoi disattivarla qui sopra.'
    : 'Voce AI non attiva: Jarvis usa una voce installata sul dispositivo. Per la voce naturale avvialo con una chiave API.';
}

elements.qualityToggle.addEventListener('click', () => {
  naturalVoiceEnabled = !naturalVoiceEnabled;
  try { localStorage.setItem('jarvis-natural-voice-v1', String(naturalVoiceEnabled)); } catch { /* Storage unavailable. */ }
  updateQualityControls();
  showNotice(naturalVoiceEnabled ? 'Voce naturale attiva. Premi «Prova voce» per ascoltarla.' : 'Userò la voce del dispositivo.');
});

elements.speechToggle.addEventListener('click', () => {
  setSpeechEnabled(!speechEnabled);
  showNotice(speechEnabled ? 'Voce di Jarvis attiva. Premi «Prova voce» per ascoltarla.' : 'Voce di Jarvis disattivata.');
});

elements.voiceTest.addEventListener('click', () => {
  setSpeechEnabled(true);
  showNotice('Avvio della prova vocale…');
  speak(`Buongiorno, ${address}. Sono Jarvis. Riesci a sentirmi?`);
});

const voiceGate = new window.JarvisVoiceGate({
  onVerified(command) {
    if (/^(?:riavvia|risveglia|avvia|esegui)\w*\b.*\b(?:sistema|sequenza|cervello|risveglio)|^risveglio$/i.test(command)) {
      runBoot({force: true});
      return;
    }
    elements.prompt.value = command;
    $('#chat-form').requestSubmit();
  },
  onWake() { runBoot({force: false}); },
  onStatus(message) { showNotice(message); },
  onError(message) { showNotice(message, true); updateVoiceControls(); },
  onListening(active) { elements.mic.classList.toggle('listening', active); updateVoiceControls(); }
});

const enrollmentPhrases = [
  '«Jarvis, sono Kevin e questa è la mia voce.»',
  '«Jarvis, ascolta la mia voce mentre parlo.»',
  '«Jarvis, aiutami a organizzare la giornata.»'
];

function updateVoiceControls() {
  const ready = voiceGate.hasProfile;
  document.querySelector('.node[data-node="identita"]').classList.toggle('pending', !ready);
  $('#voice-badge').textContent = ready ? 'Profilo registrato' : 'Da configurare';
  $('#identity-status').textContent = ready ? 'Confronto vocale sperimentale attivo' : 'Identità vocale: da configurare';
  $('#enroll').textContent = ready && !voiceGate.enrollmentCount ? 'Registra nuovo profilo' : `Registra campione ${voiceGate.enrollmentCount + 1}/3`;
  $('#listen').disabled = startingListening;
  $('#listen').textContent = startingListening ? 'Attivazione in corso…' : voiceGate.enabled ? 'Ferma ascolto continuo' : 'Avvia ascolto continuo';
  $('#forget-voice').disabled = !ready;
  elements.mic.disabled = startingListening || !ready || !voiceGate.supported;
  $('#voice-prompt').textContent = enrollmentPhrases[Math.min(voiceGate.enrollmentCount, 2)];
}

async function toggleListening() {
  if (!voiceGate.supported) {
    showNotice('Il riconoscimento vocale non è disponibile in questo browser. Apri Jarvis in Chrome o Edge.', true);
    return;
  }
  if (!voiceGate.hasProfile) {
    selectNode('identita');
    showNotice('Prima registra i tre campioni nel riquadro «La tua voce». Poi l’ascolto partirà automaticamente.', true);
    return;
  }
  if (voiceGate.enabled) {
    voiceGate.stop();
    try { localStorage.setItem(AUTO_LISTEN_KEY, 'false'); } catch { /* Storage unavailable. */ }
    showNotice('Ascolto continuo fermato.');
    return;
  }
  startingListening = true;
  updateVoiceControls();
  showNotice('Sto attivando il microfono e il riconoscimento vocale… Se appare una richiesta del browser, consenti l’accesso.');
  try {
    await voiceGate.start();
    try { localStorage.setItem(AUTO_LISTEN_KEY, 'true'); } catch { /* Storage unavailable. */ }
    selectNode('voce');
  } catch (error) { showNotice(error.message, true); }
  finally { startingListening = false; updateVoiceControls(); }
}

$('#enroll').addEventListener('click', async () => {
  try { localStorage.setItem(AUTO_LISTEN_KEY, 'false'); } catch { /* Storage unavailable. */ }
  const button = $('#enroll');
  button.disabled = true;
  $('#voice-help').textContent = 'Registrazione in corso per circa quattro secondi. Leggi ora la frase mostrata.';
  showNotice('Sto registrando il campione della tua voce…');
  try {
    const result = await voiceGate.enrollSample();
    if (result.complete) {
      $('#voice-help').textContent = 'Profilo pronto. Sto attivando l’ascolto: di’ «Jarvis» seguito da una richiesta nella stessa frase.';
      selectNode('identita');
      try {
        await voiceGate.start();
        try { localStorage.setItem(AUTO_LISTEN_KEY, 'true'); } catch { /* Storage unavailable. */ }
        showNotice('La tua voce è registrata e l’ascolto è attivo. Prova: «Jarvis, che ore sono?»');
      } catch (startError) {
        $('#voice-help').textContent = 'Profilo pronto. Premi «Avvia ascolto continuo» per abilitare il microfono.';
        showNotice(`Profilo registrato, ma l’ascolto non è partito: ${startError.message}`, true);
      }
    } else {
      $('#voice-help').textContent = `${result.count} di 3 campioni registrati. Premi di nuovo e leggi la nuova frase.`;
      showNotice(`Campione ${result.count}/3 salvato.`);
    }
  } catch (error) {
    $('#voice-help').textContent = 'Registrazione non riuscita. Riprova in un ambiente silenzioso.';
    showNotice(error.message, true);
  } finally { button.disabled = false; updateVoiceControls(); }
});

$('#listen').addEventListener('click', toggleListening);
elements.mic.addEventListener('click', toggleListening);
$('#forget-voice').addEventListener('click', () => {
  voiceGate.forget();
  try { localStorage.setItem(AUTO_LISTEN_KEY, 'false'); } catch { /* Storage unavailable. */ }
  $('#voice-help').textContent = 'Profilo eliminato. Per riattivare l’ascolto, registra tre nuovi campioni.';
  showNotice('Impronta vocale eliminata da questo browser.');
  updateVoiceControls();
});
addressInput.addEventListener('change', () => {
  address = addressInput.value;
  try { localStorage.setItem('jarvis-address-v2', address); } catch { /* Storage unavailable. */ }
  showNotice(`Da ora la chiamerò ${address}.`);
});
cityInput.addEventListener('change', () => {
  city = cityInput.value.trim().slice(0, 80);
  try { localStorage.setItem('jarvis-city-v1', city); } catch { /* Storage unavailable. */ }
  showNotice(city ? `Meteo di ${city} al prossimo risveglio.` : 'Meteo dalla posizione del browser al prossimo risveglio.');
});
if (!voiceGate.supported) {
  $('#enroll').disabled = true;
  $('#voice-help').textContent = 'Il browser non supporta il confronto vocale. Prova Chrome o Edge aggiornato.';
}
updateVoiceControls();
try { if (voiceGate.hasProfile && voiceGate.supported && localStorage.getItem(AUTO_LISTEN_KEY) !== 'false') toggleListening(); } catch { /* Browser may require a new click. */ }

neural = new window.JarvisNeural3D($('#neural-canvas'), selectNode);
document.querySelectorAll('[data-brain-node]').forEach((button) => button.addEventListener('click', () => selectNode(button.dataset.brainNode)));
selectNode('cervello');

/* Wake-up sequence: "Jarvis" alone starts it once a day; the button or "Jarvis, riavvia il sistema" force it. */
const boot = window.JarvisBoot;
const bootMusic = new boot.Music('/assets/music/intro.mp3');
const bootNeural = new window.JarvisNeural3D($('#boot-canvas'), () => {}, {cinema: true});
const bootSequence = new boot.Sequence({
  overlay: $('#boot-overlay'), neural: bootNeural, music: bootMusic,
  elements: {log: $('#boot-log'), caption: $('#boot-caption'), neurons: $('#boot-neurons'), connections: $('#boot-connections'), systems: $('#boot-systems'), agents: $('#boot-agents')},
  say: (text) => speak(text, {blob: bootAudio.get(text) || null})
});
let bootAudio = new Map();
let bootPending = null;

function bootShownToday() {
  try { return localStorage.getItem(BOOT_DATE_KEY) === boot.today(); } catch { return false; }
}

async function loadBrainStatus() {
  let status;
  if (standalone) status = boot.localStatus({messages: await browserStore.count()});
  else status = await api('/api/brain/status');
  return boot.mergeBrowserSystems(status, {supported: voiceGate.supported, hasProfile: voiceGate.hasProfile, listening: voiceGate.enabled});
}

function applyBrainStatus(status) {
  neural.setStatus(status);
  $('#brain-count').textContent = `${status.neurons.toLocaleString('it-IT')} NEURONI · ${status.systems_active} SISTEMI`;
}

// Weather for the wake-up line: the configured city, else the browser position, else the server's own city file.
function browserPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), 6000);
    navigator.geolocation.getCurrentPosition(
      (position) => { clearTimeout(timer); resolve({lat: position.coords.latitude, lon: position.coords.longitude}); },
      () => { clearTimeout(timer); resolve(null); },
      {timeout: 5000, maximumAge: 600000}
    );
  });
}

async function loadWeather() {
  if (standalone) return null;
  try {
    if (city) return await api(`/api/weather?city=${encodeURIComponent(city)}`);
    const position = await browserPosition();
    if (position) return await api(`/api/weather?lat=${position.lat}&lon=${position.lon}`);
    return await api('/api/weather');
  } catch (error) {
    showNotice(`Meteo non disponibile: ${error.message}`);
    return null;
  }
}

async function prefetchBootAudio(lines) {
  bootAudio = new Map();
  if (!naturalVoiceAvailable || !naturalVoiceEnabled || standalone || !speechEnabled) return;
  await Promise.all(lines.map(async (line) => {
    try { bootAudio.set(line.text, await fetchSpeech(line.text)); } catch { /* The line falls back to the device voice. */ }
  }));
}

async function runBoot({force = false} = {}) {
  if (bootSequence.running) return;
  if (!force && bootShownToday()) {
    speak(address === 'Signore' ? (new Date().getMinutes() % 2 ? 'Mi dica, signore.' : 'Sì, signore?') : `Sì, ${address}?`);
    return;
  }
  if (!bootMusic.unlocked) {
    const unlocked = await bootMusic.unlock();
    if (!unlocked) {
      bootPending = {force};
      $('#boot-overlay').hidden = false;
      $('#boot-unlock').hidden = false;
      showNotice('Il browser attiva l’audio solo dopo un tocco: premi «Attiva il risveglio».');
      return;
    }
  }
  $('#boot-unlock').hidden = true;
  showNotice('Risveglio in corso…');
  let status, weather;
  try { [status, weather] = await Promise.all([loadBrainStatus(), loadWeather()]); } catch (error) { showNotice(`Risveglio non riuscito: ${error.message}`, true); $('#boot-overlay').hidden = true; return; }
  const lines = boot.buildLines(status, address, {now: new Date(), weather});
  const music = bootMusic.load().catch((error) => { showNotice(`Musica di avvio non disponibile: ${error.message}`); return null; });
  await Promise.all([prefetchBootAudio(lines), music]);
  try { localStorage.setItem(BOOT_DATE_KEY, boot.today()); } catch { /* Storage unavailable. */ }
  bootHold = true;
  voiceGate.pauseForSpeech();
  let completed = false;
  try { completed = await bootSequence.run(lines); }
  finally { bootHold = false; voiceGate.resumeAfterSpeech(); }
  applyBrainStatus(status);
  showNotice(completed ? `Risveglio completato: ${status.neurons} neuroni, ${status.systems_active} sistemi attivi, ${status.agents_ready} agenti pronti.` : 'Risveglio interrotto.');
}

$('#boot-unlock-button').addEventListener('click', async () => {
  const pending = bootPending || {force: true};
  bootPending = null;
  await bootMusic.unlock();
  $('#boot-unlock').hidden = true;
  runBoot(pending);
});
$('#boot-skip').addEventListener('click', () => {
  if (bootSequence.running) {
    bootSequence.cancel();
    speechSequence++;
    for (const previous of [...speechWaiters.keys()]) settleSpeech(previous);
    stopOutput();
    return;
  }
  $('#boot-overlay').hidden = true;
  $('#boot-unlock').hidden = true;
  bootPending = null;
});
$('#wake').addEventListener('click', () => runBoot({force: true}));
document.addEventListener('pointerdown', () => { if (!bootMusic.unlocked) bootMusic.unlock(); }, {capture: true});
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && bootSequence.running) $('#boot-skip').click(); });
loadBrainStatus().then(applyBrainStatus).catch(() => {});

document.querySelectorAll('.node').forEach((node) => {
  const select = () => selectNode(node.dataset.node);
  node.addEventListener('click', select);
  node.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
});

loadState();
