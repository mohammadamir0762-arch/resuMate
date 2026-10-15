// End-to-end check of the parsing path: a real PDF -> pdf.js -> layout blocks -> ResumeDocument.
// Node needs the "legacy" pdf.js build; the browser worker uses the normal one.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ResumeDocument } from '../src/domain/ResumeDocument.js';
import { buildLayoutBlocks } from '../src/parser/layout.js';
import { makePdf } from './fixtures/makePdf.js';
import { SAMPLE_RESUME_LINES } from './fixtures/sampleResume.js';

async function parsePdf(buffer, fileName) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer), verbosity: 0 });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    pages.push({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      blocks: buildLayoutBlocks(content.items, pageNumber),
    });
  }

  await loadingTask.destroy();
  return new ResumeDocument({ fileName, pages });
}

test('parses a generated resume PDF into sections', async () => {
  const resume = await parsePdf(makePdf([SAMPLE_RESUME_LINES]), 'asha.pdf');

  assert.equal(resume.getPageCount(), 1);
  assert.equal(resume.getPage(1).width, 612);
  assert.match(resume.getFullText(), /^Asha Verma\n/);
  assert.match(resume.getFullText(), /Software Engineer, Brightpath Labs {3}Jan 2022 - Present/);
  assert.deepEqual(
    resume.getSections().map((section) => section.key),
    ['header', 'summary', 'skills', 'experience', 'projects', 'education'],
  );
});

test('reads every page of a multi-page PDF', async () => {
  const resume = await parsePdf(
    makePdf([[{ x: 72, y: 700, text: 'Page one' }], [{ x: 72, y: 700, text: 'Page two' }]]),
    'two.pdf',
  );

  assert.equal(resume.getPageCount(), 2);
  assert.equal(resume.getFullText(), 'Page one\n\nPage two');
});

test('a PDF with no text gives an empty document', async () => {
  const resume = await parsePdf(makePdf([[]]), 'scan.pdf');
  assert.equal(resume.hasText(), false);
});
