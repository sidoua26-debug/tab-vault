import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  exportToPlainText,
  parsePlainTextImport,
  deduplicateTabs,
  formatGroupUrlsForClipboard
} from '../extension/src/import-export.js';

test('Import/Export: exportToPlainText formats URLs and titles separated by double newline', () => {
  const groups = [
    {
      id: 'g1',
      title: 'Group 1',
      tabs: [
        { url: 'https://example.com/a', title: 'Example A' },
        { url: 'https://example.com/b', title: 'https://example.com/b' }
      ]
    },
    {
      id: 'g2',
      title: 'Group 2',
      tabs: [
        { url: 'https://wikipedia.org', title: 'Wikipedia' }
      ]
    }
  ];

  const plainText = exportToPlainText(groups);
  const expected = 'https://example.com/a | Example A\nhttps://example.com/b\n\nhttps://wikipedia.org | Wikipedia';
  assert.equal(plainText, expected);
});

test('Import/Export: parsePlainTextImport parses OneTab text with url | title and bare URLs', () => {
  const text = `
    https://github.com/torvalds/linux | Linux Kernel
    https://kernel.org

    https://developer.chrome.com | Chrome Dev
  `;

  const parsed = parsePlainTextImport(text);
  assert.equal(parsed.length, 2);

  // Group 1
  assert.equal(parsed[0].tabs.length, 2);
  assert.equal(parsed[0].tabs[0].url, 'https://github.com/torvalds/linux');
  assert.equal(parsed[0].tabs[0].title, 'Linux Kernel');
  assert.equal(parsed[0].tabs[1].url, 'https://kernel.org');
  assert.equal(parsed[0].tabs[1].title, 'https://kernel.org');

  // Group 2
  assert.equal(parsed[1].tabs.length, 1);
  assert.equal(parsed[1].tabs[0].url, 'https://developer.chrome.com');
  assert.equal(parsed[1].tabs[0].title, 'Chrome Dev');
});

test('Import/Export: deduplicateTabs drops duplicate URLs while preserving order', () => {
  const tabs = [
    { id: '1', url: 'https://example.com/docs' },
    { id: '2', url: 'https://example.com/docs/' }, // trailing slash normalized
    { id: '3', url: 'https://example.com/blog' },
    { id: '4', url: 'https://example.com/docs' }
  ];

  const deduped = deduplicateTabs(tabs);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].id, '1');
  assert.equal(deduped[1].id, '3');
});

test('Import/Export: formatGroupUrlsForClipboard formats list of raw URLs', () => {
  const group = {
    tabs: [
      { url: 'https://foo.com' },
      { url: 'https://bar.com' }
    ]
  };

  const clip = formatGroupUrlsForClipboard(group);
  assert.equal(clip, 'https://foo.com\nhttps://bar.com');
});
