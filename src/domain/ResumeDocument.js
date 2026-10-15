import { countWords } from '../lib/text.js';
import { Page } from './Page.js';
import { SECTION_LABELS, findSectionKey } from './sections.js';

export class ResumeDocument {
  constructor({ fileName = '', pages = [], uploadedAt = new Date() } = {}) {
    this.fileName = fileName;
    this.uploadedAt = uploadedAt;
    this.pages = pages.map((page) => (page instanceof Page ? page : new Page(page)));
    this.rawText = this.pages
      .map((page) => page.getText())
      .filter(Boolean)
      .join('\n\n');
    this.sections = null;
  }

  getPageCount() {
    return this.pages.length;
  }

  getFullText() {
    return this.rawText;
  }

  getPage(number) {
    return this.pages.find((page) => page.pageNumber === number) ?? null;
  }

  getWordCount() {
    return countWords(this.rawText);
  }

  getBlocks() {
    return this.pages.flatMap((page) => page.blocks);
  }

  hasText() {
    return this.rawText.trim().length > 0;
  }

  // Splits the resume into sections by walking the blocks in reading order.
  // Anything before the first known heading (name, contact line) is the header.
  getSections() {
    if (this.sections) return this.sections;

    const sections = [{ key: 'header', label: SECTION_LABELS.header, heading: null, blocks: [] }];

    for (const block of this.getBlocks()) {
      const key = block.isHeading() ? findSectionKey(block.text) : null;

      if (key) {
        sections.push({ key, label: SECTION_LABELS[key], heading: block, blocks: [] });
      } else {
        sections[sections.length - 1].blocks.push(block);
      }
    }

    this.sections = sections.filter((section) => section.heading || section.blocks.length > 0);
    return this.sections;
  }

  getSectionLabelMap() {
    const labels = new Map();
    for (const section of this.getSections()) {
      if (section.heading) labels.set(section.heading.id, section.label);
      for (const block of section.blocks) labels.set(block.id, section.label);
    }
    return labels;
  }
}
