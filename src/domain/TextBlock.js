import { findSectionKey } from './sections.js';

// One line (or one column of a line) of text, with its position on the PDF page.
export class TextBlock {
  constructor({ id, text, x = 0, y = 0, width = 0, height = 0, line = 0, column = null }) {
    this.id = id;
    this.text = text;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.line = line;
    this.column = column;
  }

  // A known section name, or a short ALL-CAPS line such as a name or a custom heading.
  // Digits and end punctuation rule out things like "CGPA 8.6/10" or a wrapped "EKS."
  isHeading() {
    const text = this.text.trim();
    if (!text || text.length > 40) return false;
    if (findSectionKey(text)) return true;

    const letters = text.replace(/[^a-z]/gi, '');
    const wordCount = text.split(/\s+/).length;
    return (
      letters.length >= 4 &&
      wordCount <= 4 &&
      !/[\d,|•@]/.test(text) &&
      !/[.;,]$/.test(text) &&
      letters === letters.toUpperCase()
    );
  }

  toString() {
    return this.text;
  }
}
