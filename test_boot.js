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

test('le battute seguono il video con i numeri reali', () => {
  const lines = boot.buildLines(status(), 'Signore');
  assert.deepEqual(lines.map((line) => line.text), [
    'Buongiorno, signore.',
    '534 neuroni online.',
    '39 sistemi attivi, 5 agenti pronti.',
    'Nessun guasto rilevato.',
    'È tutto sotto controllo.'
  ]);
  assert.deepEqual(lines[1].log, ['> carico memoria 122 file', '> carico metodi 37', '> collego neuroni 534']);
  assert.deepEqual(lines[2].counters, {connections: 1461, systems: 39, agents: 5});
  assert.equal(lines[0].scene.reveal, .01);
  assert.equal(lines[1].scene.reveal, 1);
});

test('un guasto riparato produce la battuta del video e il nodo rosso che diventa verde', () => {
  const faults = [{name: 'cache-vocale', label: 'CACHE VOCALE', ok: true, repaired: true}];
  const lines = boot.buildLines(status({faults}), 'Signor Kevin');
  assert.equal(lines[0].text, 'Buongiorno, Signor Kevin.');
  assert.equal(lines[3].text, 'Stamattina ho già riparato quello che si era rotto.');
  assert.deepEqual(lines[3].fault, {cluster: 'voce', label: 'CACHE VOCALE', from: 'fermo', to: 'riparato'});
  assert.deepEqual(lines[3].log, ['> controllo guasti 1 trovato', '> riparato']);
});

test('un guasto non riparabile resta rosso e chiede l’intervento', () => {
  const faults = [{name: 'database', label: 'ARCHIVIO SQLITE', ok: false, repaired: false}];
  const lines = boot.buildLines(status({faults, systems_active: 1, agents_ready: 1}), 'Signore');
  assert.equal(lines[2].text, '1 sistema attivo, 1 agente pronto.');
  assert.match(lines[3].text, /^Ho trovato un problema a archivio sqlite\./);
  assert.equal(lines[3].fault.to, 'fermo');
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
