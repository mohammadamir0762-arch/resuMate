import { TextBlock } from './TextBlock.js';

// US Letter in PDF points, used when the parser could not read the page size.
const DEFAULT_WIDTH = 612;
const DEFAULT_HEIGHT = 792;

export class Page {
  constructor({ pageNumber, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, blocks = [], columnSplit = null }) {
    this.pageNumber = pageNumber;
    this.width = width;
    this.height = height;
    // x position of the gap between two columns, or null for a one-column page.
    this.columnSplit = columnSplit;
    this.blocks = blocks.map((block) => (block instanceof TextBlock ? block : new TextBlock(block)));
    this.text = joinBlocks(this.blocks);
  }

  getBlockCount() {
    return this.blocks.length;
  }

  getText() {
    return this.text;
  }

  hasColumns() {
    return this.columnSplit !== null;
  }
}

// Blocks on the same line are joined with a wide gap; lines are joined with newlines.
function joinBlocks(blocks) {
  const lines = [];

  for (const block of blocks) {
    const current = lines[lines.length - 1];
    if (current && current.line === block.line) {
      current.parts.push(block.text);
    } else {
      lines.push({ line: block.line, parts: [block.text] });
    }
  }

  return lines.map((line) => line.parts.join('   ')).join('\n');
}
