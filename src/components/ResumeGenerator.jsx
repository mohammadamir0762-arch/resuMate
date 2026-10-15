import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ResumeBuilder } from '../analysis/ResumeBuilder.js';
import { countPlaceholders, parseResumeText } from '../lib/resumeText.js';
import { SUGGESTION_LABELS } from '../lib/suggestionLabels.js';

// Stronger verbs only reword what is already there, so they are safe to apply by default.
// Everything else needs the user's real details, so the user opts in.
const SAFE_TYPES = ['strong-verb'];

function ResumeGenerator({ resume, report }) {
  const builder = useMemo(() => new ResumeBuilder(resume), [resume]);
  const [selected, setSelected] = useState(
    () => new Set(report.suggestions.filter((item) => SAFE_TYPES.includes(item.type)).map((item) => item.id)),
  );
  const [text, setText] = useState(() => builder.toText(pick(report.suggestions, selected)));
  const [status, setStatus] = useState('');

  const placeholders = countPlaceholders(text);
  const baseName = (report.resumeName || 'resume').replace(/\.pdf$/i, '');

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setText(builder.toText(pick(report.suggestions, next)));
  };

  const downloadPdf = () => {
    // The browser's print dialog saves the clean copy below as a PDF; the title becomes the file name.
    const previousTitle = document.title;
    document.title = `${baseName}-updated`;
    window.print();
    document.title = previousTitle;
  };

  const downloadText = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}-updated.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied');
    } catch {
      setStatus('Copy failed');
    }
    setTimeout(() => setStatus(''), 1800);
  };

  return (
    <section className="generator">
      <p className="section-note">
        Pick the changes to apply. Your updated resume is built right away in a clean one-column layout
        that hiring software reads well. Edit anything, then download it.
      </p>

      <div className="report-section">
        <h3>Changes to apply ({selected.size} of {report.suggestions.length})</h3>
        <ul className="change-list">
          {report.suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(suggestion.id)}
                  onChange={() => toggle(suggestion.id)}
                />
                <span className={`tag ${suggestion.type}`}>{SUGGESTION_LABELS[suggestion.type] ?? 'Tip'}</span>
                <span className="change-text">{suggestion.rewrittenText}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="chip-note">Ticking a box rebuilds the text, so make your own edits last.</p>
      </div>

      {placeholders > 0 && (
        <div className="notice warn">
          {placeholders} [bracket{placeholders === 1 ? '' : 's'}] still need your real details. Replace them
          in the editor before you download.
        </div>
      )}

      <div className="generator-actions">
        <button type="button" className="primary-button" onClick={downloadPdf}>
          Download PDF
        </button>
        <button type="button" className="ghost-button" onClick={downloadText}>
          Download .txt
        </button>
        <button type="button" className="ghost-button" onClick={copyText}>
          {status || 'Copy text'}
        </button>
      </div>

      <div className="generator-grid">
        <label className="resume-editor">
          <span>Edit text</span>
          <textarea value={text} onChange={(event) => setText(event.target.value)} spellCheck="true" />
        </label>
        <div className="resume-preview">
          <span>Preview</span>
          <ResumePaper text={text} highlight />
        </div>
      </div>

      {createPortal(<ResumePaper text={text} className="print-resume" />, document.body)}
    </section>
  );
}

function pick(suggestions, selected) {
  return suggestions.filter((item) => selected.has(item.id));
}

function ResumePaper({ text, highlight = false, className = '' }) {
  const { name, contact, blocks } = parseResumeText(text);
  const parts = [];
  let bullets = [];

  const flushBullets = () => {
    if (bullets.length > 0) parts.push(<ul key={`list-${parts.length}`}>{bullets}</ul>);
    bullets = [];
  };

  blocks.forEach((block, index) => {
    const content = renderInline(block.text, highlight);
    if (block.type === 'bullet') {
      bullets.push(<li key={index}>{content}</li>);
      return;
    }
    flushBullets();
    parts.push(block.type === 'heading' ? <h2 key={index}>{content}</h2> : <p key={index}>{content}</p>);
  });
  flushBullets();

  return (
    <article className={`resume-paper ${className}`.trim()}>
      {name && <h1>{name}</h1>}
      {contact.map((line) => (
        <p className="resume-contact" key={line}>
          {line}
        </p>
      ))}
      {parts}
    </article>
  );
}

// Marks unfilled [placeholders] on screen so they are easy to spot.
function renderInline(text, highlight) {
  if (!highlight) return text;
  return text.split(/(\[[^\]\n]+\])/).map((part, index) =>
    /^\[[^\]\n]+\]$/.test(part) ? (
      <mark key={index}>{part}</mark>
    ) : (
      part
    ),
  );
}

export default ResumeGenerator;
