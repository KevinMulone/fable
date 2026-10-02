/* Wake-up sequence: the lines Jarvis says, the music under them and the staging on screen.
   Numbers come from the real brain status; the music file is provided locally by the user. */
(() => {
  'use strict';
  const MUSIC_START_SECONDS = 7;   // Where the reference video enters the track; adjust by ear.
  const MUSIC_VOLUME = .55;
  const DUCK_VOLUME = .16;         // Music level while Jarvis speaks.
  const MAX_LINE_MS = 12000;
  const MIN = {neurons: 120, systems: 8, agents: 3};
  const CLUSTER_OF = {database: 'archivio', dati: 'archivio', memoria: 'memoria', ricerca: 'memoria', metodi: 'memoria', 'chat-locale': 'agenti', 'chat-ai': 'agenti', 'voce-naturale': 'voce', 'cache-vocale': 'voce', musica: 'voce', server: 'sistemi', privacy: 'privacy', portabilita: 'portabilita', 'cervello-3d': 'sistemi', riconoscimento: 'voce', identita: 'identita', ascolto: 'voce'};

  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  const spokenAddress = (address) => address === 'Signore' ? 'signore' : address;

  function buildLines(status, address) {
    const who = spokenAddress(address);
    const faults = status.faults || [];
    const repaired = faults.filter((item) => item.repaired);
    const broken = faults.filter((item) => !item.ok);
    const lines = [
      {id: 'greeting', text: `Buongiorno, ${who}.`, scene: {reveal: .01, zoom: 1.7, labels: 0}, log: ['> avvio cervello']},
      {id: 'neurons', text: `${status.neurons} neuroni online.`, scene: {reveal: 1, zoom: 1, labels: 0}, counters: {neurons: status.neurons},
        log: [`> carico memoria ${status.memory_files} file`, `> carico metodi ${status.methods}`, `> collego neuroni ${status.neurons}`]},
      {id: 'systems', text: `${plural(status.systems_active, 'sistema attivo', 'sistemi attivi')}, ${plural(status.agents_ready, 'agente pronto', 'agenti pronti')}.`,
        scene: {labels: 1}, counters: {connections: status.connections, systems: status.systems_active, agents: status.agents_ready},
        log: [`> servizi in linea ${status.systems_active}`, `> agenti ${status.agents_ready} pronti`]}
    ];
    if (repaired.length) {
      const first = repaired[0];
      lines.push({id: 'faults', text: 'Stamattina ho già riparato quello che si era rotto.',
        fault: {cluster: CLUSTER_OF[first.name] || 'sistemi', label: first.label, from: 'fermo', to: 'riparato'},
        log: [`> controllo guasti ${plural(faults.length, 'trovato', 'trovati')}`, '> riparato']});
    } else if (broken.length) {
      const first = broken[0];
      lines.push({id: 'faults', text: `Ho trovato un problema a ${first.label.toLowerCase()}. Serve il tuo intervento, ${who}.`,
        fault: {cluster: CLUSTER_OF[first.name] || 'sistemi', label: first.label, from: 'fermo', to: 'fermo'},
        log: [`> controllo guasti ${plural(broken.length, 'trovato', 'trovati')}`, '> intervento richiesto']});
    } else {
      lines.push({id: 'faults', text: 'Nessun guasto rilevato.', log: ['> controllo guasti 0 trovati']});
    }
    lines.push({id: 'done', text: 'È tutto sotto controllo.', log: ['> tutto sotto controllo']});
    return lines;
  }

  // Browser-side systems are only known in the page; merge them before counting.
  function mergeBrowserSystems(status, browser) {
    const systems = [...(status.systems || []),
      {name: 'riconoscimento', label: 'RICONOSCIMENTO VOCALE', ok: Boolean(browser.supported), repaired: false, optional: true, detail: browser.supported ? 'Disponibile nel browser.' : 'Non supportato da questo browser.'},
      {name: 'identita', label: 'IDENTITÀ VOCALE', ok: Boolean(browser.hasProfile), repaired: false, optional: true, detail: browser.hasProfile ? 'Profilo registrato.' : 'Profilo da registrare.'},
      {name: 'ascolto', label: 'ASCOLTO CONTINUO', ok: Boolean(browser.listening), repaired: false, optional: true, detail: browser.listening ? 'Attivo.' : 'Fermo.'}
    ];
    const active = systems.filter((item) => item.ok).length;
    return {...status, systems, systems_active: Math.max(MIN.systems, active),
      faults: systems.filter((item) => item.repaired || (!item.ok && !item.optional))};
  }

  // Status for the file:// mode, where there is no server: counts come from the browser store.
  function localStatus(counts) {
    const systems = [
      {name: 'archivio-browser', label: 'ARCHIVIO BROWSER', ok: true, repaired: false, detail: 'IndexedDB attivo.'},
      {name: 'chat-locale', label: 'CHAT LOCALE', ok: true, repaired: false, detail: 'Risposte locali attive.'},
      {name: 'ricerca', label: 'RICERCA MEMORIA', ok: true, repaired: false, detail: 'Ricerca per parole.'},
      {name: 'cervello-3d', label: 'CERVELLO 3D', ok: true, repaired: false, detail: 'Rete neurale tridimensionale.'}
    ];
    const neurons = Math.max(MIN.neurons, counts.messages + systems.length + 10);
    return {neurons, connections: Math.round(neurons * 2.7), systems, systems_active: Math.max(MIN.systems, systems.length),
      agents: [], agents_ready: MIN.agents, faults: [], memory_files: counts.messages, methods: 10, music: false};
  }

  class Music {
    constructor(url) {
      this.url = url;
      this.context = null;
      this.buffer = null;
      this.gain = null;
      this.source = null;
      this.loading = null;
    }

    get unlocked() { return Boolean(this.context && this.context.state === 'running'); }

    // Must be called from a user gesture at least once: browsers only start audio after one.
    unlock() {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return Promise.resolve(false);
      if (!this.context) this.context = new Context();
      return this.context.resume().then(() => this.unlocked, () => false);
    }

    load() {
      if (!this.loading) {
        this.loading = fetch(this.url).then((response) => {
          if (!response.ok) throw new Error('Brano di avvio non disponibile.');
          return response.arrayBuffer();
        }).then((data) => {
          if (!this.context) throw new Error('Audio non sbloccato.');
          return this.context.decodeAudioData(data);
        }).then((buffer) => { this.buffer = buffer; return buffer; }).catch((error) => { this.loading = null; throw error; });
      }
      return this.loading;
    }

    play(startAt = MUSIC_START_SECONDS) {
      if (!this.buffer || !this.unlocked) return false;
      this.stop(0);
      this.gain = this.context.createGain();
      this.gain.gain.setValueAtTime(0, this.context.currentTime);
      this.gain.gain.linearRampToValueAtTime(MUSIC_VOLUME, this.context.currentTime + .8);
      this.gain.connect(this.context.destination);
      this.source = this.context.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.connect(this.gain);
      this.source.start(0, Math.min(startAt, Math.max(0, this.buffer.duration - 1)));
      return true;
    }

    duck(on) {
      if (!this.gain) return;
      const now = this.context.currentTime;
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setValueAtTime(this.gain.gain.value, now);
      this.gain.gain.linearRampToValueAtTime(on ? DUCK_VOLUME : MUSIC_VOLUME, now + (on ? .25 : .6));
    }

    stop(fadeSeconds = 3) {
      if (!this.source) return;
      const source = this.source, gain = this.gain, now = this.context.currentTime;
      this.source = null; this.gain = null;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + Math.max(.01, fadeSeconds));
      try { source.stop(now + Math.max(.02, fadeSeconds) + .05); } catch { /* Already stopped. */ }
    }
  }

  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  class Sequence {
    constructor(options) {
      this.overlay = options.overlay;
      this.neural = options.neural;
      this.music = options.music;
      this.say = options.say;
      this.elements = options.elements;
      this.running = false;
      this.cancelled = false;
    }

    setCounter(name, value) {
      const node = this.elements[name];
      if (!node) return;
      const start = Number(node.dataset.value || 0), end = Number(value), began = performance.now();
      node.dataset.value = String(end);
      const step = (now) => {
        const progress = Math.min(1, (now - began) / 1100);
        node.textContent = Math.round(start + (end - start) * (1 - Math.pow(1 - progress, 3))).toLocaleString('it-IT');
        if (progress < 1 && !this.cancelled) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    async appendLog(lines) {
      for (const line of lines) {
        if (this.cancelled) return;
        this.elements.log.textContent += `${line}\n`;
        await wait(170);
      }
    }

    async run(lines) {
      if (this.running) return false;
      this.running = true;
      this.cancelled = false;
      this.elements.log.textContent = '';
      this.elements.caption.textContent = '';
      for (const name of ['neurons', 'connections', 'systems', 'agents']) {
        if (this.elements[name]) { this.elements[name].textContent = '0'; this.elements[name].dataset.value = '0'; }
      }
      this.neural.setFault(null);
      this.neural.setScene({reveal: 0, zoom: 1.7, labels: 0}, true);
      this.overlay.hidden = false;
      this.overlay.classList.remove('leaving');
      this.neural.resize();
      this.music.play();
      try {
        for (const line of lines) {
          if (this.cancelled) break;
          if (line.scene) this.neural.setScene(line.scene);
          if (line.fault) this.neural.setFault({cluster: line.fault.cluster, label: line.fault.label, state: line.fault.from});
          if (line.counters) for (const [name, value] of Object.entries(line.counters)) this.setCounter(name, value);
          this.elements.caption.textContent = line.text;
          const logging = this.appendLog(line.log || []);
          this.music.duck(true);
          // A device voice that never reports its end must not freeze the sequence.
          await Promise.race([this.say(line.text), wait(MAX_LINE_MS)]);
          this.music.duck(false);
          await logging;
          if (line.fault && line.fault.to !== line.fault.from) {
            await wait(250);
            this.neural.setFault({cluster: line.fault.cluster, label: line.fault.label, state: line.fault.to});
          }
          await wait(380);
        }
        if (!this.cancelled) await wait(1400);
      } finally {
        this.music.stop(this.cancelled ? .4 : 3);
        this.overlay.classList.add('leaving');
        await wait(this.cancelled ? 200 : 900);
        this.overlay.hidden = true;
        this.overlay.classList.remove('leaving');
        this.running = false;
      }
      return !this.cancelled;
    }

    cancel() { if (this.running) this.cancelled = true; }
  }

  const today = () => new Date().toISOString().slice(0, 10);
  const api = {buildLines, mergeBrowserSystems, localStatus, Music, Sequence, today, MUSIC_START_SECONDS, MIN};
  if (typeof window !== 'undefined') window.JarvisBoot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
