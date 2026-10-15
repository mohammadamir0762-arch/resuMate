import { MatchReport } from '../domain/MatchReport.js';
import { tokenize } from '../lib/text.js';
import { Analyzer } from './Analyzer.js';
import { SkillExtractor } from './SkillExtractor.js';

// Skills count for more than plain keywords because they are what recruiters filter on.
const DEFAULT_WEIGHTS = { skills: 0.7, keywords: 0.3 };
const MAX_KEYWORDS = 20;
// Skills that only appear under "nice to have" count half.
const PREFERRED_FACTOR = 0.5;
// With only a few keywords, one word should not swing the score much.
const FULL_KEYWORD_WEIGHT_AT = 5;

export class MatchEngine extends Analyzer {
  constructor({
    skillExtractor = new SkillExtractor(),
    weights = DEFAULT_WEIGHTS,
    threshold = 0.6,
    ...config
  } = {}) {
    super(config);
    this.skillExtractor = skillExtractor;
    this.weights = new Map(Object.entries(weights));
    this.threshold = threshold;
    this.result = null;
  }

  analyze(resume, job) {
    const { resumeSkills, jobSkills: allJobSkills } = this.skillExtractor.analyze(resume, job);
    const resumeSkillNames = new Set(resumeSkills.map((skill) => skill.name));

    // "Java or Kotlin": if the resume has one of the choices, the others are not needed.
    const notNeeded = new Set();
    for (const clause of job.getChoiceClauses?.() ?? []) {
      const choices = this.skillExtractor.extractSkills(clause).map((skill) => skill.name);
      if (choices.length >= 2 && choices.some((name) => resumeSkillNames.has(name))) {
        choices.filter((name) => !resumeSkillNames.has(name)).forEach((name) => notNeeded.add(name));
      }
    }
    const jobSkills = allJobSkills.filter((skill) => !notNeeded.has(skill.name));

    // A skill is "preferred" when it shows up only in the nice-to-have part of the post.
    const requiredNames = new Set(
      this.skillExtractor.extractSkills(job.requiredText ?? job.rawText).map((skill) => skill.name),
    );
    const preferredNames = new Set(
      jobSkills.filter((skill) => !requiredNames.has(skill.name)).map((skill) => skill.name),
    );
    const weightOf = (skill) => skill.weight * (preferredNames.has(skill.name) ? PREFERRED_FACTOR : 1);

    // Words that are already part of a skill name should not be counted twice.
    const skillWords = new Set(
      allJobSkills
        .flatMap((skill) => skill.terms.flatMap((term) => [term, ...term.split(/[\s-]+/)]))
        .map((word) => this.normalize(word)),
    );
    // Also skip other forms of a skill word, like "accessible" for "Accessibility".
    const coveredBySkill = (word) =>
      skillWords.has(word) || [...skillWords].some((skillWord) => isSameWordFamily(word, skillWord));
    const resumeWords = new Set(tokenize(resume.getFullText()).map((token) => this.normalize(token)));
    const keywords = job
      .getKeywords()
      .filter((keyword) => !coveredBySkill(this.normalize(keyword)))
      .slice(0, MAX_KEYWORDS);

    this.result = {
      resume,
      job,
      resumeSkills,
      jobSkills,
      preferredNames,
      weightOf,
      matchedSkills: jobSkills.filter((skill) => resumeSkillNames.has(skill.name)),
      missingSkills: jobSkills
        .filter((skill) => !resumeSkillNames.has(skill.name))
        .sort((left, right) => weightOf(right) - weightOf(left)),
      keywords,
      matchedKeywords: keywords.filter((keyword) => resumeWords.has(this.normalize(keyword))),
      missingKeywords: keywords.filter((keyword) => !resumeWords.has(this.normalize(keyword))),
    };
    return this.result;
  }

  // 0-100. Only the parts the job description actually has are counted.
  computeScore() {
    const result = this.requireResult();
    return this.scoreFor(result.matchedSkills);
  }

  // How many points each missing skill would add on its own, biggest first.
  findBiggestWins(limit = 5) {
    const result = this.requireResult();
    const current = this.computeScore();

    return result.missingSkills
      .map((skill) => ({
        ...this.describeSkill(skill),
        points: this.scoreFor([...result.matchedSkills, skill]) - current,
      }))
      .filter((win) => win.points > 0)
      .sort((left, right) => right.points - left.points)
      .slice(0, limit);
  }

  // The score if the resume had exactly these job skills (keywords stay as they are).
  scoreFor(matchedSkills) {
    const result = this.requireResult();
    const skillTotal = sum(result.jobSkills.map(result.weightOf));
    const parts = [];

    if (skillTotal > 0) {
      parts.push({
        value: sum(matchedSkills.map(result.weightOf)) / skillTotal,
        weight: this.weights.get('skills'),
      });
    }
    if (result.keywords.length > 0) {
      const share = Math.min(1, result.keywords.length / FULL_KEYWORD_WEIGHT_AT);
      parts.push({
        value: result.matchedKeywords.length / result.keywords.length,
        weight: this.weights.get('keywords') * share,
      });
    }

    const weightTotal = sum(parts.map((part) => part.weight));
    if (weightTotal === 0) return 0;
    return Math.round((100 * sum(parts.map((part) => part.value * part.weight))) / weightTotal);
  }

  // Missing skills first (most important first), then plain keywords.
  findMissingKeywords() {
    const result = this.requireResult();
    return [...new Set([...result.missingSkills.map((skill) => skill.name), ...result.missingKeywords])];
  }

  buildReport() {
    const result = this.requireResult();

    return new MatchReport({
      score: this.computeScore(),
      resumeName: result.resume.fileName,
      jobTitle: result.job.title,
      threshold: this.threshold,
      matchedSkills: result.matchedSkills.map((skill) => this.describeSkill(skill)),
      missingSkills: result.missingSkills.map((skill) => this.describeSkill(skill)),
      matchedKeywords: result.matchedKeywords,
      missingKeywords: this.findMissingKeywords(),
      biggestWins: this.findBiggestWins(),
      scoreWithAllSkills: this.scoreFor(result.jobSkills),
      breakdown: {
        skillsMatched: result.matchedSkills.length,
        skillsWanted: result.jobSkills.length,
        keywordsMatched: result.matchedKeywords.length,
        keywordsWanted: result.keywords.length,
        resumeSkills: result.resumeSkills.length,
      },
    });
  }

  describeSkill(skill) {
    return { ...skill.toJSON(), preferred: this.result.preferredNames.has(skill.name) };
  }

  requireResult() {
    if (!this.result) throw new Error('Call analyze() before reading results.');
    return this.result;
  }
}

// True when two words share a long start, e.g. "accessibl(e)" and "accessibility".
function isSameWordFamily(left, right) {
  const shorter = Math.min(left.length, right.length);
  let shared = 0;
  while (shared < shorter && left[shared] === right[shared]) shared += 1;
  return shared >= 6 && shared >= shorter * 0.8;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
