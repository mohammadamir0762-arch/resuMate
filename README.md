# ResuMate: Offline Resume Analyzer

ResuMate checks how well a resume matches a job post. You upload a PDF resume and paste a job description. ResuMate then shows:

- a **match score** from 0 to 100,
- the **skills you have** and the **keywords you are missing**,
- an **X-Ray view** of how hiring software (an ATS) reads your PDF,
- **rewrite suggestions** you can copy into your resume,
- **biggest wins**: how many points each missing skill would add,
- an **updated resume**, generated on the spot with the changes you pick, ready to download as PDF.

Everything runs in your browser. The resume is never uploaded. After the first visit, the app also works with no internet.

**Live app:** https://mohammadamir0762-arch.github.io/resuMate/
**Source code:** https://github.com/mohammadamir0762-arch/resuMate

## Run it locally

You need **Node.js 20.19+ or 22.12+** and npm. No database, server or accounts are needed.

**Environment variables:** none. ResuMate has no backend and no API keys, so there is no `.env` file to set up.

```bash
git clone https://github.com/mohammadamir0762-arch/resuMate.git
cd resuMate
npm install
npm run dev        # start the app at http://localhost:5173
npm test           # run the tests
npm run build      # make a production build in dist/
npm run preview    # serve the build (this is where offline mode works)
npm run sample     # write samples/sample-resume.pdf and samples/sample-job.txt
```

To try the app quickly, upload `demo/demo-resume.pdf` (a made-up student) and paste the text from `demo/demo-job.txt`. You can also run `npm run sample` for a smaller sample.

## Deploy

`npm run build` makes a static site in `dist/`. Upload that folder to any static host (GitHub Pages, Netlify, Vercel). The live app above is the `dist/` folder on the `gh-pages` branch, served by GitHub Pages.

## Features (use cases)

These match the use case diagram in `usecase.puml`.

| Use case | How it works |
| --- | --- |
| Upload Resume PDF | Click or drag a PDF onto the upload box. Files over 15 MB, non-PDF files, locked PDFs and scanned PDFs (no text) get a clear message. |
| Extract Resume Text | pdf.js reads the PDF inside a Web Worker, so the page never freezes. Text pieces are grouped into rows and blocks by their position. Spaced-out headings ("E X P E R I E N C E") are joined back into words, and two-column pages are read one column at a time. |
| View X-Ray Resume Format | **Page map** draws every text block where it sits on the page. **Reading order** lists the blocks in the order software reads them. Headings and lines with skills are colored. Click a block to see its section and position. Two-column resumes get a warning, because some hiring software mixes the columns up. |
| Paste Job Description | Paste any job post. The first line is used as the job title. "About us", "Benefits" and similar parts are ignored. Skills under "Nice to have" count half, and for "Java or Kotlin" one of the two is enough. |
| Analyze Skills | A dictionary of about 125 skills, each with its common spellings (for example `k8s` for Kubernetes). Matching respects word edges, so "Java" does not match "JavaScript". |
| Generate Match Score | 70% skills (weighted, so core skills count more than soft skills) and 30% other keywords from the job post. 60 or more is a strong match. |
| Show Missing Keywords | Missing skills (required first, nice-to-have marked), and separately, other words the job post repeats. |
| Get Rewrite Suggestions | Adds missing skills to your Skills line, replaces weak openers ("Responsible for…", "Worked on…") with action verbs, asks for numbers on bullets without any, and gives example lines for missing skills. |
| Generate Updated Resume (new) | Tick the suggestions to apply. The resume is rebuilt in a clean one-column layout that hiring software reads well, with a live preview. Edit the text, then **Download PDF** (browser print), **Download .txt** or **Copy**. Unfilled [brackets] are highlighted and warned about. |
| Use App Offline | A service worker caches the whole app. Past reports are saved in the browser (newest 20) and can be opened again. |

## How it works

```
PDF file ──► PdfParserWorker ──► pdfWorker.js (pdf.js + layout.js)
                                      │
                                      ▼
                         ResumeDocument ─ Page ─ TextBlock
                                      │
Job post text ──► JobDescription      │
                         │            │
                         ▼            ▼
              SkillExtractor ──► MatchEngine ──► MatchReport ──► OfflineStore
                                                     ▲
                                  RewriteSuggester ──┘ (adds Suggestions)
```

## Project structure

The code follows the class diagram in `class-diagram.drawio`.

```
src/
  App.jsx                 AppController: session state, runAnalysis(), resetSession()
  components/
    UploadPanel.jsx       file picker and drag-and-drop
    XRayView.jsx          page map, reading order, zoom, block highlight
    ReportPanel.jsx       score, skills, missing keywords, suggestions
    SavedReports.jsx      list of past reports
    ResumeGenerator.jsx   updated resume: pick changes, edit, preview, download
  parser/
    TextExtractor.js      interface: parse(), supports()
    PdfParserWorker.js    TextExtractor that runs the PDF worker
    layout.js             groups pdf.js text items into rows and blocks
  workers/pdfWorker.js    Web Worker that runs pdf.js
  domain/                 ResumeDocument, Page, TextBlock, JobDescription,
                          Skill, MatchReport, Suggestion, sections
  analysis/
    Analyzer.js           abstract base class
    SkillExtractor.js     finds dictionary skills in text
    MatchEngine.js        score and missing keywords
    RewriteSuggester.js   rewrite suggestions
    ResumeBuilder.js      rebuilds the resume with the picked suggestions
    skillDictionary.js    the skill list
  storage/OfflineStore.js saves reports in localStorage
  lib/                    small text and date helpers
  sw.js                   service worker (finished by vite.config.js at build time)
tests/                    Node test runner tests, plus a tiny PDF maker for fixtures
scripts/make-sample.js    writes the sample PDF and job post
```

## Tests

`npm test` runs 48 tests with Node's built-in test runner. No extra packages are needed. They cover:

- layout grouping (rows, split words, spaced-out headings, two-column pages),
- the domain classes (sections, headings, JSON save and load),
- job post parsing (fluff, nice-to-have, either-or skills), skill matching, scoring, missing keywords and every kind of suggestion,
- the offline store,
- the full parsing path: a real PDF is built in memory and read with pdf.js.

## Privacy

- The PDF is read and parsed inside the browser, in a Web Worker. No network request carries resume data.
- Saved reports live in this browser's `localStorage` only. Use **Clear** under Saved reports to delete them.

## Notes

- The `frontend/` (Next.js) and `backend/` (Express) folders come from an early setup. The app does not use them.
- Offline mode only works in a production build (`npm run build` then `npm run preview`, or any static host). The dev server does not register the service worker.
