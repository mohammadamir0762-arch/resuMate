// Reads the plain-text resume (as edited by the user) back into parts for the printed PDF:
// first line = name, lines up to the first blank line = contact details,
// ALL-CAPS lines = section headings, "• " lines = bullets, anything else = a paragraph.
export function parseResumeText(text) {
  const lines = String(text).split('\n');
  const firstLine = lines.findIndex((line) => line.trim());
  if (firstLine === -1) return { name: '', contact: [], blocks: [] };

  const name = lines[firstLine].trim();
  let index = firstLine + 1;
  const contact = [];
  while (index < lines.length && lines[index].trim() && !isHeading(lines[index])) {
    contact.push(lines[index].trim());
    index += 1;
  }

  const blocks = [];
  for (const raw of lines.slice(index)) {
    const line = raw.trim();
    if (!line) continue;
    if (isHeading(line)) blocks.push({ type: 'heading', text: line });
    else if (/^[•\-*]\s+/.test(line)) blocks.push({ type: 'bullet', text: line.replace(/^[•\-*]\s+/, '') });
    else blocks.push({ type: 'text', text: line });
  }

  return { name, contact, blocks };
}

function isHeading(line) {
  const text = line.trim();
  const letters = text.replace(/[^a-z]/gi, '');
  return letters.length >= 3 && text.length <= 40 && !/[\d|@]/.test(text) && letters === letters.toUpperCase();
}

export function countPlaceholders(text) {
  return (String(text).match(/\[[^\]\n]+\]/g) ?? []).length;
}
