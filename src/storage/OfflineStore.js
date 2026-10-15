import { MatchReport } from '../domain/MatchReport.js';

const STORAGE_KEY = 'resumate.reports.v1';
const MAX_REPORTS = 20;

// Keeps past match reports in the browser (localStorage), newest first.
// Falls back to memory when storage is blocked, for example in private windows.
export class OfflineStore {
  constructor(storage = browserStorage()) {
    this.storage = storage ?? memoryStorage();
  }

  save(report) {
    const isSameRun = (item) => item.id === report.id || (report.inputKey && item.inputKey === report.inputKey);
    const reports = this.readAll().filter((item) => !isSameRun(item));
    reports.unshift(report.toJSON());
    this.writeAll(reports.slice(0, MAX_REPORTS));
  }

  load(id) {
    const data = this.readAll().find((item) => item.id === id);
    return data ? MatchReport.fromJSON(data) : null;
  }

  listAll() {
    return this.readAll().map((data) => MatchReport.fromJSON(data));
  }

  clear() {
    try {
      this.storage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clear if storage is unavailable.
    }
  }

  readAll() {
    try {
      const parsed = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  writeAll(reports) {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(reports));
    } catch {
      // Storage is full or blocked. The report still shows on screen.
    }
  }
}

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  };
}
