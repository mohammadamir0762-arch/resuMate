import { useMemo, useState } from 'react';

const ZOOM_STEPS = [0.6, 0.8, 1, 1.25, 1.5];

// Shows the resume the way hiring software (an ATS) reads it:
// as positioned text blocks, read one row at a time from top to bottom.
function XRayView({ resume, skills }) {
  const [mode, setMode] = useState('map');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  const sectionLabels = useMemo(() => resume.getSectionLabelMap(), [resume]);
  const blockInfo = useMemo(() => {
    const info = new Map();
    for (const page of resume.pages) {
      for (const block of page.blocks) {
        info.set(block.id, {
          page,
          block,
          isHeading: block.isHeading(),
          skills: skills.filter((skill) => skill.foundIn(block.text)).map((skill) => skill.name),
        });
      }
    }
    return info;
  }, [resume, skills]);

  const highlightBlock = (blockId) => {
    setSelectedId((current) => (current === blockId ? null : blockId));
  };

  const zoomIndex = ZOOM_STEPS.indexOf(zoomLevel);
  const selected = selectedId ? blockInfo.get(selectedId) : null;
  const kindOf = (blockId) => {
    const entry = blockInfo.get(blockId);
    if (entry.isHeading) return 'heading';
    return entry.skills.length > 0 ? 'skill' : 'plain';
  };

  return (
    <section className="xray-view">
      <p className="section-note">
        This is how hiring software reads your resume: row by row, top to bottom. Check that the
        headings are found and that the reading order makes sense.
      </p>

      <div className="xray-toolbar">
        <div className="segmented" role="group" aria-label="X-Ray view">
          <button type="button" aria-pressed={mode === 'map'} onClick={() => setMode('map')}>
            Page map
          </button>
          <button type="button" aria-pressed={mode === 'order'} onClick={() => setMode('order')}>
            Reading order
          </button>
        </div>

        {mode === 'map' && (
          <div className="zoom-controls">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoomIndex <= 0}
              onClick={() => setZoomLevel(ZOOM_STEPS[zoomIndex - 1])}
            >
              −
            </button>
            <span>{Math.round(zoomLevel * 100)}%</span>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoomIndex >= ZOOM_STEPS.length - 1}
              onClick={() => setZoomLevel(ZOOM_STEPS[zoomIndex + 1])}
            >
              +
            </button>
          </div>
        )}
      </div>

      <div className="xray-legend">
        <span><i className="swatch heading" /> Section heading</span>
        <span><i className="swatch skill" /> Has a skill</span>
        <span><i className="swatch plain" /> Other text</span>
      </div>

      {resume.pages.some((page) => page.hasColumns()) && (
        <div className="notice warn">
          This resume uses two columns. ResuMate reads each column on its own, but some older hiring
          software reads straight across the page and mixes the columns up. A one-column layout is the
          safest choice.
        </div>
      )}

      {selected && (
        <div className="block-detail" aria-live="polite">
          <p>{selected.block.text}</p>
          <span>
            {sectionLabels.get(selected.block.id) ?? 'Header'} · page {selected.page.pageNumber} · x{' '}
            {Math.round(selected.block.x)}, y {Math.round(selected.block.y)}
            {selected.isHeading ? ' · heading' : ''}
            {selected.skills.length > 0 ? ` · skills: ${selected.skills.join(', ')}` : ''}
          </span>
        </div>
      )}

      {mode === 'map'
        ? resume.pages.map((page) => (
            <article className="page-card" key={page.pageNumber}>
              <div className="page-heading">
                <span>Page {page.pageNumber}</span>
                <span>{page.getBlockCount()} blocks</span>
              </div>
              <div className="page-scroll">
                <div
                  className="page-map"
                  style={{ width: `${zoomLevel * 100}%`, aspectRatio: `${page.width} / ${page.height}` }}
                >
                  {page.hasColumns() && (
                    <span
                      className="column-split"
                      style={{ left: `${((page.columnSplit / page.width) * 100).toFixed(3)}%` }}
                      aria-hidden="true"
                    />
                  )}
                  {page.blocks.map((block) => (
                    <button
                      type="button"
                      key={block.id}
                      className={`map-block ${kindOf(block.id)}${block.id === selectedId ? ' selected' : ''}`}
                      style={mapBlockStyle(block, page)}
                      title={block.text}
                      onClick={() => highlightBlock(block.id)}
                    >
                      {block.text}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))
        : (
          <ol className="reading-order">
            {resume.getBlocks().map((block, index) => (
              <li key={block.id}>
                <button
                  type="button"
                  className={`order-row ${kindOf(block.id)}${block.id === selectedId ? ' selected' : ''}`}
                  onClick={() => highlightBlock(block.id)}
                >
                  <span className="order-index">{index + 1}</span>
                  <span className="order-text">{block.text}</span>
                  <span className="order-meta">
                    {sectionLabels.get(block.id) ?? 'Header'}
                    {block.column ? ` · ${block.column} column` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
    </section>
  );
}

// PDF points start at the bottom-left; CSS starts at the top-left, so flip y.
// Font size uses container units so the text scales with the page width.
function mapBlockStyle(block, page) {
  const height = Math.max(block.height, 6);
  const percent = (value) => `${(value * 100).toFixed(3)}%`;

  return {
    left: percent(block.x / page.width),
    top: percent((page.height - block.y - height * 0.85) / page.height),
    width: percent(Math.max(block.width, 8) / page.width),
    height: percent((height * 1.15) / page.height),
    fontSize: `${((height / page.width) * 100 * 0.82).toFixed(3)}cqw`,
  };
}

export default XRayView;
