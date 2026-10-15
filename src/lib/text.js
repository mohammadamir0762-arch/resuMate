// Small text helpers shared by the domain model and the analyzers.

const ENGLISH_STOP_WORDS = `
a about above after again against all also am an and any are as at be because been before being
below between both but by can could did do does doing down during each either etc few for from
further had has have having he her here hers him his how i if in into is it its itself just let
me more most my no nor not now of off on once only or other our ours out over own per same she
should so some such than that the their theirs them then there these they this those through to
too under until up upon very via was we were what when where which while who whom why will with
within without would yet you your yours
`;

// Words that appear in almost every job post, so they say nothing about fit.
// Includes common verbs ("build", "write") and level words ("senior").
const JOB_POST_WORDS = `
analyse analyze assist better bring closely collaborate collaborating complex contribute create
creating decisions deliver delivering design designing develop developing drive enjoy ensure entry
every expert fast faster find get give grow growing helping hire hiring hybrid identify implement
improve improving intern junior keep large lead learn learning location maintain maintaining manage
meet mid office on-site onsite operate own passionate plan present principal provide quick quickly
run see senior set ship small solve staff take track understand weekly wide write writing build
built closely docs end week weeks basic willingness motivated internship real-world
ability able across apply applicant applicants based benefits best bonus candidate candidates
company day days e.g employer environment equal excellent experience experienced
familiar familiarity fast-paced full-time good great hands-on help high highly i.e ideal include
included includes including job join joining key knowledge least level levels like looking make
making minimum month months multiple must need needs new nice one opportunity part people plus
position preferred proficiency proficient proven related relevant remote required requirement
requirements responsibilities responsible role salary seeking should skill skills solid strong team
teams three time two understanding use used using various want way well work working works world
year years
`;

export const STOP_WORDS = new Set(
  `${ENGLISH_STOP_WORDS} ${JOB_POST_WORDS}`.split(/\s+/).filter(Boolean),
);

const TOKEN_PATTERN = /[a-z0-9][a-z0-9+#.-]*/g;

export function tokenize(text) {
  return (String(text).toLowerCase().match(TOKEN_PATTERN) ?? [])
    .map(normalizeToken)
    .filter((token) => token.length > 0);
}

// Keeps c++, c#, node.js intact but drops sentence punctuation around a word.
export function normalizeToken(token) {
  return String(token)
    .toLowerCase()
    .replace(/^[^a-z0-9.]+/, '')
    .replace(/[^a-z0-9+#]+$/, '');
}

// A tiny stemmer so "testing", "tests" and "tested" all compare equal.
export function stem(word) {
  let result = word;
  if (result.length > 3 && result.endsWith('s') && !/(ss|us|is)$/.test(result)) {
    result = result.slice(0, -1);
  }
  if (result.length > 5 && result.endsWith('ing')) result = result.slice(0, -3);
  else if (result.length > 4 && result.endsWith('ed')) result = result.slice(0, -2);
  if (result.length > 4 && result.endsWith('e')) result = result.slice(0, -1);
  return result;
}

export function countWords(text) {
  return (String(text).match(/\b[\w+#.-]+\b/g) ?? []).length;
}

// Most frequent meaningful words, in the form they first appeared.
// minCount drops words said only once; keep lists words to include anyway (e.g. title words).
export function extractKeywords(text, limit = 25, { minCount = 1, keep = [] } = {}) {
  const keepStems = new Set(keep.map((word) => stem(normalizeToken(word))));
  const counts = new Map();

  for (const token of tokenize(text)) {
    if (STOP_WORDS.has(token) || /^[\d.+-]+$/.test(token)) continue;
    if (token.length < 3 && !/[+#]/.test(token)) continue;

    const key = stem(token);
    const entry = counts.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      counts.set(key, { word: token, count: 1, order: counts.size });
    }
  }

  return [...counts.entries()]
    .filter(([key, entry]) => entry.count >= minCount || keepStems.has(key))
    .map(([, entry]) => entry)
    .sort((left, right) => right.count - left.count || left.order - right.order)
    .slice(0, limit)
    .map((entry) => entry.word);
}

export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Short, stable fingerprint of a text (not for security).
export function hashText(text) {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

export function createId(prefix = 'id') {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}
