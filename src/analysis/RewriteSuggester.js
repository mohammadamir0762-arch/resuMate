import { Suggestion } from '../domain/Suggestion.js';
import { escapeRegExp } from '../lib/text.js';
import { Analyzer } from './Analyzer.js';
import { SKILL_CATEGORIES } from './skillDictionary.js';

const BULLET = /^[\s•●▪◦‣∙·*–—-]+/;
const MAX_WEAK_VERB_SUGGESTIONS = 4;
const MAX_METRIC_SUGGESTIONS = 3;
const MAX_NEW_SKILL_SUGGESTIONS = 4;

// Bullet openers that describe a duty instead of an achievement.
// `gerund` is used when the rest starts with an -ing word, `noun` otherwise.
const WEAK_OPENERS = [
  { label: 'Responsible for', pattern: /^(?:i\s+)?(?:was\s+)?responsible\s+for\s+/i, gerund: 'past', noun: 'Owned' },
  { label: 'In charge of', pattern: /^(?:i\s+)?(?:was\s+)?in\s+charge\s+of\s+/i, gerund: 'past', noun: 'Led' },
  { label: 'Tasked with', pattern: /^(?:i\s+)?(?:was\s+)?tasked\s+with\s+/i, gerund: 'past', noun: 'Owned' },
  { label: 'Duties included', pattern: /^(?:my\s+)?(?:duties|tasks)\s+included\s+/i, gerund: 'past', noun: 'Delivered' },
  { label: 'Worked on', pattern: /^(?:i\s+)?worked\s+on\s+/i, gerund: 'past', noun: 'Delivered' },
  { label: 'Worked with', pattern: /^(?:i\s+)?worked\s+with\s+/i, gerund: 'Collaborated with', noun: 'Collaborated with' },
  { label: 'Involved in', pattern: /^(?:i\s+)?(?:was\s+)?(?:involved|participated)\s+in\s+/i, gerund: 'past', noun: 'Contributed to' },
  { label: 'Assisted', pattern: /^(?:i\s+)?assisted\s+(?:with|in)\s+/i, gerund: 'Supported the team in', noun: 'Supported' },
  { label: 'Helped', pattern: /^(?:i\s+)?helped\s+(?:with|in)\s+/i, gerund: 'Supported the team in', noun: 'Supported' },
  { label: 'Helped', pattern: /^(?:i\s+)?helped\s+(?:to\s+)?/i, verb: 'Partnered with the team to' },
  { label: 'Handled', pattern: /^(?:i\s+)?handled\s+/i, gerund: 'Managed', noun: 'Managed' },
];

const BASE_VERBS = new Set(
  `achieve analyze automate boost build conduct configure coordinate create cut debug define deliver
  deploy design develop document drive establish evaluate execute fix generate grow identify implement
  improve increase integrate introduce launch lead lower maintain manage migrate modernize monitor
  onboard optimize organize plan prepare raise reduce refactor research resolve review run scale secure
  set ship speed streamline support test train upgrade write`.split(/\s+/),
);

const IRREGULAR_PAST = {
  beginning: 'began', bringing: 'brought', building: 'built', buying: 'bought', choosing: 'chose',
  cutting: 'cut', doing: 'did', driving: 'drove', finding: 'found', getting: 'got', giving: 'gave',
  having: 'had', holding: 'held', keeping: 'kept', leading: 'led', making: 'made', meeting: 'met',
  overseeing: 'oversaw', paying: 'paid', putting: 'put', reading: 'read', running: 'ran',
  seeing: 'saw', selling: 'sold', sending: 'sent', setting: 'set', speaking: 'spoke',
  spending: 'spent', taking: 'took', teaching: 'taught', telling: 'told', thinking: 'thought',
  understanding: 'understood', winning: 'won', writing: 'wrote',
};

const NOT_GERUNDS = new Set(['during', 'morning', 'evening', 'ceiling', 'nothing', 'something', 'anything', 'everything']);

// -ing words that usually start a noun phrase ("Marketing analytics"), not an action.
const NOUN_GERUNDS = new Set(
  `accounting advertising banking branding budgeting computing consulting engineering licensing
  manufacturing marketing networking nursing onboarding pricing programming publishing staffing`.split(/\s+/),
);

