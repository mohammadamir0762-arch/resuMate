import * as pdfjsLib from 'pdfjs-dist';
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs';
import { buildPageLayout } from '../parser/layout.js';

// We are already off the main thread, so let pdf.js run its parser right here
// instead of starting a nested worker. This also keeps everything in one bundle for offline use.
globalThis.pdfjsWorker = pdfjsWorker;

self.onmessage = async (event) => {
  try {
    const { fileBuffer } = event.data;
    const loadingTask = pdfjsLib.getDocument({
      data: fileBuffer,
      verbosity: pdfjsLib.VerbosityLevel.ERRORS,
    });
    const pdf = await loadingTask.promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const { blocks, columnSplit } = buildPageLayout(textContent.items, pageNumber);

      pages.push({ pageNumber, width: viewport.width, height: viewport.height, blocks, columnSplit });

      page.cleanup();
      self.postMessage({ type: 'progress', payload: { page: pageNumber, total: pdf.numPages } });
    }

    await loadingTask.destroy();
    self.postMessage({ type: 'parsed', payload: { pages } });
  } catch (error) {
    self.postMessage({ type: 'error', error: friendlyError(error) });
  }
};

function friendlyError(error) {
  if (error?.name === 'PasswordException') {
    return 'This PDF is password protected. Remove the password and try again.';
  }
  if (error?.name === 'InvalidPDFException') {
    return 'This file is not a valid PDF. Try exporting it again.';
  }
  return error instanceof Error ? error.message : 'Unknown PDF parsing error.';
}
