// Turns raw pdf.js text items into layout-aware rows and blocks.
// Kept free of pdf.js imports so it can run in tests and in the worker.

const ROW_TOLERANCE = 6;
const COLUMN_GAP = 14;
const MIN_COLUMN_WORDS = 20;

export function buildLayoutBlocks(items, pageNumber) {
  return buildPageLayout(items, pageNumber).blocks;
}

// Returns the page's blocks in reading order, plus the x position of the gap
// between columns when the page has two columns (null otherwise).
export function buildPageLayout(items, pageNumber) {
  const positionedItems = removeStackedCopies(
    items.filter((item) => typeof item.str === 'string' && item.str.trim().length > 0 && !isIconGlyph(item)),
  )
    .map((item) => {
      const spacedWord = collapseLetterSpacing(item.str.trim());
      return {
        raw: item.str,
        text: spacedWord ?? item.str.trim(),
        letterSpaced: Boolean(spacedWord),
        x: item.transform[4],
        y: item.transform[5],
        width: item.width ?? 0,
        height: item.height || Math.abs(item.transform[3]) || 0,
      };
    })
    .sort((left, right) => right.y - left.y || left.x - right.x);

  const blocks = [];

  groupIntoRows(positionedItems).forEach((row, lineIndex) => {
    for (const segment of splitIntoSegments(row.items)) {
      const text = joinSegment(segment);
      if (!text) continue;

      const first = segment[0];
      const last = segment[segment.length - 1];

      blocks.push({
        text,
        x: first.x,
        y: row.y,
        width: Math.max(0, last.x + last.width - first.x),
        height: Math.max(...segment.map((item) => item.height)),
        line: lineIndex,
      });
    }
  });

  const columns = detectColumns(blocks);
  const ordered = columns ? orderByColumns(blocks, columns) : blocks;

  return {
    blocks: ordered.map((block, index) => ({ id: `p${pageNumber}-b${index + 1}`, ...block })),
    columnSplit: columns?.split ?? null,
  };
}

// Icon fonts (phone, email, LinkedIn icons) draw one symbol about one letter wide,
// but pdf.js names it with a whole word like "Phone-Alt". Real words are much wider.
function isIconGlyph(item) {
  const text = item.str.trim();
  const size = item.height || Math.abs(item.transform[3]) || 0;
  return text.length >= 3 && item.width > 0 && size > 0 && item.width < text.length * size * 0.2;
}

// Some PDFs draw the same text several times, a fraction of a point apart, for a shadow or bold effect.
function removeStackedCopies(items) {
  const kept = [];
  for (const item of items) {
    const size = item.height || Math.abs(item.transform[3]) || 10;
    const isCopy = kept.some(
      (other) =>
        other.str === item.str &&
        Math.abs(other.transform[4] - item.transform[4]) < size * 0.25 &&
        Math.abs(other.transform[5] - item.transform[5]) < size * 0.25,
    );
    if (!isCopy) kept.push(item);
  }
  return kept;
}

export function groupIntoRows(items) {
  const rows = [];

  for (const item of items) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= ROW_TOLERANCE);

    if (row) {
      row.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  return rows
    .sort((left, right) => right.y - left.y)
    .map((row) => ({ ...row, items: row.items.sort((left, right) => left.x - right.x) }));
}

// Spaced-out headings ("E X P E R I E N C E") come from pdf.js with a space
// between every letter. Returns the joined word, or null for normal text.
export function collapseLetterSpacing(text) {
  const parts = text.split(' ');
  if (parts.length < 3 || parts.some((part) => part.length === 0 || part.length > 2)) return null;

  const singles = parts.filter((part) => part.length === 1).length;
  return singles / parts.length >= 0.7 ? parts.join('') : null;
}

// A letter on its own, or a word that was letter-spaced.
function isLetterish(item) {
  return item.letterSpaced || item.text.length === 1;
}

// A big horizontal gap inside a row usually means a second column or a right-aligned date.
// Spaced-out headings have big gaps between words too, so those are kept together.
function splitIntoSegments(rowItems) {
  const segments = [];
  let segment = [];

  rowItems.forEach((item, index) => {
    const previous = rowItems[index - 1];
    if (previous) {
      const gap = item.x - (previous.x + previous.width);
      const sameSpacedHeading =
        isLetterish(previous) && isLetterish(item) && gap < 3 * Math.max(previous.height, item.height);

      if (gap > COLUMN_GAP && !sameSpacedHeading) {
        segments.push(segment);
        segment = [];
      }
    }
    segment.push(item);
  });

  if (segment.length > 0) segments.push(segment);
  return segments;
}

