import { createId } from '../lib/text.js';
import { Suggestion } from './Suggestion.js';

export class MatchReport {
  constructor({
    id = createId('report'),
    score = 0,
    generatedAt = new Date(),
    resumeName = '',
    jobTitle = '',
    threshold = 0.6,
    matchedSkills = [],
    missingSkills = [],
    matchedKeywords = [],
    missingKeywords = [],
    breakdown = {},
    suggestions = [],
    inputKey = '',
    biggestWins = [],
    scoreWithAllSkills = null,
  } = {}) {
    this.id = id;
    this.score = score;
    this.generatedAt = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
    this.resumeName = resumeName;
    this.jobTitle = jobTitle;
    this.threshold = threshold;
    this.matchedSkills = matchedSkills;
    this.missingSkills = missingSkills;
    this.matchedKeywords = matchedKeywords;
    this.missingKeywords = missingKeywords;
    this.breakdown = breakdown;
    // Identifies the resume + job pair, so re-running it replaces the old saved report.
    this.inputKey = inputKey;
    // Missing skills ranked by how many points each would add: [{ name, points, preferred }].
    this.biggestWins = biggestWins;
    this.scoreWithAllSkills = scoreWithAllSkills;
    this.suggestions = suggestions.map((item) =>
      item instanceof Suggestion ? item : new Suggestion(item),
    );
  }

  getScore() {
    return this.score;
  }

  // "strong" at or above the threshold, "fair" up to 20 points below it, otherwise "weak".
  getLevel() {
    const strongAt = Math.round(this.threshold * 100);
    if (this.score >= strongAt) return 'strong';
    if (this.score >= strongAt - 20) return 'fair';
    return 'weak';
  }

  getSummary() {
    const level = this.getLevel();
    if (level === 'strong') {
      return 'Strong match. Your resume covers most of what this job asks for.';
    }
    if (level === 'fair') {
      return 'Fair match. Add the missing skills you really have, and use the job’s own words.';
    }
    return 'Weak match. The resume and the job use very different skills and words.';
  }

  addSuggestion(suggestion) {
    this.suggestions.push(suggestion instanceof Suggestion ? suggestion : new Suggestion(suggestion));
  }

  toJSON() {
    return {
      id: this.id,
      score: this.score,
      generatedAt: this.generatedAt.toISOString(),
      resumeName: this.resumeName,
      jobTitle: this.jobTitle,
      threshold: this.threshold,
      matchedSkills: this.matchedSkills,
      missingSkills: this.missingSkills,
      matchedKeywords: this.matchedKeywords,
      missingKeywords: this.missingKeywords,
      breakdown: this.breakdown,
      inputKey: this.inputKey,
      biggestWins: this.biggestWins,
      scoreWithAllSkills: this.scoreWithAllSkills,
      suggestions: this.suggestions.map((suggestion) => suggestion.toJSON()),
    };
  }

  static fromJSON(data) {
    return new MatchReport(data);
  }
}
