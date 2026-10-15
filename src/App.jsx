import { useEffect, useMemo, useRef, useState } from 'react';
import { MatchEngine } from './analysis/MatchEngine.js';
import { RewriteSuggester } from './analysis/RewriteSuggester.js';
import { SkillExtractor } from './analysis/SkillExtractor.js';
import ReportPanel from './components/ReportPanel.jsx';
import SavedReports from './components/SavedReports.jsx';
import UploadPanel from './components/UploadPanel.jsx';
import XRayView from './components/XRayView.jsx';
import { JobDescription } from './domain/JobDescription.js';
import { hashText } from './lib/text.js';
import { PdfParserWorker } from './parser/PdfParserWorker.js';
import { OfflineStore } from './storage/OfflineStore.js';

const MAX_FILE_SIZE = 15 * 1024 * 1024;

const initialParserState = {
  status: 'idle',
  error: '',
  fileName: '',
  progress: null,
  resume: null,
};

const store = new OfflineStore();
const skillExtractor = new SkillExtractor();

// The AppController from the class diagram: owns the session state and runs each step.
function App() {
  const [parserState, setParserState] = useState(initialParserState);
  const [jobDescription, setJobDescription] = useState('');
  const [report, setReport] = useState(null);
  const [analysisInput, setAnalysisInput] = useState(null);
  const [activeTab, setActiveTab] = useState('xray');
  const [savedReports, setSavedReports] = useState(() => store.listAll());
  const isOnline = useOnlineStatus();
  const extractorRef = useRef(null);
  const requestRef = useRef(0);

  const { resume } = parserState;
  const resumeSkills = useMemo(
    () => (resume ? skillExtractor.extractSkills(resume.getFullText()) : []),
    [resume],
  );

  const stats = useMemo(
    () => ({
      pages: resume?.getPageCount() ?? 0,
      blocks: resume?.getBlocks().length ?? 0,
      words: resume?.getWordCount() ?? 0,
      skills: resumeSkills.length,
    }),
    [resume, resumeSkills],
  );

  useEffect(() => () => extractorRef.current?.terminate(), []);

  const hasText = Boolean(resume?.hasText());
  const canAnalyze = parserState.status === 'ready' && hasText && jobDescription.trim().length > 0;
  const isStale =
    Boolean(report && analysisInput) &&
    (analysisInput.jobText !== jobDescription || analysisInput.resume !== resume);

  const handleFileChange = async (file) => {
    if (!file) return;

    const extractor = new PdfParserWorker();
    const mimeType = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : '');
    const problem = !extractor.supports(mimeType)
      ? 'Upload a PDF resume to continue.'
      : file.size > MAX_FILE_SIZE
        ? 'This PDF is bigger than 15 MB. Export a smaller copy and try again.'
        : '';

    if (problem) {
      setParserState({ ...initialParserState, status: 'error', fileName: file.name, error: problem });
      return;
    }

    requestRef.current += 1;
    const requestId = requestRef.current;
    const isCurrent = () => requestId === requestRef.current;

    extractorRef.current?.terminate();
    extractorRef.current = extractor;
    setParserState({ ...initialParserState, status: 'loading', fileName: file.name });
    setReport(null);
    setAnalysisInput(null);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = await extractor.parse(buffer, {
        fileName: file.name,
        onProgress: (progress) => {
          if (isCurrent()) setParserState((state) => ({ ...state, progress }));
        },
      });
      if (!isCurrent()) return;

      setParserState({ status: 'ready', error: '', fileName: file.name, progress: null, resume: parsed });
      setActiveTab('xray');
    } catch (error) {
      if (!isCurrent()) return;
      setParserState({
        ...initialParserState,
        status: 'error',
        fileName: file.name,
        error: error.message || 'PDF parsing failed. Try a different resume file.',
      });
    } finally {
      if (extractorRef.current === extractor) extractorRef.current = null;
    }
  };

  const runAnalysis = () => {
    if (!canAnalyze) return null;

    const job = new JobDescription(jobDescription);
    const engine = new MatchEngine({ skillExtractor });
    engine.analyze(resume, job);
    const nextReport = engine.buildReport();
    // Same resume and same job again: replace the saved report instead of adding a copy.
    nextReport.inputKey = `${resume.fileName}|${hashText(resume.getFullText())}|${hashText(jobDescription.trim())}`;

    const suggester = new RewriteSuggester();
    suggester.analyze(resume, job);
    for (const suggestion of suggester.suggest(nextReport)) nextReport.addSuggestion(suggestion);

    store.save(nextReport);
    setSavedReports(store.listAll());
    setReport(nextReport);
    setAnalysisInput({ jobText: jobDescription, resume });
    setActiveTab('report');
    return nextReport;
  };

  const resetSession = () => {
    requestRef.current += 1;
    extractorRef.current?.terminate();
    extractorRef.current = null;
    setParserState(initialParserState);
    setJobDescription('');
    setReport(null);
    setAnalysisInput(null);
    setActiveTab('xray');
  };

  const openSavedReport = (id) => {
    const saved = store.load(id);
    if (!saved) return;
    setReport(saved);
    setAnalysisInput(null);
    setActiveTab('report');
  };

  const clearSavedReports = () => {
    if (!window.confirm('Delete all saved reports from this browser?')) return;
    store.clear();
    setSavedReports([]);
  };

  const tabs = [
    { id: 'report', label: 'Match report', enabled: Boolean(report) || hasText },
    { id: 'xray', label: 'X-Ray', enabled: Boolean(resume) },
    { id: 'text', label: 'Text', enabled: Boolean(resume) },
  ];
  const visibleTab = tabs.find((tab) => tab.id === activeTab && tab.enabled)
    ? activeTab
    : tabs.find((tab) => tab.enabled)?.id;

  return (
    <main className="app-shell">
      <section className="workspace">
        <aside className="input-panel">
          <div>
            <div className="brand-row">
              <p className="eyebrow">ResuMate</p>
              <span className={`status-pill${isOnline ? '' : ' offline'}`}>
                {isOnline ? 'Private · runs on your device' : 'Offline · still works'}
              </span>
            </div>
            <h1>Offline resume analyzer</h1>
            <p className="lede">
              Upload a PDF resume and paste a job post. See your match score, missing keywords and
              rewrite ideas. Nothing leaves your browser.
            </p>
          </div>

          <UploadPanel
            fileName={parserState.fileName}
            status={parserState.status}
            progress={parserState.progress}
            onFileSelected={handleFileChange}
          />

          <label className="field-group">
            <span>Job description</span>
            <textarea
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste the full job post here: title, duties and requirements."
            />
          </label>

          <div className="action-row">
            <button type="button" className="primary-button" disabled={!canAnalyze} onClick={runAnalysis}>
              Analyze match
            </button>
            <button type="button" className="ghost-button" onClick={resetSession}>
              Start over
            </button>
          </div>
          <p className="hint">{analyzeHint(parserState.status, hasText, jobDescription)}</p>

          <SavedReports
            reports={savedReports}
            activeId={report?.id}
            onOpen={openSavedReport}
            onClear={clearSavedReports}
          />
        </aside>

        <section className="results-panel">
          <div className="status-row">
            <div>
              <p className="eyebrow">Results</p>
              <h2>{statusTitle(parserState.status, hasText, report)}</h2>
            </div>
            <div className="stat-grid" aria-label="Parsed resume statistics">
              <Stat label="Pages" value={stats.pages} />
              <Stat label="Blocks" value={stats.blocks} />
              <Stat label="Words" value={stats.words} />
              <Stat label="Skills in resume" value={stats.skills} />
            </div>
          </div>

          {parserState.status === 'error' && <div className="notice error">{parserState.error}</div>}

          {parserState.status === 'ready' && !hasText && (
            <div className="notice warn">
              We could not find any text in this PDF. It is probably a scanned image, and most hiring
              software cannot read it either. Export your resume from Word or Google Docs as a PDF and
              try again.
            </div>
          )}

          {parserState.status === 'loading' && (
            <div className="empty-state">
              <h3>Reading your resume</h3>
              <p>
                {parserState.progress
                  ? `Page ${parserState.progress.page} of ${parserState.progress.total} done.`
                  : 'Opening the PDF.'}{' '}
                The file stays on this device.
              </p>
            </div>
          )}

          {parserState.status !== 'loading' && !visibleTab && (
            <div className="empty-state">
              <h3>Waiting for a resume</h3>
              <p>
                Upload a PDF to see how hiring software reads it. Then paste a job description to get
                a match score and rewrite suggestions.
              </p>
            </div>
          )}

          {parserState.status !== 'loading' && visibleTab && (
            <>
              <div className="tabs" role="tablist" aria-label="Result views">
                {tabs.map((tab) => (
                  <button
                    type="button"
                    role="tab"
                    key={tab.id}
                    aria-selected={visibleTab === tab.id}
                    disabled={!tab.enabled}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {visibleTab === 'report' &&
                (report ? (
                  <ReportPanel report={report} isStale={isStale} />
                ) : (
                  <div className="empty-state">
                    <h3>No report yet</h3>
                    <p>Paste a job description on the left, then press Analyze match.</p>
                  </div>
                ))}

              {visibleTab === 'xray' && resume && <XRayView resume={resume} skills={resumeSkills} />}

              {visibleTab === 'text' && resume && (
                <section className="text-preview">
                  <pre>{resume.getFullText() || 'No text found.'}</pre>
                </section>
              )}
            </>
          )}
        </section>
      </section>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{value}</span>
      <small>{label}</small>
    </div>
  );
}

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return isOnline;
}

function statusTitle(status, hasText, report) {
  if (status === 'loading') return 'Parsing resume';
  if (status === 'error') return 'Needs attention';
  if (status === 'ready') return hasText ? 'Resume parsed' : 'No text found';
  if (report) return 'Saved report';
  return 'Ready to start';
}

function analyzeHint(status, hasText, jobDescription) {
  if (status === 'loading') return 'Reading the PDF…';
  if (status !== 'ready') return 'Step 1: upload your resume as a PDF.';
  if (!hasText) return 'This PDF has no readable text, so it cannot be matched.';
  if (!jobDescription.trim()) return 'Step 2: paste the job description.';
  return 'Ready. Your report is saved in this browser only.';
}

export default App;
