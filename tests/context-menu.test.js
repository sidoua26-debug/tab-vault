import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTEXT_MENU_ITEMS, handleContextMenuClick } from '../extension/src/context-menu.js';

test('Context Menu: registers comprehensive menu actions', () => {
  const itemIds = CONTEXT_MENU_ITEMS.map(i => i.id);
  assert.ok(itemIds.includes('stash_current_tab'));
  assert.ok(itemIds.includes('stash_current_window'));
  assert.ok(itemIds.includes('stash_tabs_right'));
  assert.ok(itemIds.includes('stash_tabs_left'));
  assert.ok(itemIds.includes('stash_all_windows'));
  assert.ok(itemIds.includes('exclude_domain'));
});

test('Context Menu: handleContextMenuClick handles stash_current_tab', async () => {
  let stashed = [];
  const handlers = {
    stashTabs: async (tabs) => { stashed = tabs; },
    openDashboard: async () => {},
    excludeDomain: async () => {}
  };

  const sampleTab = { id: 101, url: 'https://example.com', title: 'Example' };
  await handleContextMenuClick({ id: 'stash_current_tab' }, sampleTab, handlers);

  assert.equal(stashed.length, 1);
  assert.equal(stashed[0].id, 101);
});

test('Context Menu: handleContextMenuClick handles exclude_domain', async () => {
  let excluded = null;
  const handlers = {
    stashTabs: async () => {},
    openDashboard: async () => {},
    excludeDomain: async (domain) => { excluded = domain; }
  };

  const sampleTab = { id: 102, url: 'https://sub.domain.com/path?foo=bar', title: 'Test' };
  await handleContextMenuClick({ id: 'exclude_domain' }, sampleTab, handlers);

  assert.equal(excluded, 'sub.domain.com');
});
