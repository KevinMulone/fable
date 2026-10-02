/* Automatic conversation archive for direct-file mode. */
(() => {
  'use strict';
  let opening;
  function open() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('Archivio del browser non disponibile. Avvia Jarvis dal programma nella cartella.'));
      const request = indexedDB.open('jarvis-conversations-v1', 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('messages', {keyPath: 'id', autoIncrement: true});
        store.createIndex('role', 'role');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Non posso aprire l’archivio del browser. Avvia Jarvis dal programma nella cartella.'));
      request.onblocked = () => reject(new Error('Archivio occupato in un’altra scheda. Chiudi le altre schede Jarvis e riprova.'));
    });
    return opening;
  }

  async function append(role, text) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      tx.objectStore('messages').add({role, text, created_at: new Date().toISOString()});
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('Salvataggio della conversazione non riuscito.'));
      tx.onabort = () => reject(new Error('Salvataggio della conversazione interrotto.'));
    });
  }

  async function recent(limit = 30, role = null) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const values = [];
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const source = role ? store.index('role') : store;
      const range = role ? IDBKeyRange.only(role) : null;
      source.openCursor(range, 'prev').onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && values.length < limit) {
          values.push(cursor.value);
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve(values.reverse());
      tx.onerror = () => reject(new Error('Lettura della memoria non riuscita.'));
    });
  }

  async function count(role = null) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readonly');
      let number = 0;
      const request = role ? tx.objectStore('messages').index('role').count(IDBKeyRange.only(role)) : tx.objectStore('messages').count();
      request.onsuccess = () => { number = request.result; };
      tx.oncomplete = () => resolve(number);
      tx.onerror = () => reject(new Error('Conteggio della memoria non riuscito.'));
    });
  }

  async function search(query, limit = 8) {
    const db = await open();
    const needle = query.toLocaleLowerCase('it').trim();
    return new Promise((resolve, reject) => {
      const found = [];
      const tx = db.transaction('messages', 'readonly');
      tx.objectStore('messages').openCursor(null, 'prev').onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && found.length < limit) {
          if (cursor.value.role === 'user' && cursor.value.text.toLocaleLowerCase('it').includes(needle)) found.push(cursor.value);
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve(found);
      tx.onerror = () => reject(new Error('Ricerca nella memoria non riuscita.'));
    });
  }

  async function migrateLegacy() {
    if (await count()) return;
    let old;
    try { old = JSON.parse(localStorage.getItem('jarvis-v0.2') || '{}'); } catch { return; }
    const records = [];
    for (const memory of old.memories || []) if (typeof memory.text === 'string') records.push({role: 'user', text: memory.text, created_at: memory.created_at || new Date().toISOString()});
    for (const message of old.messages || []) {
      if (['user', 'assistant'].includes(message.role) && typeof message.text === 'string') records.push({role: message.role, text: message.text, created_at: message.created_at || new Date().toISOString()});
    }
    if (!records.length) return;
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      for (const record of records) store.add(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('Importazione delle vecchie conversazioni non riuscita.'));
      tx.onabort = () => reject(new Error('Importazione delle vecchie conversazioni interrotta.'));
    });
  }

  window.JarvisBrowserStore = {append, recent, count, search, migrateLegacy};
})();
