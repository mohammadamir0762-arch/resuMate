import { escapeRegExp } from '../lib/text.js';

// A skill from the dictionary. `terms` are the spellings we search for.
export class Skill {
  constructor({ name, category = 'General', weight = 1, terms = [name] }) {
    this.name = name;
    this.category = category;
    this.weight = weight;
    this.terms = [...new Set(terms.map((term) => term.toLowerCase()))];

    // Letters, digits, +, # or a dot right before a term mean it is part of a longer word
    // (so "java" does not match "javascript" and "js" does not match "node.js").
    const alternatives = this.terms.map(
      (term) => `(?<![a-z0-9+#.])${escapeRegExp(term).replace(/ /g, '[\\s-]+')}(?![a-z0-9+#])`,
    );
    this.pattern = new RegExp(alternatives.join('|'), 'i');
  }

  matches(token) {
    return this.terms.includes(String(token).toLowerCase().trim());
  }

  foundIn(text) {
    return this.pattern.test(text);
  }

  toJSON() {
    return { name: this.name, category: this.category, weight: this.weight };
  }
}
