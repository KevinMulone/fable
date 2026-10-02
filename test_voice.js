const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {test} = require('node:test');

const sandbox = {
  window: {
    SpeechRecognition: class {start() {} abort() {}}, AudioContext: class {}, MediaRecorder: class {}
  },
  navigator: {mediaDevices: {getUserMedia() {}}},
  localStorage: {getItem() { return null; }},
  Float64Array, Math, Number, Array, JSON, Date, Error, Blob,
  setTimeout, clearTimeout
};
vm.runInNewContext(fs.readFileSync(`${__dirname}/voice.js`, 'utf8'), sandbox);
const VoiceGate = sandbox.window.JarvisVoiceGate;

test('una frase breve ma chiara produce un’impronta vocale', async () => {
  const rate = 16000;
  const input = new Float32Array(rate * 0.8);
  for (let i = 0; i < input.length; i++) {
    const time = i / rate;
    input[i] = 0.16 * Math.sin(2 * Math.PI * 180 * time) + 0.07 * Math.sin(2 * Math.PI * 360 * time);
  }
  const gate = new VoiceGate({});
  gate.context = {decodeAudioData: async () => ({sampleRate: rate, getChannelData: () => input})};
  const print = await gate.printOf({arrayBuffer: async () => new ArrayBuffer(0)});
  assert.equal(print.length, 25);
  assert.ok(print.every(Number.isFinite));
});

test('solo la frase verificata con Jarvis esegue il comando', async () => {
  const commands = [];
  const statuses = [];
  const gate = new VoiceGate({onVerified: (text) => commands.push(text), onStatus: (text) => statuses.push(text)});
  gate.enabled = true;
  gate.printOf = async () => Array(25).fill(0);
  gate.matches = () => false;
  gate.captures.push(Promise.resolve({}));
  await gate.checkUtterance('Jarvis che ore sono');
  assert.equal(commands.length, 0);
  gate.matches = () => true;
  gate.captures.push(Promise.resolve({}));
  await gate.checkUtterance('Jarvis che ore sono');
  assert.equal(commands[0], 'che ore sono');
  assert.ok(statuses.some((text) => text.includes('Voce non riconosciuta')));
});

test('«Jarvis» da solo attiva il risveglio senza inviare comandi', async () => {
  const commands = [];
  let wakes = 0;
  const gate = new VoiceGate({onVerified: (text) => commands.push(text), onStatus() {}, onWake: () => wakes++});
  gate.enabled = true;
  gate.printOf = async () => Array(25).fill(0);
  gate.matches = () => true;
  gate.captures.push(Promise.resolve({}));
  await gate.checkUtterance('Jarvis');
  assert.equal(wakes, 1);
  assert.equal(commands.length, 0);
  gate.captures.push(Promise.resolve({}));
  await gate.checkUtterance('riavvia il sistema');
  assert.equal(wakes, 1);
  assert.deepEqual(commands, ['riavvia il sistema']);
});

test('l’ascolto risulta attivo solo dopo la conferma del browser', async () => {
  const states = [];
  const statuses = [];
  const gate = new VoiceGate({onListening: (value) => states.push(value), onStatus: (text) => statuses.push(text)});
  gate.profile = {samples: [], threshold: 0.5};
  gate.streamAndContext = async () => {};
  await gate.start();
  assert.equal(gate.listening, false);
  assert.deepEqual(states, []);
  gate.recognition.onstart();
  assert.equal(gate.listening, true);
  assert.deepEqual(states, [true]);
  assert.ok(statuses.some((text) => text.includes('Ascolto continuo attivo')));
  gate.stop();
});

test('usa il riconoscimento sul dispositivo solo se l’italiano è disponibile', async () => {
  const Recognition = sandbox.window.SpeechRecognition;
  Recognition.prototype.processLocally = false;
  Recognition.available = async () => 'available';
  const gate = new VoiceGate({onListening() {}, onStatus() {}});
  gate.profile = {samples: [], threshold: 0.5};
  gate.streamAndContext = async () => {};
  await gate.start();
  assert.equal(gate.recognition.processLocally, true);
  gate.stop();
  delete Recognition.prototype.processLocally;
  delete Recognition.available;
});
