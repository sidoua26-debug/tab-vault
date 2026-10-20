/**
 * Test helpers and mocks for Chrome Storage & Downloads APIs
 */

export class MockStorageArea {
  constructor(initialData = {}) {
    this._store = { ...initialData };
  }

  async get(keys) {
    if (!keys) return { ...this._store };
    const result = {};
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      if (k in this._store) {
        // Deep copy to simulate storage isolation
        result[k] = JSON.parse(JSON.stringify(this._store[k]));
      }
    }
    return result;
  }

  async set(items) {
    for (const [k, v] of Object.entries(items)) {
      this._store[k] = JSON.parse(JSON.stringify(v));
    }
  }

  async remove(keys) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      delete this._store[k];
    }
  }

  async clear() {
    this._store = {};
  }

  rawDump() {
    return { ...this._store };
  }
}

export class MockDownloadsApi {
  constructor() {
    this.downloads = [];
  }

  async download(options) {
    const item = {
      id: this.downloads.length + 1,
      url: options.url,
      filename: options.filename,
      conflictAction: options.conflictAction,
      saveAs: options.saveAs,
      state: 'complete',
      exists: true,
      fileSize: options.url.startsWith('data:') ? options.url.length : 1024,
      endTime: new Date().toISOString()
    };
    this.downloads.push(item);
    return item.id;
  }

  async search(query) {
    return this.downloads.filter(item => {
      if (query.query) {
        const matches = query.query.some(q => item.filename.includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }
}