const TEMPLATES = [
  { category: SKILL_CATEGORIES.LANGUAGES, text: 'Built [feature or tool] in {skill} that [result, e.g. cut processing time by 30%].' },
  { category: SKILL_CATEGORIES.FRONTEND, text: 'Developed [UI feature] with {skill}, improving [page speed or user metric] by [X%].' },
  { category: SKILL_CATEGORIES.BACKEND, text: 'Designed and built {skill} services that handle [N requests a day] with [X ms] response time.' },
  { category: SKILL_CATEGORIES.DATABASES, text: 'Modeled and tuned {skill} queries, cutting [query or report] time by [X%].' },
  { category: SKILL_CATEGORIES.CLOUD, text: 'Automated [build, test or deploy] with {skill}, cutting release time from [X] to [Y].' },
  { category: SKILL_CATEGORIES.DATA, text: 'Used {skill} to [analyze or build something], which [result, e.g. saved N hours a week].' },
  { category: SKILL_CATEGORIES.TESTING, text: 'Added {skill} tests covering [X%] of [module], catching [N] bugs before release.' },
  { category: SKILL_CATEGORIES.MOBILE, text: 'Shipped [feature] in a {skill} app used by [N] people.' },
  { category: SKILL_CATEGORIES.PRACTICES, text: 'Used {skill} to [plan, track or ship] work for a team of [N].' },
  { category: SKILL_CATEGORIES.CONCEPTS, text: 'Applied {skill} to [problem], which led to [result with a number].' },
  { category: SKILL_CATEGORIES.SOFT, text: 'Showed {skill} by [specific action], which led to [result].' },
  { category: '*', text: 'Used {skill} to [task], which led to [result with a number].' },
];

// Skills where the category template reads badly get their own line.
const MONITORING_TEMPLATE = 'Set up {skill} dashboards and alerts for [service], cutting the time to spot problems from [X] to [Y].';
const SKILL_TEMPLATES = {
  Prometheus: MONITORING_TEMPLATE,
  Grafana: MONITORING_TEMPLATE,
  Datadog: MONITORING_TEMPLATE,
  Terraform: 'Managed [N] cloud resources as code with Terraform, cutting setup time from [X] to [Y].',
  Kubernetes: 'Ran [N] services on Kubernetes, with [zero-downtime deploys or X% less cloud cost].',
  JSON: 'Built REST endpoints that exchange JSON with [web or mobile client], serving [N requests a day].',
  Authentication: 'Added secure login with [JWT or OAuth] for [N] users of [app].',
  'Responsive Design': 'Made [app] work well on phones and desktops, raising mobile use by [X%].',
  'Code Review': 'Reviewed [N] pull requests a month and caught [bugs or issues] before release.',
  Debugging: 'Tracked down and fixed [N] bugs in [system], cutting [errors or crashes] by [X%].',
  'System Design': 'Designed [system] to handle [N users or requests a day] with [X%] uptime.',
  'Data Structures & Algorithms': 'Sped up [feature] by [X%] by choosing a better data structure or algorithm.',
  OOP: 'Restructured [module] with clean object-oriented design, making [change] [X%] faster to ship.',
  'Design Patterns': 'Applied the [name] pattern to [module], making it easier to extend and test.',
  'Event-Driven Architecture': 'Built an event-driven [pipeline or service] that processes [N events a day].',
  Cybersecurity: 'Found and fixed [N] security issues in [system] after an OWASP review.',
  'A/B Testing': 'Ran [N] A/B tests on [feature], lifting [conversion or retention] by [X%].',
  Forecasting: 'Built a forecasting model for [metric] with [X%] error, used to plan [decision].',
  Communication: 'Presented [topic] to [audience] every [week or month], which led to [decision or result].',
  Teamwork: 'Worked with [teams] to deliver [project] [N weeks] ahead of plan.',
  Leadership: 'Led a team of [N] to deliver [project], which [result with a number].',
  Mentoring: 'Mentored [N] junior [role]s, helping them [ship their first feature or get promoted].',
  'Problem Solving': 'Found the root cause of [problem] in [system] and cut [errors or delays] by [X%].',
  'Project Management': 'Managed [project] with a team of [N] and delivered it on time and on budget.',
  'Time Management': 'Handled [N] projects at once while meeting every deadline for [period].',
  'Stakeholder Management': 'Ran [weekly] updates with [stakeholders], keeping [project] on track.',
};

// A first line like "We are hiring!" is not a job title.
const NOT_A_TITLE = /\b(we|our|you|your|are|is|hiring|looking|join)\b|[!?]/i;
const CONTACT_LINE = /@|https?:|www\.|linkedin|github\.com|\|/i;
const IMPACT_SECTIONS = ['experience', 'projects'];

export class RewriteSuggester extends Analyzer {
  constructor(config = {}) {
    super(config);
    this.templates = config.templates ?? TEMPLATES;
    this.resume = null;
    this.job = null;
    this.sections = [];
  }

  analyze(resume, job) {
    this.resume = resume;
    this.job = job;
    this.sections = resume.getSections().map((section) => ({
      key: section.key,
      label: section.label,
      lines: mergeWrappedLines(section.blocks),
    }));
  }

  suggest(report) {
    if (!this.resume) throw new Error('Call analyze() before suggest().');

    return [
      ...this.suggestJobTitle(),
      ...this.suggestSkillsLine(report),
      ...this.suggestStrongVerbs(),
      ...this.suggestMetrics(),
      ...this.suggestNewSkillLines(report),
    ];
  }

