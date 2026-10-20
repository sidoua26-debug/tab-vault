import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../extension/src/settings.js';

class MockStorageArea {
  constructor(initial = {}) {
    this.store = { ...initial };
  }
  async get(keys) {
    const res = {};
    for (const k of keys) {
      if (k in this.store) {
        res[k] = this.store[k];
      }
    }
    return res;
  }
  async set(items) {
    Object.assign(this.store, items);
  }
}

test('Settings: returns defaults when storage is empty', async () => {
  const mock = new MockStorageArea();
  const settings = await getSettings(mock);
  assert.equal(settings.restoreWindowTarget, 'current');
  assert.equal(settings.restoreRetentionPolicy, 'remove');
  assert.equal(settings.openOnStartup, false);
  assert.equal(settings.deduplicateOnCapture, true);
  assert.equal(settings.lazyRestore, true);
  assert.equal(settings.captureIncognito, false);
  assert.equal(settings.theme, 'light');
});

test('Settings: saves and retrieves partial settings cleanly', async () => {
  const mock = new MockStorageArea();
  await saveSettings(mock, {
    restoreWindowTarget: 'new',
    restoreRetentionPolicy: 'keep',
    openOnStartup: true,
    theme: 'dark'
  });

  const updated = await getSettings(mock);
  assert.equal(updated.restoreWindowTarget, 'new');
  assert.equal(updated.restoreRetentionPolicy, 'keep');
  assert.equal(updated.openOnStartup, true);
  assert.equal(updated.theme, 'dark');
  assert.equal(updated.deduplicateOnCapture, true); // default preserved
});

test('Settings: migrateThemeSettings reads legacy localStorage and updates vault_settings', async () => {
  const mock = new MockStorageArea();
  // Simulate global localStorage
  globalThis.localStorage = {
    _data: { tab_vault_theme: 'dark' },
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = v; }
  };

  const { migrateThemeSettings } = await import('../extension/src/settings.js');
  const theme = await migrateThemeSettings(mock);
  assert.equal(theme, 'dark');

  const settings = await getSettings(mock);
  assert.equal(settings.theme, 'dark');
  assert.equal(settings.themeSetExplicitly, true);

  delete globalThis.localStorage;
});

test('Settings: migrateThemeSettings preserves explicit theme in vault_settings even if localStorage differs', async () => {
  const mock = new MockStorageArea();
  await saveSettings(mock, {
    theme: 'light',
    themeSetExplicitly: true
  });

  globalThis.localStorage = {
    _data: { tab_vault_theme: 'dark' },
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = v; }
  };

  const { migrateThemeSettings } = await import('../extension/src/settings.js');
  const theme = await migrateThemeSettings(mock);
  assert.equal(theme, 'light');

  const settings = await getSettings(mock);
  assert.equal(settings.theme, 'light');

  delete globalThis.localStorage;
});