function joinSegment(segment) {
  const letterGap = typicalLetterGap(segment);

  return segment
    .map((item, index) => {
      if (index === 0) return item.text;

      const previous = segment[index - 1];
      const gap = item.x - (previous.x + previous.width);
      let needsSpace;

      if (letterGap !== null && isLetterish(previous) && isLetterish(item)) {
        // Inside spaced-out text: a whole spaced word always ends a word, and
        // between single letters only a gap wider than usual is a word break.
        // Some PDFs store normal text one letter at a time, with almost no gap,
        // so the word-break gap is never smaller than a normal space.
        needsSpace =
          previous.letterSpaced ||
          item.letterSpaced ||
          gap > Math.max(letterGap * 1.6, Math.max(previous.height, 1) * 0.15);
      } else {
        // pdf.js sometimes splits one word into several items, so only add a space for a real gap.
        needsSpace =
          /\s$/.test(previous.raw) ||
          /^\s/.test(item.raw) ||
          gap > Math.max(previous.height, 1) * 0.15;
      }

      return `${needsSpace ? ' ' : ''}${item.text}`;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

// The usual gap between single letters, when most of the segment is spaced-out letters.
function typicalLetterGap(segment) {
  const letterish = segment.filter(isLetterish).length;
  if (segment.length < 2 || letterish / segment.length < 0.6) return null;

  const gaps = [];
  for (let index = 1; index < segment.length; index += 1) {
    const previous = segment[index - 1];
    const item = segment[index];
    if (previous.text.length === 1 && item.text.length === 1 && !previous.letterSpaced && !item.letterSpaced) {
      gaps.push(item.x - (previous.x + previous.width));
    }
  }

  if (gaps.length === 0) return 0;
  gaps.sort((left, right) => left - right);
  return gaps[Math.floor(gaps.length / 2)];
}

// Finds a vertical gap that splits the page into a left and a right column.
// A real column layout has text on both sides of the gap on many lines, and
// no line below the header crosses the gap. Right-aligned dates are not enough.
export function detectColumns(blocks) {
  const lineStart = new Map();
  for (const block of blocks) {
    lineStart.set(block.line, Math.min(lineStart.get(block.line) ?? Infinity, block.x));
  }

  const candidates = new Set(
    blocks.filter((block) => block.x > lineStart.get(block.line) + 1).map((block) => Math.round(block.x)),
  );

  let best = null;

  for (const split of candidates) {
    const isLeft = (block) => block.x + block.width <= split - 4;
    const isRight = (block) => block.x >= split - 2;

    const leftLines = new Set(blocks.filter(isLeft).map((block) => block.line));
    const sharedLines = [...new Set(blocks.filter(isRight).map((block) => block.line))].filter((line) =>
      leftLines.has(line),
    );
    if (sharedLines.length < 3) continue;

    const startLine = Math.min(...sharedLines);
    const body = blocks.filter((block) => block.line >= startLine);
    if (body.some((block) => !isLeft(block) && !isRight(block))) continue;

    const leftWords = countWords(body.filter(isLeft));
    const rightWords = countWords(body.filter(isRight));
    if (leftWords < MIN_COLUMN_WORDS || rightWords < MIN_COLUMN_WORDS) continue;

    const score = Math.min(leftWords, rightWords);
    if (!best || score > best.score) best = { split, startLine, score };
  }

  return best;
}

// Header lines first, then the whole left column, then the whole right column.
function orderByColumns(blocks, { split, startLine }) {
  const header = blocks.filter((block) => block.line < startLine);
  const body = blocks.filter((block) => block.line >= startLine);
  const left = body.filter((block) => block.x < split - 2).map((block) => ({ ...block, column: 'left' }));
  const right = body.filter((block) => block.x >= split - 2).map((block) => ({ ...block, column: 'right' }));
  return [...header, ...left, ...right];
}

function countWords(blocks) {
  return blocks.reduce((total, block) => total + block.text.split(/\s+/).length, 0);
}
