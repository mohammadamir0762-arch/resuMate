// Writes a sample resume PDF and job description to samples/, for trying the app.
import { mkdirSync, writeFileSync } from 'node:fs';
import { makePdf } from '../tests/fixtures/makePdf.js';
import { SAMPLE_JOB_DESCRIPTION, SAMPLE_RESUME_LINES } from '../tests/fixtures/sampleResume.js';

mkdirSync('samples', { recursive: true });
writeFileSync('samples/sample-resume.pdf', makePdf([SAMPLE_RESUME_LINES]));
writeFileSync('samples/sample-job.txt', `${SAMPLE_JOB_DESCRIPTION}\n`);
console.log('Wrote samples/sample-resume.pdf and samples/sample-job.txt');
