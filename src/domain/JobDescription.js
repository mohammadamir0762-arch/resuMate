import { extractKeywords } from '../lib/text.js';

// Parts of a job post that describe the company or perks, not the work.
const FLUFF_HEADING =
  /^(about(?! (the |this )?(role|job|position|opportunity|you))\b.*|who we are|our (company|story|mission|culture|values|team)|benefits.*|perks.*|what we offer.*|what you('|’)ll get|why (join|work|you('|’)ll love).*|compensation.*|salary.*|equal (opportunity|employment).*|eeo.*|how to apply.*|location)$/i;
const WORK_HEADING =
  /^(responsibilities|requirements|qualifications|duties|skills|nice to have|bonus|preferred|must have|what you('|’)ll do|what we('|’)re looking for|what you bring|you have|you will|about the role|the role|your role)\b/i;
const FLUFF_LINE =/equal opportunity|regardless of (race|gender|age)|veteran status|reasonable accommodation/i;

// "Nice to have" parts: skills found only here count for less.
const PREFERRED_HEADING = /^(nice[ -]to[ -]haves?|bonus( points)?|preferred( qualifications| skills)?|good to have|desirable|pluses|extra credit)\b/i;
const PREFERRED_LINE = /\b(is|are|would be) a (big )?(plus|bonus)\b|\bnice to have\b/i;

// Short posts rarely repeat words, so single mentions count there.
const SHORT_POST_WORDS = 80;

const SENIORITY_WORDS = /\b(senior|sr\.?|junior|jr\.?|lead|principal|staff|mid-level|entry-level|intern|trainee)\b/gi;

export class JobDescription {
  constructor(rawText = '') {
    this.rawText = String(rawText).trim();
    const { relevantText, requiredText, preferredText } = splitPost(this.rawText);
    this.relevantText = relevantText;
    this.requiredText = requiredText;
    this.preferredText = preferredText;
    this.title = guessTitle(this.rawText);

    // Words said once are mostly noise in a long post, except words from the title.
    const wordCount = relevantText.split(/\s+/).length;
    this.keywords = extractKeywords(relevantText, 50, {
      minCount: wordCount < SHORT_POST_WORDS ? 1 : 2,
      keep: this.getCoreTitle().split(/\s+/),
    });
  }

  getKeywords() {
    return [...this.keywords];
  }

  // Parts of sentences that offer a choice, like "Java or Kotlin" or "Tableau, Looker or Power BI".
  getChoiceClauses() {
    return this.relevantText
      .split(/[\n;.]|\band\b/i)
      .filter((clause) => /\bor\b/i.test(clause));
  }

  // The role without level or team, e.g. "Senior Backend Engineer – Payments" -> "Backend Engineer".
  getCoreTitle() {
    return this.title
      .split(/\s[–—|-]\s|,|\(|:/)[0]
      .replace(SENIORITY_WORDS, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  isEmpty() {
    return this.rawText.length === 0;
  }
}

const ROLE_WORDS =
  /\b(engineer|developer|analyst|intern|manager|designer|scientist|architect|consultant|specialist|administrator|director|officer|associate|technician|nurse|teacher|accountant|executive|coordinator|assistant|programmer|tester)s?\b/i;

// Finds the role name: a "Job title:" line, else a short line near the top that names a role
// (some posts start with a company blurb), else the first sentence of the first line.
function guessTitle(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const labeled = lines.find((line) => /^(job title|position|role)\s*[:-]/i.test(line));
  const shortRoleLine = lines
    .slice(0, 15)
    .find((line) => line.split(/\s+/).length <= 8 && ROLE_WORDS.test(line) && !/[.!?]$/.test(line));

  const title = (labeled ?? shortRoleLine ?? lines[0] ?? '')
    .split(/\.\s/)[0]
    .replace(/^(job title|position|role)\s*[:-]\s*/i, '')
    .replace(/\.$/, '');
  return title.length > 70 ? `${title.slice(0, 67)}...` : title;
}

// Drops "About us", "Benefits" and similar parts, from their heading to the next heading,
// and collects the "nice to have" lines separately.
// Lists often have no bullets ("Health insurance"), and a short list item looks like a
// heading. So a part only changes at a known heading, or at a heading after a blank line.
function splitPost(text) {
  const kept = [];
  const required = [];
  const preferred = [];
  let skipping = false;
  let inPreferred = false;
  let previousBlank = true;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const heading = trimmed.replace(/:$/, '');
    const knownHeading = [WORK_HEADING, PREFERRED_HEADING, FLUFF_HEADING].some((pattern) => pattern.test(heading));

    if (isHeadingLine(trimmed) && (previousBlank || knownHeading)) {
      skipping = FLUFF_HEADING.test(heading);
      inPreferred = PREFERRED_HEADING.test(heading);
    }
    if (skipping || FLUFF_LINE.test(trimmed)) {
      previousBlank = trimmed.length === 0;
      continue;
    }

    kept.push(line);
    // "Nice to have: Next.js" on one line, or "Experience with dbt is a plus".
    const isPreferred = inPreferred || PREFERRED_HEADING.test(trimmed) || PREFERRED_LINE.test(trimmed);
    (isPreferred ? preferred : required).push(line);
    previousBlank = trimmed.length === 0;
  }

  return {
    relevantText: kept.join('\n'),
    requiredText: required.join('\n'),
    preferredText: preferred.join('\n'),
  };
}

// Short lines that are not bullets and do not end a sentence, e.g. "What you'll do".
function isHeadingLine(line) {
  return (
    line.length > 0 &&
    line.length <= 50 &&
    !/^[•\-–*·]/.test(line) &&
    !/[.!?,]$/.test(line) &&
    line.split(/\s+/).length <= 6
  );
}
