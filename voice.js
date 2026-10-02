/* Local, experimental speaker matching. No raw audio is stored or sent by this module. */
(() => {
  'use strict';
  const PROFILE_KEY = 'jarvis-voice-profile-v1';
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  function fftPower(samples) {
    const size = samples.length;
    const real = new Float64Array(size);
    const imag = new Float64Array(size);
    for (let i = 0, j = 0; i < size; i++) {
      if (i < j) { real[i] = samples[j]; real[j] = samples[i]; }
      else if (i === j) real[i] = samples[i];
      let bit = size >> 1;
      while (j & bit) { j ^= bit; bit >>= 1; }
      j ^= bit;
    }
    for (let len = 2; len <= size; len <<= 1) {
      const angle = -2 * Math.PI / len;
      for (let start = 0; start < size; start += len) {
        for (let k = 0; k < len / 2; k++) {
          const cosine = Math.cos(angle * k), sine = Math.sin(angle * k);
          const right = start + k + len / 2, left = start + k;
          const tr = real[right] * cosine - imag[right] * sine;
          const ti = real[right] * sine + imag[right] * cosine;
          real[right] = real[left] - tr; imag[right] = imag[left] - ti;
          real[left] += tr; imag[left] += ti;
        }
      }
    }
    const power = new Float64Array(size / 2 + 1);
    for (let i = 0; i < power.length; i++) power[i] = real[i] * real[i] + imag[i] * imag[i];
    return power;
  }

  function pitchOf(frame, sampleRate) {
    const low = Math.floor(sampleRate / 330), high = Math.min(Math.floor(sampleRate / 80), frame.length - 100);
    let best = 0, bestLag = 0;
    for (let lag = low; lag <= high; lag += 2) {
      let cross = 0, a = 0, b = 0;
      for (let i = 0; i < frame.length - lag; i += 3) {
        const x = frame[i], y = frame[i + lag];
        cross += x * y; a += x * x; b += y * y;
      }
      const score = cross / Math.sqrt(a * b + 1e-10);
      if (score > best) { best = score; bestLag = lag; }
    }
    return best > .55 && bestLag ? sampleRate / bestLag : null;
  }

  function voiceprint(buffer) {
    const sampleRate = buffer.sampleRate;
    const input = buffer.getChannelData(0);
    const frameSize = 2048, hop = 1024, bands = 20, coefficients = 12;
    const mel = (hz) => 2595 * Math.log10(1 + hz / 700);
    const unmel = (value) => 700 * (Math.pow(10, value / 2595) - 1);
    const minMel = mel(120), maxMel = mel(Math.min(4200, sampleRate / 2 - 100));
    const edges = Array.from({length: bands + 2}, (_, i) => Math.round(unmel(minMel + (maxMel - minMel) * i / (bands + 1)) * frameSize / sampleRate));
    const vectors = [], pitches = [];
    for (let offset = 0; offset + frameSize <= input.length; offset += hop) {
      let energy = 0;
      const frame = new Float64Array(frameSize);
      for (let i = 0; i < frameSize; i++) {
        const value = input[offset + i];
        energy += value * value;
        frame[i] = (value - .95 * (i ? input[offset + i - 1] : 0)) * (.54 - .46 * Math.cos(2 * Math.PI * i / (frameSize - 1)));
      }
      if (Math.sqrt(energy / frameSize) < .012) continue;
      const power = fftPower(frame);
      const logs = [];
      for (let band = 0; band < bands; band++) {
        let sum = 0;
        const left = edges[band], center = edges[band + 1], right = edges[band + 2];
        for (let bin = left; bin < center; bin++) sum += power[bin] * (bin - left) / Math.max(1, center - left);
        for (let bin = center; bin < right; bin++) sum += power[bin] * (right - bin) / Math.max(1, right - center);
        logs.push(Math.log(sum + 1e-8));
      }
      vectors.push(Array.from({length: coefficients}, (_, k) => {
        let value = 0;
        for (let j = 0; j < bands; j++) value += logs[j] * Math.cos(Math.PI * (k + 1) * (j + .5) / bands);
        return value / bands;
      }));
      if (vectors.length % 5 === 0) {
        const pitch = pitchOf(input.subarray(offset, offset + frameSize), sampleRate);
        if (pitch) pitches.push(pitch);
      }
    }
    if (vectors.length < 8 || pitches.length < 1) throw new Error('Frase troppo breve per verificare la voce. Di’ «Jarvis» seguito dalla richiesta nella stessa frase.');
    const means = Array.from({length: coefficients}, (_, i) => vectors.reduce((sum, row) => sum + row[i], 0) / vectors.length);
    const deviations = means.map((mean, i) => Math.sqrt(vectors.reduce((sum, row) => sum + (row[i] - mean) ** 2, 0) / vectors.length));
    pitches.sort((a, b) => a - b);
    return [...means, ...deviations, pitches[Math.floor(pitches.length / 2)]];
  }

  function distance(a, b) {
    let sum = 0;
    for (let i = 0; i < 25; i++) {
      const scale = i < 12 ? 1.8 : i < 24 ? .85 : 55;
      sum += ((a[i] - b[i]) / scale) ** 2;
    }
    return Math.sqrt(sum / 25);
  }

  function loadProfile() {
    try {
      const value = JSON.parse(localStorage.getItem(PROFILE_KEY));
      if (value && Number.isFinite(value.threshold) && value.threshold >= .4 && value.threshold <= 1.1 &&
          Array.isArray(value.samples) && value.samples.length === 3 &&
          value.samples.every((sample) => Array.isArray(sample) && sample.length === 25 && sample.every(Number.isFinite))) return value;
    } catch { /* Missing or corrupt profile. */ }
    return null;
  }

  class VoiceGate {
    constructor(callbacks) {
      this.callbacks = callbacks;
      this.profile = loadProfile();
      this.samples = [];
      this.enabled = false;
      this.speaking = false;
      this.recognition = null;
      this.stream = null;
      this.context = null;
      this.captures = [];
      this.recorder = null;
      this.wakeUntil = 0;
      this.restartTimer = null;
      this.startTimer = null;
      this.listening = false;
    }

    get supported() { return Boolean(Recognition && AudioContextClass && navigator.mediaDevices?.getUserMedia && window.MediaRecorder); }
    get hasProfile() { return Boolean(this.profile); }
    get enrollmentCount() { return this.samples.length; }

    async streamAndContext() {
      if (!this.supported) throw new Error('Questo browser non supporta il riconoscimento vocale richiesto. Prova Chrome o Edge.');
      if (!this.stream || !this.stream.active) {
        const request = navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: false}});
        let timer;
        let expired = false;
        try {
          this.stream = await Promise.race([
            request,
            new Promise((_, reject) => {
              timer = setTimeout(() => {
                expired = true;
                reject(new Error('Il browser non risponde alla richiesta del microfono. Controlla se c’è una finestra di autorizzazione aperta e riprova.'));
              }, 15000);
            })
          ]);
        } catch (error) {
          if (expired) {
            request.then((stream) => stream.getTracks().forEach((track) => track.stop())).catch(() => {});
            throw error;
          }
          if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error.name)) throw new Error('Microfono non autorizzato. Consenti l’accesso al microfono nelle impostazioni del browser e riprova.');
          if (error.name === 'NotFoundError') throw new Error('Nessun microfono rilevato. Collegane uno e riprova.');
          if (error.name === 'NotReadableError') throw new Error('Il microfono è occupato o non disponibile. Chiudi altre applicazioni che lo usano e riprova.');
          throw new Error(`Non riesco ad aprire il microfono: ${error.message || error.name}`);
        } finally { clearTimeout(timer); }
      }
      if (!this.context || this.context.state === 'closed') this.context = new AudioContextClass();
      await this.context.resume();
    }

    record(milliseconds) {
      return new Promise((resolve, reject) => {
        const chunks = [];
        const recorder = new MediaRecorder(this.stream);
        this.recorder = recorder;
        const timer = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, milliseconds);
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => { clearTimeout(timer); reject(new Error('Registrazione non riuscita.')); };
        recorder.onstop = () => {
          clearTimeout(timer);
          this.recorder = null;
          if (!chunks.length) return reject(new Error('Non è stato registrato alcun audio.'));
          resolve(new Blob(chunks, {type: recorder.mimeType}));
        };
        recorder.start();
      });
    }

    async printOf(blob) {
      const array = await blob.arrayBuffer();
      const decoded = await this.context.decodeAudioData(array);
      return voiceprint(decoded);
    }

    async enrollSample() {
      if (this.enabled) this.stop();
      await this.streamAndContext();
      try {
        const sample = await this.printOf(await this.record(4200));
        this.samples.push(sample);
        if (this.samples.length === 3) {
          const spreads = [distance(this.samples[0], this.samples[1]), distance(this.samples[0], this.samples[2]), distance(this.samples[1], this.samples[2])];
          const maxSpread = Math.max(...spreads);
          if (maxSpread > 1.2) {
            this.samples = [];
            throw new Error('I tre campioni sono troppo diversi. Riprova nello stesso ambiente e con lo stesso microfono.');
          }
          this.profile = {samples: this.samples, threshold: Math.min(1.05, Math.max(.45, maxSpread * 1.45 + .12))};
          localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile));
          this.samples = [];
          return {complete: true, count: 3};
        }
        return {complete: false, count: this.samples.length};
      } finally {
        this.releaseMic();
      }
    }

    matches(print) {
      if (!this.profile) return false;
      const scores = this.profile.samples.map((sample) => distance(sample, print)).sort((a, b) => a - b);
      return scores[1] <= this.profile.threshold;
    }

    async start() {
      if (!this.profile) throw new Error('Registra prima tre campioni della tua voce.');
      await this.streamAndContext();
      this.enabled = true;
      this.speaking = false;
      this.listening = false;
      this.recognition = new Recognition();
      this.recognition.lang = 'it-IT';
      if ('processLocally' in this.recognition && typeof Recognition.available === 'function') {
        let availabilityTimer;
        try {
          const local = await Promise.race([
            Recognition.available({langs: ['it-IT'], processLocally: true}),
            new Promise((resolve) => { availabilityTimer = setTimeout(() => resolve('unavailable'), 1500); })
          ]);
          if (local === 'available') this.recognition.processLocally = true;
        } catch { /* On-device recognition may be unavailable or disallowed; use the browser default. */ }
        finally { clearTimeout(availabilityTimer); }
      }
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
      this.recognition.onstart = () => {
        if (!this.enabled) return;
        this.listening = true;
        clearTimeout(this.startTimer);
        this.callbacks.onListening(true);
        this.callbacks.onStatus('Ascolto continuo attivo. Di’ «Jarvis» seguito dalla tua richiesta.');
      };
      const beginCapture = () => {
        if (this.speaking || !this.enabled || this.recorder) return;
        try {
          this.captures = [this.record(8500).catch(() => null)];
          this.callbacks.onStatus('Voce rilevata: verifico il parlante…');
        } catch (error) { this.callbacks.onError(`Registrazione vocale non disponibile: ${error.message}`); }
      };
      this.recognition.onsoundstart = beginCapture;
      this.recognition.onspeechstart = beginCapture;
      this.recognition.onspeechend = () => {
        if (this.recorder?.state === 'recording') this.recorder.stop();
      };
      this.recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            this.callbacks.onStatus('Frase riconosciuta: verifico che sia la tua voce…');
            this.checkUtterance(event.results[i][0].transcript);
          }
        }
      };
      this.recognition.onerror = (event) => {
        if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported'].includes(event.error)) {
          this.stop();
          const help = {
            'not-allowed': 'Il browser ha negato il microfono. Consenti l’accesso e riprova.',
            'service-not-allowed': 'Il servizio di riconoscimento non è disponibile in questo browser. Prova Chrome o Edge.',
            'audio-capture': 'Il microfono non è disponibile. Controlla che sia collegato e non occupato.',
            network: 'Il servizio di trascrizione non è raggiungibile da questo browser. Sul Mac avvia «Avvia Jarvis.command»: Jarvis si aprirà in Chrome. Se accade anche lì, controlla la connessione e riprova.',
            'language-not-supported': 'Questo browser non supporta il riconoscimento in italiano.'
          };
          this.callbacks.onError(help[event.error]);
        }
      };
      this.recognition.onend = () => {
        this.listening = false;
        if (this.enabled && !this.speaking) this.restartTimer = setTimeout(() => this.restart(), 400);
      };
      if (!this.restart()) throw new Error('Il riconoscimento vocale non è partito. Premi di nuovo «Avvia ascolto continuo».');
    }

    restart() {
      if (!this.enabled || this.speaking) return false;
      try {
        clearTimeout(this.startTimer);
        this.startTimer = setTimeout(() => {
          if (!this.enabled || this.listening || this.speaking) return;
          this.stop();
          this.callbacks.onError('Il browser non ha avviato l’ascolto. Verifica il permesso del microfono o prova in Chrome o Edge.');
        }, 6000);
        this.recognition.start();
        return true;
      }
      catch (error) {
        clearTimeout(this.startTimer);
        if (error.name === 'InvalidStateError') return true;
        this.stop();
        this.callbacks.onError(`Riconoscimento vocale non disponibile: ${error.message}`);
        return false;
      }
    }

    async checkUtterance(transcript) {
      const audio = this.captures.shift();
      if (!audio) {
        this.callbacks.onStatus('Ho sentito una frase ma non ho acquisito l’audio per verificare la voce. Riprova dicendo «Jarvis» e la richiesta insieme.');
        return;
      }
      try {
        const clip = await audio;
        if (!clip) throw new Error('L’audio della frase non è stato acquisito.');
        const print = await this.printOf(clip);
        if (!this.enabled) return;
        if (!this.matches(print)) {
          this.callbacks.onStatus('Voce non riconosciuta. Nessuna risposta inviata.');
          return;
        }
        const text = transcript.trim();
        const hasWake = /\bjarvis\b/i.test(text);
        if (hasWake) this.wakeUntil = Date.now() + 8000;
        if (!hasWake && Date.now() > this.wakeUntil) {
          this.callbacks.onStatus('Ho riconosciuto la voce, ma non la parola «Jarvis». Di’ «Jarvis» seguito dalla richiesta.');
          return;
        }
        const command = text.replace(/^\s*(?:ehi|hey|ok)?\s*jarvis[,.:!?\s]*/i, '').trim();
        if (!command) {
          this.callbacks.onStatus('Ti ascolto. Dimmi la tua richiesta.');
          if (this.callbacks.onWake) this.callbacks.onWake();
          return;
        }
        this.wakeUntil = 0;
        this.callbacks.onVerified(command);
      } catch (error) { this.callbacks.onStatus(`Non ho verificato questa frase: ${error.message}`); }
    }

    pauseForSpeech() {
      if (!this.enabled) return;
      this.speaking = true;
      clearTimeout(this.restartTimer);
      clearTimeout(this.startTimer);
      try { this.recognition.abort(); } catch { /* Recognition may already be stopped. */ }
    }

    resumeAfterSpeech() {
      if (!this.enabled) return;
      this.speaking = false;
      this.restartTimer = setTimeout(() => this.restart(), 400);
    }

    releaseMic() {
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = null;
      this.context?.close();
      this.context = null;
    }

    stop() {
      this.enabled = false;
      this.speaking = false;
      this.listening = false;
      clearTimeout(this.restartTimer);
      clearTimeout(this.startTimer);
      try { this.recognition?.abort(); } catch { /* Already disconnected. */ }
      if (this.recorder?.state === 'recording') this.recorder.stop();
      this.captures = [];
      this.releaseMic();
      this.callbacks.onListening(false);
    }

    forget() {
      this.stop();
      localStorage.removeItem(PROFILE_KEY);
      this.profile = null;
      this.samples = [];
    }
  }

  window.JarvisVoiceGate = VoiceGate;
})();
