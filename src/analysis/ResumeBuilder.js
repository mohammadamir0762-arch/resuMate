import { TextBlock } from '../domain/TextBlock.js';
import { mergeWrappedLines } from './RewriteSuggester.js';

const BULLET_SECTIONS = ['experience', 'projects', 'achievements'];

// Rebuilds the parsed resume as clean, one-column text and applies the suggestions the user picked.
export class ResumeBuilder {
  constructor(resume) {
    this.resume = resume;
  }

  build(suggestions = []) {
    const sections = this.resume.getSections().map((section) => ({
      key: section.key,
      title: section.heading ? section.heading.text.replace(/:$/, '').toUpperCase() : null,
      lines: toLines(section),
    }));

    for (const suggestion of suggestions) applySuggestion(sections, suggestion);
    return sections;
  }

  toText(suggestions = []) {
    return this.build(suggestions)
      .filter((section) => section.title || section.lines.length > 0)
      .map((section) => {
        const lines = section.lines.map((line) => (line.bullet ? `• ${line.text}` : line.text));
        return section.title ? [section.title, ...lines].join('\n') : lines.join('\n');
      })
      .join('\n\n');
  }
}

// Rows with several blocks (a job title and its date) become one line joined with " | ".
// Runs of single-block rows go through the same wrap-joining the suggestions use,
// so a suggestion's original text matches a line here.
function toLines(section) {
  const lines = [];
  let run = [];

  const flushRun = () => {
    for (const line of mergeWrappedLines(run, section.blocks)) lines.push({ text: line.text, bullet: line.bullet });
    run = [];
  };

  // Name and contact lines are short separate lines, never wrapped text.
  const keepRowsApart = ['header', 'contact'].includes(section.key);

  for (const row of groupRows(section.blocks)) {
    if (keepRowsApart || row.length > 1) {
      flushRun();
      lines.push({ text: joinRow(row), bullet: false });
    } else {
      run.push(row[0]);
    }
  }
  flushRun();

  // Many PDFs draw bullets as shapes, not characters. If no line had a bullet character,
  // treat sentence-like lines in Experience and Projects as bullets (not "Title | Tools" lines).
  if (BULLET_SECTIONS.includes(section.key) && !lines.some((line) => line.bullet)) {
    for (const line of lines) {
      line.bullet = /^[A-Z]/.test(line.text) && !line.text.includes(' | ') && line.text.split(/\s+/).length >= 6;
    }
  }

  return lines;
}

// "Title" + "2022 - Present" -> "Title | 2022 - Present", without doubling separators already in the text.
function joinRow(row) {
  return row
    .map((block) => block.text.replace(/^[\s|•·]+|[\s|•·]+$/g, ''))
    .filter(Boolean)
    .join(' | ');
}

function groupRows(blocks) {
  const rows = [];
  for (const block of blocks) {
    const previous = rows[rows.length - 1]?.at(-1);
    if (previous && previous.line === block.line && pageOf(previous) === pageOf(block)) {
      rows[rows.length - 1].push(block);
    } else {
      rows.push([block instanceof TextBlock ? block : new TextBlock(block)]);
    }
  }
  return rows;
}

function pageOf(block) {
  return String(block.id).split('-')[0];
}

function applySuggestion(sections, suggestion) {
  const text = suggestion.rewrittenText;

  if (suggestion.originalText) {
    const target = normalize(suggestion.originalText);
    for (const section of sections) {
      const line = section.lines.find((item) => normalize(item.text) === target);
      if (line) {
        line.text = text;
        return;
      }
    }
    return;
  }

  if (suggestion.type === 'add-skill') {
    findOrAddSection(sections, 'skills', 'SKILLS').lines.push({ text: `Additional skills: ${text}`, bullet: false });
  } else if (suggestion.type === 'structure') {
    findOrAddSection(sections, 'skills', 'SKILLS').lines.push({ text: text.replace(/^Skills:\s*/, ''), bullet: false });
  } else if (suggestion.type === 'job-title') {
    findOrAddSection(sections, 'summary', 'SUMMARY').lines.unshift({ text, bullet: false });
  } else if (suggestion.type === 'new-line') {
    const home = sections.find((section) => section.key === 'experience') ?? sections.find((section) => section.key === 'projects');
    (home ?? findOrAddSection(sections, 'experience', 'EXPERIENCE')).lines.push({ text, bullet: true });
  }
}

// New sections go right after the header, where recruiters look first.
function findOrAddSection(sections, key, title) {
  const existing = sections.find((section) => section.key === key);
  if (existing) return existing;

  const section = { key, title, lines: [] };
  const headerIndex = sections.findIndex((item) => item.key === 'header');
  sections.splice(headerIndex + 1, 0, section);
  return section;
}

function normalize(text) {
  return String(text)
    .replace(/^[\s•●▪◦‣∙·*–—-]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