  pickTemplate(skill) {
    if (SKILL_TEMPLATES[skill.name]) return SKILL_TEMPLATES[skill.name].replace('{skill}', skill.name);

    const template =
      this.templates.find((item) => item.category === skill.category) ??
      this.templates.find((item) => item.category === '*');
    const name = skill.category === SKILL_CATEGORIES.SOFT ? skill.name.toLowerCase() : skill.name;
    return template.text.replace('{skill}', name);
  }

  // Recruiters search by job title, so the resume should say it somewhere if it fits.
  suggestJobTitle() {
    const title = this.job.getCoreTitle();
    const words = title.split(/\s+/);
    if (!title || words.length > 5 || NOT_A_TITLE.test(title)) return [];

    const pattern = new RegExp(`(?<![a-z])${escapeRegExp(title).replace(/ /g, '[\\s-]+')}(?![a-z])`, 'i');
    if (pattern.test(this.resume.getFullText())) return [];

    return [
      new Suggestion({
        type: 'job-title',
        section: 'Summary',
        rewrittenText: `${title} with [N] years of experience in [your top 2–3 skills from this job].`,
        reason: `Recruiters often search by job title, and your resume never says "${title}". If the title fits you, use it in your headline or summary.`,
      }),
    ];
  }

  suggestSkillsLine(report) {
    const missing = report.missingSkills
      .filter((skill) => skill.category !== SKILL_CATEGORIES.SOFT)
      .map((skill) => skill.name);
    const skillsSection = this.sections.find((section) => section.key === 'skills');

    if (!skillsSection) {
      const names = [...report.matchedSkills.map((skill) => skill.name), ...missing];
      if (names.length === 0) return [];
      return [
        new Suggestion({
          type: 'structure',
          section: 'Skills',
          rewrittenText: `Skills: ${names.join(', ')}`,
          reason:
            'Your resume has no clear Skills heading. ATS tools look for one. List the skills you really have, spelled the way the job post spells them.',
        }),
      ];
    }

    if (missing.length === 0) return [];
    const toAdd = missing.slice(0, 6).join(', ');
    const reason =
      'The job asks for these skills, but your Skills section does not show them. Add only the ones you have really used, spelled the way the job post spells them.';

    // One skills line: show it with the skills added. A list or grid: just name what to add.
    if (skillsSection.lines.length === 1) {
      const original = skillsSection.lines[0].text;
      return [
        new Suggestion({
          type: 'add-skill',
          section: 'Skills',
          originalText: original,
          rewrittenText: `${original.replace(/[.,;]\s*$/, '')}, ${toAdd}`,
          reason,
        }),
      ];
    }

    return [new Suggestion({ type: 'add-skill', section: 'Skills', rewrittenText: toAdd, reason })];
  }

  suggestStrongVerbs() {
    const suggestions = [];

    for (const section of this.sections) {
      for (const line of section.lines) {
        if (suggestions.length >= MAX_WEAK_VERB_SUGGESTIONS) return suggestions;

        const rewrite = rewriteWeakOpener(line.text);
        if (!rewrite) continue;

        suggestions.push(
          new Suggestion({
            type: 'strong-verb',
            section: section.label,
            originalText: line.text,
            rewrittenText: rewrite.text,
            reason:
              rewrite.reason ??
              `"${rewrite.label}" lists a duty. Start with a strong action verb to show what you did. Change the verb if a better one fits.`,
          }),
        );
      }
    }

    return suggestions;
  }

  suggestMetrics() {
    const hasImpactSections = this.sections.some((section) => IMPACT_SECTIONS.includes(section.key));
    const suggestions = [];

    for (const section of this.sections) {
      if (hasImpactSections && !IMPACT_SECTIONS.includes(section.key)) continue;

      for (const line of section.lines) {
        if (suggestions.length >= MAX_METRIC_SUGGESTIONS) return suggestions;

        const words = line.text.split(/\s+/);
        const looksLikeBullet = /^[A-Z]/.test(line.text) && words.length >= 8 && !line.heading;
        if (!looksLikeBullet || CONTACT_LINE.test(line.text)) continue;
        if (/\d/.test(line.text) || rewriteWeakOpener(line.text)) continue;

        suggestions.push(
          new Suggestion({
            type: 'add-metric',
            section: section.label,
            originalText: line.text,
            rewrittenText: `${line.text.replace(/[.,;]\s*$/, '')}, resulting in [a real number: e.g. 30% faster, 2,000 users, 5 hours saved a week].`,
            reason:
              'This line has no numbers. One real result (a percent, a count, time or money saved) shows the size of your impact.',
          }),
        );
      }
    }

    return suggestions;
  }

