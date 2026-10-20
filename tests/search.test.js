import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterGroupsByQuery, countVisibleTabs } from '../extension/src/search.js';

test('Search Module: empty or whitespace query returns all groups unchanged', () => {
  const groups = [
    { id: 'g1', title: 'Work', tabs: [{ title: 'Doc 1', url: 'https://docs.google.com' }] },
    { id: 'g2', title: 'Personal', tabs: [{ title: 'GitHub', url: 'https://github.com' }] }
  ];

  assert.deepEqual(filterGroupsByQuery(groups, ''), groups);
  assert.deepEqual(filterGroupsByQuery(groups, '   '), groups);
  assert.deepEqual(filterGroupsByQuery(groups, null), groups);
});

test('Search Module: single token matches substring in tab title or URL', () => {
  const groups = [
    {
      id: 'g1',
      title: 'Group 1',
      tabs: [
        { title: 'Google Docs', url: 'https://docs.google.com/1' },
        { title: 'Hacker News', url: 'https://news.ycombinator.com' }
      ]
    },
    {
      id: 'g2',
      title: 'Group 2',
      tabs: [
        { title: 'Mozilla Developer Network', url: 'https://developer.mozilla.org' }
      ]
    }
  ];

  // Match title 'google'
  const res1 = filterGroupsByQuery(groups, 'google');
  assert.equal(res1.length, 1);
  assert.equal(res1[0].tabs.length, 1);
  assert.equal(res1[0].tabs[0].title, 'Google Docs');

  // Match URL 'ycombinator'
  const res2 = filterGroupsByQuery(groups, 'ycombinator');
  assert.equal(res2.length, 1);
  assert.equal(res2[0].tabs.length, 1);
  assert.equal(res2[0].tabs[0].title, 'Hacker News');
});

test('Search Module: multiple tokens require all tokens to match', () => {
  const groups = [
    {
      id: 'g1',
      title: 'Docs Group',
      tabs: [
        { title: 'Google Docs Spreadsheet', url: 'https://docs.google.com/sheet' },
        { title: 'Google Drive Home', url: 'https://drive.google.com' }
      ]
    }
  ];

  const match = filterGroupsByQuery(groups, 'google sheet');
  assert.equal(match.length, 1);
  assert.equal(match[0].tabs.length, 1);
  assert.equal(match[0].tabs[0].title, 'Google Docs Spreadsheet');

  const noMatch = filterGroupsByQuery(groups, 'google wikipedia');
  assert.equal(noMatch.length, 0);
});

test('Search Module: group title match includes entire group tabs', () => {
  const groups = [
    {
      id: 'g1',
      title: 'Research Papers',
      tabs: [
        { title: 'arXiv 1234', url: 'https://arxiv.org/abs/1' },
        { title: 'Nature 5678', url: 'https://nature.com/articles/2' }
      ]
    }
  ];

  const match = filterGroupsByQuery(groups, 'Research');
  assert.equal(match.length, 1);
  assert.equal(match[0].tabs.length, 2);
});

test('Search Module: countVisibleTabs returns accurate tally', () => {
  const groups = [
    { id: 'g1', tabs: [{ id: '1' }, { id: '2' }] },
    { id: 'g2', tabs: [{ id: '3' }] },
    { id: 'g3', tabs: [] }
  ];

  assert.equal(countVisibleTabs(groups), 3);
  assert.equal(countVisibleTabs([]), 0);
});
