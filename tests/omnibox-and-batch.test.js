import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterGroupsByQuery } from '../extension/src/search.js';
import { deduplicateTabs } from '../extension/src/import-export.js';

test('Omnibox & Batch: query filters tabs for omnibox suggestions', () => {
  const groups = [
    {
      id: 'grp_1',
      title: 'Dev Resources',
      tabs: [
        { id: 't1', title: 'GitHub', url: 'https://github.com' },
        { id: 't2', title: 'MDN Web Docs', url: 'https://developer.mozilla.org' }
      ]
    },
    {
      id: 'grp_2',
      title: 'News',
      tabs: [
        { id: 't3', title: 'Hacker News', url: 'https://news.ycombinator.com' }
      ]
    }
  ];

  const matched = filterGroupsByQuery(groups, 'github');
  assert.equal(matched.length, 1);
  assert.equal(matched[0].tabs.length, 1);
  assert.equal(matched[0].tabs[0].title, 'GitHub');
});

test('Omnibox & Batch: individual tab starring and quick list aggregation', () => {
  const groups = [
    {
      id: 'grp_1',
      tabs: [
        { id: 't1', title: 'Tab 1', url: 'https://1.com', isStarred: true },
        { id: 't2', title: 'Tab 2', url: 'https://2.com', isStarred: false }
      ]
    },
    {
      id: 'grp_2',
      tabs: [
        { id: 't3', title: 'Tab 3', url: 'https://3.com', isStarred: true }
      ]
    }
  ];

  const starredTabs = [];
  for (const g of groups) {
    for (const t of g.tabs) {
      if (t.isStarred) starredTabs.push(t);
    }
  }

  assert.equal(starredTabs.length, 2);
  assert.equal(starredTabs[0].id, 't1');
  assert.equal(starredTabs[1].id, 't3');
});

test('Omnibox & Batch: inter-group tab reorder logic', () => {
  const groupA = {
    id: 'grp_a',
    tabs: [
      { id: 't1', title: 'Tab 1' },
      { id: 't2', title: 'Tab 2' }
    ]
  };
  const groupB = {
    id: 'grp_b',
    tabs: [
      { id: 't3', title: 'Tab 3' }
    ]
  };

  // Move t1 from groupA to groupB
  const idx = groupA.tabs.findIndex(t => t.id === 't1');
  const [moved] = groupA.tabs.splice(idx, 1);
  groupB.tabs.push(moved);

  assert.equal(groupA.tabs.length, 1);
  assert.equal(groupB.tabs.length, 2);
  assert.equal(groupB.tabs[1].id, 't1');
});
