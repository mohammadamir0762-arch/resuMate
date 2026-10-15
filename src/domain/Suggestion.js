import { createId } from '../lib/text.js';

export class Suggestion {
  constructor({
    id = createId('sg'),
    type = 'rewrite',
    section = 'General',
    originalText = '',
    rewrittenText = '',
    reason = '',
  }) {
    this.id = id;
    this.type = type;
    this.section = section;
    this.originalText = originalText;
    this.rewrittenText = rewrittenText;
    this.reason = reason;
  }

  // Returns the text the user should paste into their resume.
  apply() {
    return this.rewrittenText;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      section: this.section,
      originalText: this.originalText,
      rewrittenText: this.rewrittenText,
      reason: this.reason,
    };
  }
}
