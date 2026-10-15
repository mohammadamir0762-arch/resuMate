import { Skill } from '../domain/Skill.js';
import { Analyzer } from './Analyzer.js';
import { SKILL_DICTIONARY } from './skillDictionary.js';

export class SkillExtractor extends Analyzer {
  constructor(config = {}) {
    super(config);
    this.dictionary = new Map();

    for (const entry of config.skills ?? SKILL_DICTIONARY) {
      const skill = entry instanceof Skill ? entry : new Skill(entry);
      this.dictionary.set(skill.name, skill);
    }
  }

  analyze(resume, job) {
    return {
      resumeSkills: this.extractSkills(resume.getFullText()),
      jobSkills: this.extractSkills(job.relevantText ?? job.rawText),
    };
  }

  extractSkills(text) {
    if (!text) return [];
    const prepared = this.tokenize(text).join(' ');
    return [...this.dictionary.values()].filter((skill) => skill.foundIn(prepared));
  }

  // Lowercases the text and drops bullets, pipes and other noise between words.
  tokenize(text) {
    return String(text).toLowerCase().match(/[a-z0-9+#./-]+/g) ?? [];
  }
}
