const assert = require('node:assert/strict');
const fs = require('node:fs');
const {test} = require('node:test');

// Same realm as the test, so deepEqual compares plain values rather than foreign prototypes.
const scope = {exports: {}};
new Function('module', fs.readFileSync(`${__dirname}/boot.js`, 'utf8'))(scope);
const boot = scope.exports;

const status = (overrides = {}) => ({
  neurons: 534, connections: 1461, systems_active: 39, agents_ready: 5, memory_files: 122, methods: 37, faults: [],
  systems: [{name: 'database', label: 'ARCHIVIO SQLITE', ok: true, repaired: false}], ...overrides
});

const morning = new Date(2026, 9, 2, 9, 23);
const texts = (lines) => lines.map((line) => line.text);

test('le battute seguono il video con i numeri reali, l’ora e il meteo', () => {
  const weather = {place: 'Milano', temperature: 18, description: 'cielo sereno', day_description: 'cielo sereno', rain_expected: false, rain_probability: 5, max: 24, min: 12, nice_day: true};
  const lines = boot.buildLines(status(), 'Signore', {now: morning, weather});
  assert.deepEqual(texts(lines), [
    'Buongiorno, signore.',
    'Sono le 9 e 23. La mattinata è ancora salvabile, con un minimo di impegno.',
    '534 neuroni online. Tutti svegli, a differenza di qualcuno.',
    '39 sistemi attivi, 5 agenti pronti. Nessuno si lamenta.',
    'Nessun guasto rilevato. Quasi deludente.',
    'Fuori a Milano ci sono 18 gradi, cielo sereno. Si prevede una bella giornata, massima di 24 gradi: la invito ad approfittarne. Sarebbe una novità.',
    'È tutto sotto controllo, signore. Come sempre.'
  ]);
  assert.deepEqual(lines[2].log, ['> carico memoria 122 file', '> carico metodi 37', '> collego neuroni 534']);
  assert.deepEqual(lines[3].counters, {connections: 1461, systems: 39, agents: 5});
  assert.equal(lines[0].scene.reveal, .01);
  assert.equal(lines[2].scene.reveal, 1);
  assert.deepEqual(lines[5].log, ['> meteo 18°, bella giornata']);
});

test('il saluto segue la fascia oraria', () => {
  assert.equal(boot.greeting(6), 'Buongiorno');
  assert.equal(boot.greeting(12), 'Buongiorno');
  assert.equal(boot.greeting(15), 'Buon pomeriggio');
  assert.equal(boot.greeting(20), 'Buonasera');
  assert.equal(boot.greeting(2), 'Buonanotte');
  const night = boot.buildLines(status(), 'Signore', {now: new Date(2026, 9, 2, 1, 0)});
  assert.equal(night[0].text, 'Buonanotte, signore. O buongiorno, dipende dai punti di vista.');
  assert.equal(night[1].text, 'Sono le 1 in punto. Un orario in cui persino io preferirei essere spento.');
  const evening = boot.buildLines(status(), 'Signor Kevin', {now: new Date(2026, 9, 2, 19, 5)});
  assert.equal(evening[0].text, 'Buonasera, Signor Kevin.');
});

test('la battuta del meteo distingue pioggia, bella giornata, giornata discreta e meteo assente', () => {
  const base = {place: '', temperature: -2, description: 'coperto', day_description: 'pioggia', rain_expected: true, rain_probability: 80, max: 3, min: -4, nice_day: false};
  assert.equal(boot.weatherLine(base), 'Fuori ci sono meno 2 gradi, coperto. È prevista pioggia, probabilità 80 per cento: prenda l’ombrello, o fingerò sorpresa quando tornerà bagnato.');
  assert.match(boot.weatherLine({...base, temperature: 1, rain_expected: false, day_description: 'coperto'}), /^Fuori ci sono 1 grado, coperto\. Niente pioggia prevista/);
  assert.match(boot.weatherLine(null), /^Il meteo non risponde/);
  const lines = boot.buildLines(status(), 'Signore', {now: morning});
  assert.match(lines[5].text, /^Il meteo non risponde/);
  assert.deepEqual(lines[5].log, ['> meteo non disponibile']);
});

test('un guasto riparato produce la battuta e il nodo rosso che diventa verde', () => {
  const faults = [{name: 'cache-vocale', label: 'CACHE VOCALE', ok: true, repaired: true}];
  const lines = boot.buildLines(status({faults}), 'Signor Kevin', {now: morning});
  assert.equal(lines[0].text, 'Buongiorno, Signor Kevin.');
  assert.equal(lines[4].text, 'Ho già riparato quello che si era rotto. Non c’è di che.');
  assert.deepEqual(lines[4].fault, {cluster: 'voce', label: 'CACHE VOCALE', from: 'fermo', to: 'riparato'});
  assert.deepEqual(lines[4].log, ['> controllo guasti 1 trovato', '> riparato']);
});

test('un guasto non riparabile resta rosso e chiede l’intervento', () => {
  const faults = [{name: 'database', label: 'ARCHIVIO SQLITE', ok: false, repaired: false}];
  const lines = boot.buildLines(status({faults, systems_active: 1, agents_ready: 1}), 'Signore', {now: morning});
  assert.equal(lines[3].text, '1 sistema attivo, 1 agente pronto. Nessuno si lamenta.');
  assert.match(lines[4].text, /^Ho trovato un problema a archivio sqlite\. Serve il suo intervento, signore\./);
  assert.equal(lines[4].fault.to, 'fermo');
});

test('i sistemi del browser si aggiungono al conteggio con il minimo garantito', () => {
  const merged = boot.mergeBrowserSystems(status({systems_active: 1}), {supported: true, hasProfile: false, listening: false});
  assert.equal(merged.systems.length, 4);
  assert.equal(merged.systems_active, boot.MIN.systems);
  assert.deepEqual(merged.faults, []);
  const repaired = boot.mergeBrowserSystems(status({systems: [{name: 'database', label: 'ARCHIVIO SQLITE', ok: true, repaired: true}]}), {});
  assert.equal(repaired.faults.length, 1);
});

test('senza server lo stato locale rispetta i minimi', () => {
  const local = boot.localStatus({messages: 3});
  assert.equal(local.neurons, boot.MIN.neurons);
  assert.equal(local.systems_active, boot.MIN.systems);
  assert.equal(local.agents_ready, boot.MIN.agents);
  assert.equal(local.connections, Math.round(boot.MIN.neurons * 2.7));
});
