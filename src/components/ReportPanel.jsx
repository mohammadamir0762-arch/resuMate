import { useState } from 'react';
import { formatDate } from '../lib/format.js';
import { SUGGESTION_LABELS } from '../lib/suggestionLabels.js';

const LEVEL_LABELS = { strong: 'Strong', fair: 'Fair', weak: 'Weak' };


function ReportPanel({ report, isStale, onCreateResume }) {
  const level = report.getLevel();
  const { breakdown } = report;
  const missingSkillNames = new Set(report.missingSkills.map((skill) => skill.name));
  const otherWords = report.missingKeywords.filter((word) => !missingSkillNames.has(word));

  return (
    <div className="report">
      {isStale && (
        <div className="notice warn">
          The resume or job description changed. Press Analyze match to update this report.
        </div>
      )}

      <section className="score-card">
        <ScoreRing score={report.getScore()} level={level} />
        <div className="score-copy">
          <p className="eyebrow">{LEVEL_LABELS[level]} match</p>
          <h3>{report.jobTitle || 'Job description'}</h3>
          <p>{report.getSummary()}</p>
          <p className="meta">
            {report.resumeName || 'Resume'} · {formatDate(report.generatedAt)}
          </p>
          <div className="breakdown">
            <Meter label="Skills" matched={breakdown.skillsMatched} total={breakdown.skillsWanted} />
            <Meter label="Keywords" matched={breakdown.keywordsMatched} total={breakdown.keywordsWanted} />
          </div>
        </div>
      </section>

      {report.biggestWins.length > 0 && (
        <BiggestWins
          wins={report.biggestWins}
          score={report.getScore()}
          scoreWithAllSkills={report.scoreWithAllSkills}
        />
      )}

      <div className="report-grid">
        <section className="report-section">
          <h3>
            Job skills you have ({report.matchedSkills.length} of{' '}
            {report.matchedSkills.length + report.missingSkills.length})
          </h3>
          <ChipList
            items={report.matchedSkills.map((skill) => skill.name)}
            tone="good"
            empty="None of the job’s skills were found in your resume yet."
          />
        </section>
        <section className="report-section">
          <h3>Missing skills ({report.missingSkills.length})</h3>
          <ChipList
            items={report.missingSkills.map((skill) => (skill.preferred ? `${skill.name} · nice to have` : skill.name))}
            tone="missing"
            empty="You have every skill this job lists."
          />
          {report.missingSkills.some((skill) => skill.preferred) && (
            <p className="chip-note">
              “Nice to have” means the job lists it under preferred or bonus skills. It counts half as much.
            </p>
          )}
        </section>
      </div>

      {otherWords.length > 0 && (
        <section className="report-section">
          <h3>Other words from the job post ({otherWords.length})</h3>
          <p className="section-note">The job uses these words often. Use them where they are true for you.</p>
          <ChipList items={otherWords} tone="word" empty="" />
        </section>
      )}

      <section className="report-section">
        <div className="section-heading-row">
          <h3>Rewrite suggestions ({report.suggestions.length})</h3>
          {onCreateResume && report.suggestions.length > 0 && (
            <button type="button" className="primary-button small" onClick={onCreateResume}>
              Create updated resume
            </button>
          )}
        </div>
        <p className="section-note">
          Only add things that are true. Replace the [brackets] with your real details.
        </p>
        {report.suggestions.length === 0 ? (
          <p className="muted">No suggestions. Your resume already reads well for this job.</p>
        ) : (
          <div className="suggestion-list">
            {report.suggestions.map((suggestion) => (
              <SuggestionCard key={suggestion.id} suggestion={suggestion} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BiggestWins({ wins, score, scoreWithAllSkills }) {
  const best = wins[0].points;

  return (
    <section className="report-section">
      <h3>Biggest wins</h3>
      <p className="section-note">
        Points each missing skill would add on its own. Add a skill only if you really have it.
      </p>
      <ol className="wins-list">
        {wins.map((win) => (
          <li key={win.name}>
            <span className="win-name">
              {win.name}
              {win.preferred && <small> · nice to have</small>}
            </span>
            <span className="win-bar" aria-hidden="true">
              <span style={{ width: `${(win.points / best) * 100}%` }} />
            </span>
            <span className="win-points">+{win.points}</span>
          </li>
        ))}
      </ol>
      {scoreWithAllSkills !== null && scoreWithAllSkills > score && (
        <p className="wins-total">
          With every skill this job lists: <strong>{score}</strong> → <strong>{scoreWithAllSkills}</strong>
        </p>
      )}
    </section>
  );
}

function ScoreRing({ score, level }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={`score-ring ${level}`} role="img" aria-label={`Match score ${score} out of 100`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="track" cx="60" cy="60" r={radius} />
        <circle
          className="value"
          cx="60"
          cy="60"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
        />
      </svg>
      <span>
        {score}
        <small>/100</small>
      </span>
    </div>
  );
}

function Meter({ label, matched = 0, total = 0 }) {
  const percent = total > 0 ? Math.round((matched / total) * 100) : 0;

  return (
    <div className="meter">
      <div className="meter-label">
        <span>{label}</span>
        <span>
          {matched} of {total}
        </span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ChipList({ items, tone, empty }) {
  if (items.length === 0) return <p className="muted">{empty}</p>;

  return (
    <ul className="chip-list">
      {items.map((item) => (
        <li className={`chip ${tone}`} key={item}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function SuggestionCard({ suggestion }) {
  const [copyState, setCopyState] = useState('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(suggestion.apply());
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 1800);
  };

  return (
    <article className="suggestion-card">
      <div className="suggestion-head">
        <span className={`tag ${suggestion.type}`}>{SUGGESTION_LABELS[suggestion.type] ?? 'Tip'}</span>
        <span className="suggestion-section">{suggestion.section}</span>
        <button type="button" className="copy-button" onClick={copy}>
          {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
        </button>
      </div>
      {suggestion.originalText && (
        <p className="before">
          <span className="label">Now</span>
          <span className="text">{suggestion.originalText}</span>
        </p>
      )}
      <p className="after">
        <span className="label">{suggestion.originalText ? 'Try' : 'Add'}</span>
        <span className="text">{suggestion.rewrittenText}</span>
      </p>
      <p className="reason">{suggestion.reason}</p>
    </article>
  );
}

export default ReportPanel;
