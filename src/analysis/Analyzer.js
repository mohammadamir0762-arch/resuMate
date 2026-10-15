import { normalizeToken, stem } from '../lib/text.js';

// Base class for every analysis step. Subclasses must implement analyze().
export class Analyzer {
  constructor(config = {}) {
    if (new.target === Analyzer) {
      throw new TypeError('Analyzer is abstract. Create a subclass instead.');
    }
    this.config = config;
  }

  // eslint-disable-next-line no-unused-vars
  analyze(resume, job) {
    throw new Error(`${this.constructor.name} must implement analyze().`);
  }

  normalize(token) {
    return stem(normalizeToken(token));
  }
}
