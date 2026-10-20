import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTabsForCollapse } from '../extension/src/collapse-filter.js';

test('Collapse Filter: skips pinned tabs and non-http(s) pages', () => {
  const tabs = [
    { id: 1, title: 'Google', url: 'https://google.com', pinned: false },
    { id: 2, title: 'Pinned Dashboard', url: 'https://app.work.com', pinned: true },
    { id: 3, title: 'Extensions', url: 'chrome://extensions', pinned: false },
    { id: 4, title: 'Local File', url: 'file:///home/user/doc.txt', pinned: false },
    { id: 5, title: 'About Blank', url: 'about:blank', pinned: false },
    { id: 6, title: 'Insecure HTTP Blog', url: 'http://insecure-blog.org', pinned: false },
    { id: 7, title: 'Tab Vault Dashboard', url: 'chrome-extension://fakeid/tab-vault.html', pinned: false }
  ];

  const filtered = filterTabsForCollapse(tabs, 'chrome-extension://fakeid/tab-vault.html');

  assert.equal(filtered.length, 2, 'Must retain only non-pinned http and https tabs');
  assert.equal(filtered[0].id, 1);
  assert.equal(filtered[1].id, 6);
});

test('Collapse Filter: respects allowIncognito parameter', () => {
  const tabs = [
    { id: 101, title: 'Normal Page', url: 'https://news.com', incognito: false },
    { id: 102, title: 'Private Page', url: 'https://secret.com', incognito: true }
  ];

  // Default: allowIncognito = false
  const defaultFiltered = filterTabsForCollapse(tabs, '');
  assert.equal(defaultFiltered.length, 1);
  assert.equal(defaultFiltered[0].id, 101);

  // allowIncognito = true
  const incognitoAllowed = filterTabsForCollapse(tabs, '', true);
  assert.equal(incognitoAllowed.length, 2);
  assert.equal(incognitoAllowed[1].id, 102);
});