  suggestNewSkillLines(report) {
    return report.missingSkills.slice(0, MAX_NEW_SKILL_SUGGESTIONS).map(
      (skill) =>
        new Suggestion({
          type: 'new-line',
          section: 'Experience',
          rewrittenText: this.pickTemplate(skill),
          reason: `The job ${skill.preferred ? 'lists' : 'asks for'} ${skill.name}${skill.preferred ? ' as nice to have' : ''}, but your resume does not mention it. If you have used it, add a line like this and fill in the brackets.`,
        }),
    );
  }
}

// Joins rows that belong to one bullet. Many PDFs draw bullets as shapes, so a
// new bullet and a wrapped row can look the same; see isWrappedRow for the rules.
function mergeWrappedLines(blocks) {
  if (blocks.length === 0) return [];

  const left = Math.min(...blocks.map((block) => block.x));
  const right = Math.max(...blocks.map((block) => block.x + block.width));
  const wrapEdge = right - (right - left) * 0.15;
  const lines = [];

  for (const block of blocks) {
    const startsWithBullet = BULLET.test(block.text);
    const text = block.text.replace(BULLET, '').trim();
    if (!text) continue;

    const previous = lines[lines.length - 1];
    if (previous && !startsWithBullet && isWrappedRow(previous, block, text, wrapEdge)) {
      previous.text = `${previous.text} ${text}`;
      previous.lastLine = block.line;
      previous.right = block.x + block.width;
    } else {
      lines.push({
        text,
        firstX: block.x,
        lastLine: block.line,
        right: block.x + block.width,
        heading: block.isHeading(),
      });
    }
  }

  return lines;
}

// A row continues the line above when it starts with a lowercase word, or when the
// line above is long, runs to the right edge and has not ended its sentence.
function isWrappedRow(previous, block, text, wrapEdge) {
  if (previous.lastLine === block.line || previous.heading || block.isHeading()) return false;
  if (block.x < previous.firstX - 3) return false;
  if (/^[a-z]/.test(text)) return true;

  return (
    Math.abs(block.x - previous.firstX) <= 3 &&
    !/[.!?:;]$/.test(previous.text) &&
    previous.text.split(/\s+/).length >= 6 &&
    previous.right >= wrapEdge
  );
}

export function rewriteWeakOpener(text) {
  const clean = text.replace(BULLET, '').trim();

  for (const opener of WEAK_OPENERS) {
    const match = clean.match(opener.pattern);
    if (!match) continue;

    const rest = clean.slice(match[0].length).trim();
    if (!rest) continue;

    const [firstWord, ...otherWords] = rest.split(/\s+/);
    const pastTense = toPastTense(firstWord);

    if (opener.verb) {
      if (!BASE_VERBS.has(firstWord.toLowerCase())) continue;
      return { label: opener.label, text: `${opener.verb} ${rest}` };
    }

    if (pastTense && opener.gerund === 'past') {
      return { label: opener.label, text: capitalize([pastTense, ...otherWords].join(' ')) };
    }

    const lead = pastTense ? opener.gerund : opener.noun;
    return { label: opener.label, text: `${lead} ${rest}` };
  }

  return rewriteIngOpener(clean);
}

// "Developing and enhancing X and integrating Y" -> "Developed and enhanced X and integrated Y".
function rewriteIngOpener(text) {
  const words = text.split(/\s+/);
  if (words.length < 5 || !/^[A-Z][a-z]+ing$/.test(words[0]) || NOUN_GERUNDS.has(words[0].toLowerCase())) {
    return null;
  }

  const first = toPastTense(words[0]);
  if (!first) return null;

  const rewritten = words.map((word, index) => {
    if (index === 0) return capitalize(first);
    const afterAnd = ['and', '&'].includes(words[index - 1]?.toLowerCase());
    return afterAnd && /^[a-z]+ing$/.test(word) ? (toPastTense(word) ?? word) : word;
  });

  return {
    label: words[0],
    text: rewritten.join(' '),
    reason: `Bullets that start with an "-ing" word ("${words[0]}…") read like a task list. Start with an action verb: past tense, or present tense ("Develop") for a job you are doing now.`,
  };
}

// "managing" -> "managed", "building" -> "built". Returns null if the word is not an -ing verb.
export function toPastTense(word) {
  const lower = word.toLowerCase().replace(/[^a-z]/g, '');
  if (IRREGULAR_PAST[lower]) return IRREGULAR_PAST[lower];
  if (!lower.endsWith('ing') || lower.length < 5 || NOT_GERUNDS.has(lower)) return null;

  const stem = lower.slice(0, -3);
  if (!/[aeiouy]/.test(stem)) return null;
  if (/[^aeiou]y$/.test(stem)) return `${stem.slice(0, -1)}ied`;
  return `${stem}ed`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
