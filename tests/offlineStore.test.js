import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MatchReport } from '../src/domain/MatchReport.js';
import { OfflineStore } from '../src/storage/OfflineStore.js';

function fakeStorage() {
  const items = new Map();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  };
}

test('saves, lists newest first, loads and clears reports', () => {
  const store = new OfflineStore(fakeStorage());
  const first = new MatchReport({ score: 40, jobTitle: 'First' });
  const second = new MatchReport({ score: 80, jobTitle: 'Second' });

  store.save(first);
  store.save(second);

  assert.deepEqual(
    store.listAll().map((report) => report.jobTitle),
    ['Second', 'First'],
  );
  assert.equal(store.load(first.id).getScore(), 40);
  assert.equal(store.load('missing'), null);

  store.clear();
  assert.deepEqual(store.listAll(), []);
});

test('saving the same report again replaces it', () => {
  const store = new OfflineStore(fakeStorage());
  const report = new MatchReport({ score: 50 });

  store.save(report);
  report.score = 55;
  store.save(report);

  assert.equal(store.listAll().length, 1);
  assert.equal(store.listAll()[0].getScore(), 55);
});

test('keeps only the 20 newest reports', () => {
  const store = new OfflineStore(fakeStorage());
  for (let index = 0; index < 25; index += 1) store.save(new MatchReport({ score: index }));

  const reports = store.listAll();
  assert.equal(reports.length, 20);
  assert.equal(reports[0].getScore(), 24);
});

test('ignores broken data and works without storage', () => {
  const storage = fakeStorage();
  storage.setItem('resumate.reports.v1', '{not json');
  assert.deepEqual(new OfflineStore(storage).listAll(), []);

  const memoryOnly = new OfflineStore(null);
  memoryOnly.save(new MatchReport({ score: 10 }));
  assert.equal(memoryOnly.listAll().length, 1);
});

test('running the same resume and job again replaces the saved report', () => {
  const store = new OfflineStore(fakeStorage());
  store.save(new MatchReport({ score: 80, inputKey: 'cv.pdf|a|b' }));
  store.save(new MatchReport({ score: 85, inputKey: 'cv.pdf|a|b' }));
  store.save(new MatchReport({ score: 40, inputKey: 'cv.pdf|a|other-job' }));

  assert.deepEqual(
    store.listAll().map((report) => report.getScore()),
    [40, 85],
  );
});
