import { formatDate } from '../lib/format.js';

const VISIBLE_REPORTS = 6;

function SavedReports({ reports, activeId, onOpen, onClear }) {
  if (reports.length === 0) return null;

  return (
    <section className="saved-reports">
      <div className="saved-heading">
        <h3>Saved reports</h3>
        <button type="button" className="link-button" onClick={onClear}>
          Clear
        </button>
      </div>
      <ul>
        {reports.slice(0, VISIBLE_REPORTS).map((report) => (
          <li key={report.id}>
            <button
              type="button"
              className={`saved-item${report.id === activeId ? ' active' : ''}`}
              onClick={() => onOpen(report.id)}
            >
              <span className={`score-badge ${report.getLevel()}`}>{report.getScore()}</span>
              <span className="saved-text">
                <strong>{report.jobTitle || 'Untitled job'}</strong>
                <small>
                  {report.resumeName} · {formatDate(report.generatedAt)}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">Saved only in this browser.</p>
    </section>
  );
}

export default SavedReports;
