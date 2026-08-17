import { useMemo, useRef, useState } from 'react';

const initialParserState = {
  status: 'idle',
  error: '',
  fileName: '',
  pages: [],
  text: '',
};

const workerUrl = new URL('./workers/pdfWorker.js', import.meta.url);

function App() {
  const [parserState, setParserState] = useState(initialParserState);
  const [jobDescription, setJobDescription] = useState('');
  const workerRef = useRef(null);

  const stats = useMemo(() => {
    const words = parserState.text.match(/\b[\w+#.-]+\b/g) ?? [];
    const blocks = parserState.pages.reduce((total, page) => total + page.blocks.length, 0);

    return {
      pages: parserState.pages.length,
      blocks,
      words: words.length,
    };
  }, [parserState.pages, parserState.text]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setParserState({
        ...initialParserState,
        status: 'error',
        error: 'Upload a PDF resume to continue.',
      });
      return;
    }

    setParserState({
      ...initialParserState,
      status: 'loading',
      fileName: file.name,
    });

    workerRef.current?.terminate();
    const worker = new Worker(workerUrl, { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (message) => {
      const { type, payload, error } = message.data;

      if (type === 'parsed') {
        setParserState({
          status: 'ready',
          error: '',
          fileName: file.name,
          pages: payload.pages,
          text: payload.text,
        });
        worker.terminate();
        workerRef.current = null;
      }

      if (type === 'error') {
        setParserState({
          ...initialParserState,
          status: 'error',
          fileName: file.name,
          error,
        });
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = () => {
      setParserState({
        ...initialParserState,
        status: 'error',
        fileName: file.name,
        error: 'PDF parsing failed. Try a different resume file.',
      });
      worker.terminate();
      workerRef.current = null;
    };

    const fileBuffer = await file.arrayBuffer();
    worker.postMessage({ fileBuffer }, [fileBuffer]);
  };

  return (
    <main className="app-shell">
      <section className="workspace">
        <aside className="input-panel">
          <div>
            <p className="eyebrow">ResuMate Phase 1</p>
            <h1>Local resume parser</h1>
            <p className="lede">
              Upload a PDF and inspect the text blocks extracted in your browser.
            </p>
          </div>

          <label className="upload-zone">
            <input type="file" accept="application/pdf" onChange={handleFileChange} />
            <span className="upload-title">Choose PDF resume</span>
            <span className="upload-copy">
              {parserState.fileName || 'No file selected'}
            </span>
          </label>

          <label className="field-group">
            <span>Job description</span>
            <textarea
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste the job description here. Matching starts in Phase 2."
            />
          </label>
        </aside>

        <section className="results-panel">
          <div className="status-row">
            <div>
              <p className="eyebrow">Extraction</p>
              <h2>{statusTitle(parserState.status)}</h2>
            </div>
            <div className="stat-grid" aria-label="Parsed resume statistics">
              <Stat label="Pages" value={stats.pages} />
              <Stat label="Blocks" value={stats.blocks} />
              <Stat label="Words" value={stats.words} />
            </div>
          </div>

          {parserState.status === 'error' && (
            <div className="notice error">{parserState.error}</div>
          )}

          {parserState.status === 'idle' && (
            <div className="empty-state">
              <h3>Waiting for a resume</h3>
              <p>The first sprint focuses on PDF upload, local parsing, and layout-aware extraction.</p>
            </div>
          )}

          {parserState.status === 'loading' && (
            <div className="empty-state">
              <h3>Parsing locally</h3>
              <p>The PDF worker is reading text positions without sending the file anywhere.</p>
            </div>
          )}

          {parserState.status === 'ready' && (
            <div className="xray-layout">
              <section className="text-preview">
                <h3>Extracted text</h3>
                <pre>{parserState.text}</pre>
              </section>

              <section className="xray-view">
                <h3>X-Ray blocks</h3>
                {parserState.pages.map((page) => (
                  <article className="page-card" key={page.pageNumber}>
                    <div className="page-heading">
                      <span>Page {page.pageNumber}</span>
                      <span>{page.blocks.length} blocks</span>
                    </div>
                    <div className="block-list">
                      {page.blocks.map((block) => (
                        <div className="text-block" key={block.id}>
                          <span className="block-meta">
                            x {Math.round(block.x)} / y {Math.round(block.y)}
                          </span>
                          <p>{block.text}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </section>
            </div>
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

function statusTitle(status) {
  if (status === 'loading') return 'Parsing resume';
  if (status === 'ready') return 'Resume parsed';
  if (status === 'error') return 'Needs attention';
  return 'Ready to start';
}

export default App;
