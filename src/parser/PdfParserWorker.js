import { ResumeDocument } from '../domain/ResumeDocument.js';
import { TextExtractor } from './TextExtractor.js';

// Runs pdf.js in a Web Worker so big files never freeze the page.
// The file is read in the browser only; nothing is uploaded anywhere.
export class PdfParserWorker extends TextExtractor {
  constructor() {
    super();
    this.worker = null;
    this.rejectPending = null;
  }

  supports(mimeType) {
    return mimeType === 'application/pdf';
  }

  parse(buffer, { fileName = '', onProgress } = {}) {
    this.terminate();

    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../workers/pdfWorker.js', import.meta.url), {
        type: 'module',
      });
      this.worker = worker;
      this.rejectPending = reject;

      worker.onmessage = (message) => {
        const { type, payload, error } = message.data;

        if (type === 'progress') {
          onProgress?.(payload);
        } else if (type === 'parsed') {
          this.finish();
          resolve(new ResumeDocument({ fileName, pages: payload.pages }));
        } else if (type === 'error') {
          this.finish();
          reject(new Error(error));
        }
      };

      worker.onerror = () => {
        this.finish();
        reject(new Error('PDF parsing failed. Try a different resume file.'));
      };

      worker.postMessage({ fileBuffer: buffer }, [buffer]);
    });
  }

  terminate() {
    if (!this.worker) return;
    const reject = this.rejectPending;
    this.finish();
    reject?.(new Error('Parsing was cancelled.'));
  }

  finish() {
    this.worker?.terminate();
    this.worker = null;
    this.rejectPending = null;
  }
}
