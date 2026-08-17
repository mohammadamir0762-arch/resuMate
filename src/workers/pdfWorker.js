import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

self.onmessage = async (event) => {
  try {
    const { fileBuffer } = event.data;
    const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const blocks = buildLayoutBlocks(textContent.items, pageNumber);

      pages.push({
        pageNumber,
        blocks,
        text: blocks.map((block) => block.text).join('\n'),
      });
    }

    self.postMessage({
      type: 'parsed',
      payload: {
        pages,
        text: pages.map((page) => page.text).join('\n\n'),
      },
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown PDF parsing error.',
    });
  }
};

function buildLayoutBlocks(items, pageNumber) {
  const positionedItems = items
    .map((item) => ({
      text: item.str.trim(),
      x: item.transform[4],
      y: item.transform[5],
      height: item.height,
      width: item.width,
    }))
    .filter((item) => item.text.length > 0)
    .sort((left, right) => {
      const yDistance = Math.abs(right.y - left.y);
      if (yDistance > 8) return right.y - left.y;
      return left.x - right.x;
    });

  const rows = [];

  for (const item of positionedItems) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 6);

    if (row) {
      row.items.push(item);
      row.y = (row.y + item.y) / 2;
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  return rows
    .sort((left, right) => right.y - left.y)
    .map((row, rowIndex) => {
      const rowItems = row.items.sort((left, right) => left.x - right.x);
      const text = rowItems
        .map((item, index) => {
          if (index === 0) return item.text;

          const previous = rowItems[index - 1];
          const gap = item.x - (previous.x + previous.width);
          return `${gap > 14 ? '  ' : ' '}${item.text}`;
        })
        .join('')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        id: `p${pageNumber}-b${rowIndex + 1}`,
        text,
        x: rowItems[0]?.x ?? 0,
        y: row.y,
      };
    })
    .filter((block) => block.text.length > 0);
}
