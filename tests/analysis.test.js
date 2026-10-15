import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Analyzer } from '../src/analysis/Analyzer.js';
import { MatchEngine } from '../src/analysis/MatchEngine.js';
import { RewriteSuggester, rewriteWeakOpener, toPastTense } from '../src/analysis/RewriteSuggester.js';
import { SkillExtractor } from '../src/analysis/SkillExtractor.js';
import { JobDescription } from '../src/domain/JobDescription.js';
import { ResumeDocument } from '../src/domain/ResumeDocument.js';
import { SAMPLE_JOB_DESCRIPTION, SAMPLE_RESUME_LINES } from './fixtures/sampleResume.js';

// Builds a ResumeDocument the way the PDF worker would, one block per fixture line.
function resumeFromLines(lines) {
  const rows = [...new Set(lines.map((line) => line.y))];
  return new ResumeDocument({
    fileName: 'asha.pdf',
    pages: [
      {
        pageNumber: 1,
        blocks: lines.map((line, index) => ({
          id: `p1-b${index + 1}`,
          text: line.text,
          x: line.x,
          y: line.y,
          line: rows.indexOf(line.y),
        })),
      },
    ],
  });
}

function textResume(text) {
  return resumeFromLines(text.split('\n').map((line, index) => ({ x: 72, y: 700 - index * 16, text: line })));
}

function analyze(resume, jobText) {
  const job = new JobDescription(jobText);
  const engine = new MatchEngine();
  engine.analyze(resume, job);
  const report = engine.buildReport();
  const suggester = new RewriteSuggester();
  suggester.analyze(resume, job);
  for (const suggestion of suggester.suggest(report)) report.addSuggestion(suggestion);
  return { engine, report };
}

test('Analyzer is abstract', () => {
  assert.throws(() => new Analyzer(), /abstract/);

  class Empty extends Analyzer {}
  assert.throws(() => new Empty().analyze(), /must implement analyze/);
  assert.equal(new Empty().normalize('Testing,'), 'test');
});

test('SkillExtractor finds skills by any of their spellings', () => {
  const names = new SkillExtractor()
    .extractSkills('Built REST APIs in Node.js and Postgres; CI/CD with GitHub Actions, k8s.')
    .map((skill) => skill.name);

  for (const name of ['REST APIs', 'Node.js', 'PostgreSQL', 'CI/CD', 'GitHub Actions', 'Kubernetes', 'GitHub']) {
    assert.ok(names.includes(name), `expected ${name}`);
  }
  assert.ok(!names.includes('JavaScript'), 'node.js is not plain JavaScript');
});

test('MatchEngine gives 100 when the resume has everything the job asks for', () => {
  const { report } = analyze(
    textResume('React developer\nSKILLS\nReact, TypeScript, Docker\nBuilt dashboards for finance'),
    'React and TypeScript developer. Docker. Dashboards for finance.',
  );
  assert.equal(report.getScore(), 100);
  assert.deepEqual(report.missingKeywords, []);
});

test('MatchEngine scores low when nothing overlaps', () => {
  const { report } = analyze(textResume('Pastry chef. Croissants and bread.'), 'Kubernetes, Terraform and AWS engineer');
  assert.equal(report.getScore(), 0);
  assert.equal(report.getLevel(), 'weak');
});

test('MatchEngine lists missing skills before missing keywords', () => {
  const { engine, report } = analyze(resumeFromLines(SAMPLE_RESUME_LINES), SAMPLE_JOB_DESCRIPTION);
  const missing = engine.findMissingKeywords();

  assert.ok(report.getScore() > 0 && report.getScore() < 60, `score was ${report.getScore()}`);
  assert.deepEqual(
    report.matchedSkills.map((skill) => skill.name).sort(),
    ['CSS', 'HTML', 'JavaScript', 'React', 'Teamwork'],
  );
  assert.ok(missing.indexOf('TypeScript') < missing.indexOf('Communication'));
  assert.ok(report.matchedKeywords.includes('dashboard'));
  assert.ok(!missing.includes('accessible'), 'a form of the Accessibility skill is not counted twice');
  assert.equal(report.breakdown.skillsWanted, report.matchedSkills.length + report.missingSkills.length);
});

test('MatchEngine needs analyze() first and handles an empty job', () => {
  assert.throws(() => new MatchEngine().computeScore(), /analyze\(\)/);

  const engine = new MatchEngine();
  engine.analyze(textResume('React'), new JobDescription(''));
  assert.equal(engine.computeScore(), 0);
});

test('toPastTense turns -ing words into past tense', () => {
  assert.equal(toPastTense('managing'), 'managed');
  assert.equal(toPastTense('building'), 'built');
  assert.equal(toPastTense('planning'), 'planned');
  assert.equal(toPastTense('applying'), 'applied');
  assert.equal(toPastTense('deploying'), 'deployed');
  assert.equal(toPastTense('string'), null);
  assert.equal(toPastTense('dashboard'), null);
});

test('rewriteWeakOpener rewrites duty-style openers', () => {
  assert.equal(rewriteWeakOpener('• Responsible for managing a team of 5').text, 'Managed a team of 5');
  assert.equal(rewriteWeakOpener('Responsible for the payment service').text, 'Owned the payment service');
  assert.equal(rewriteWeakOpener('Worked with designers on onboarding').text, 'Collaborated with designers on onboarding');
  assert.equal(
    rewriteWeakOpener('Helped migrate the build to Vite').text,
    'Partnered with the team to migrate the build to Vite',
  );
  assert.equal(rewriteWeakOpener('Helped customers on calls'), null, 'skips rewrites that would read badly');
  assert.equal(rewriteWeakOpener('Built a dashboard'), null);
});

test('RewriteSuggester covers skills, verbs, numbers and new lines', () => {
  const { report } = analyze(resumeFromLines(SAMPLE_RESUME_LINES), SAMPLE_JOB_DESCRIPTION);
  const byType = (type) => report.suggestions.filter((suggestion) => suggestion.type === type);

  const [skillsLine] = byType('add-skill');
  assert.equal(skillsLine.originalText, 'JavaScript, React, HTML, CSS, Node.js, Git, Figma');
  assert.match(skillsLine.rewrittenText, /Figma, TypeScript/);

  assert.deepEqual(
    byType('strong-verb').map((suggestion) => suggestion.apply()),
    [
      'Built reusable UI components for the customer dashboard',
      'Delivered the checkout page and improved load time by 40%',
      'Partnered with the team to migrate the frontend build from Webpack to Vite',
    ],
  );

  const metricLines = byType('add-metric').map((suggestion) => suggestion.originalText);
  assert.ok(
    metricLines.includes(
      'Collaborated with designers in Figma to ship new onboarding screens for mobile and desktop users',
    ),
    'joins a bullet that wraps onto the next line',
  );
  assert.ok(byType('add-metric').every((suggestion) => ['Experience', 'Projects'].includes(suggestion.section)));

  assert.equal(byType('new-line').length, 4);
  assert.match(byType('new-line')[0].rewrittenText, /TypeScript/);
});

test('RewriteSuggester asks for a Skills section when there is none', () => {
  const { report } = analyze(textResume('Asha Verma\nBuilt React apps'), 'React and Docker developer');
  const [structure] = report.suggestions.filter((suggestion) => suggestion.type === 'structure');

  assert.equal(structure.rewrittenText, 'Skills: React, Docker');
  assert.throws(() => new RewriteSuggester().suggest(report), /analyze\(\)/);
});

test('pickTemplate uses the skill category', () => {
  const suggester = new RewriteSuggester();
  assert.match(suggester.pickTemplate({ name: 'Docker', category: 'Cloud & DevOps' }), /Automated .* with Docker/);
  assert.match(suggester.pickTemplate({ name: 'Negotiation', category: 'Soft skills' }), /Showed negotiation/);
  assert.match(suggester.pickTemplate({ name: 'Leadership', category: 'Soft skills' }), /Led a team of \[N\]/);
  assert.match(suggester.pickTemplate({ name: 'Cobol', category: 'Unknown' }), /Used Cobol/);
});

test('MatchEngine does not ask for one choice when the resume has another', () => {
  const { report } = analyze(
    textResume('SKILLS\nJava, Spring Boot\nBackend engineer who builds services'),
    'Backend Engineer\nWhat you will do\n- Build services in Java or Kotlin with Spring Boot',
  );
  assert.ok(!report.missingSkills.some((skill) => skill.name === 'Kotlin'));
  assert.equal(report.getScore(), 100);
});

test('MatchEngine counts nice-to-have skills for less and marks them', () => {
  const job = 'Backend Engineer\nRequirements\n- Java and Docker\n\nNice to have\n- Terraform';
  const withoutExtra = analyze(textResume('Backend engineer\nJava, Docker'), job).report;
  const missingRequired = analyze(textResume('Backend engineer\nJava, Terraform'), job).report;

  assert.equal(withoutExtra.missingSkills[0].name, 'Terraform');
  assert.equal(withoutExtra.missingSkills[0].preferred, true);
  assert.ok(withoutExtra.getScore() > missingRequired.getScore());
});

test('RewriteSuggester suggests the job title when the resume never uses it', () => {
  const { report } = analyze(textResume('Asha Verma\nSKILLS\nSQL, Python'), 'Data Analyst, Growth\nSQL and Python');
  const [title] = report.suggestions.filter((suggestion) => suggestion.type === 'job-title');
  assert.match(title.rewrittenText, /^Data Analyst with \[N\] years/);

  const { report: hasTitle } = analyze(textResume('Data analyst\nSKILLS\nSQL, Python'), 'Data Analyst, Growth\nSQL and Python');
  assert.ok(!hasTitle.suggestions.some((suggestion) => suggestion.type === 'job-title'));
});

test('RewriteSuggester joins a long row with its capitalized wrap and skips contact lines', () => {
  const resume = resumeFromLines([
    { x: 72, y: 700, text: 'EXPERIENCE' },
    { x: 72, y: 684, text: 'Worked on the migration of fourteen services from EC2 to Kubernetes on AWS' },
    { x: 72, y: 668, text: 'EKS.' },
    { x: 72, y: 652, text: 'Mentored new engineers.' },
    { x: 72, y: 636, text: 'Reach me at asha@example.com or on LinkedIn for any questions about this work' },
  ]);
  resume.pages[0].blocks.forEach((block) => {
    block.width = block.text.length * 5.5;
  });
  const { report } = analyze(resume, 'Engineer with Kubernetes');

  const [verb] = report.suggestions.filter((suggestion) => suggestion.type === 'strong-verb');
  assert.equal(verb.originalText, 'Worked on the migration of fourteen services from EC2 to Kubernetes on AWS EKS.');
  assert.ok(!report.suggestions.some((suggestion) => suggestion.originalText.includes('@')));
});

test('rewriteWeakOpener turns -ing bullets into action verbs', () => {
  assert.equal(
    rewriteWeakOpener('– Developing and enhancing web features using Node.js and MongoDB.').text,
    'Developed and enhanced web features using Node.js and MongoDB.',
  );
  assert.equal(
    rewriteWeakOpener('Building responsive interfaces and integrating RESTful APIs for data flow.').text,
    'Built responsive interfaces and integrated RESTful APIs for data flow.',
  );
  assert.equal(rewriteWeakOpener('Marketing analytics dashboard for the sales team'), null, 'noun phrases stay');
  assert.equal(rewriteWeakOpener('Building apps'), null, 'too short to be a bullet');
});

test('MatchEngine ranks missing skills by the points they would add', () => {
  const job = 'Backend Engineer\nRequirements\n- Java, Docker and Kubernetes\n- Good communication\n\nNice to have\n- Terraform';
  const { engine, report } = analyze(textResume('Backend engineer\nJava'), job);
  const wins = engine.findBiggestWins();

  assert.deepEqual(
    wins.map((win) => win.name),
    ['Docker', 'Kubernetes', 'Terraform', 'Communication'],
    'required skills first, then nice-to-have and soft skills',
  );
  assert.ok(wins.every((win) => win.points > 0));
  assert.equal(report.biggestWins[0].points, wins[0].points);
  assert.equal(report.scoreWithAllSkills, 100);
});

test('ResumeBuilder rebuilds the resume and applies the picked suggestions', async () => {
  const { ResumeBuilder } = await import('../src/analysis/ResumeBuilder.js');
  const { parseResumeText, countPlaceholders } = await import('../src/lib/resumeText.js');
  const resume = resumeFromLines(SAMPLE_RESUME_LINES);
  const { report } = analyze(resume, SAMPLE_JOB_DESCRIPTION);
  const builder = new ResumeBuilder(resume);

  const plain = builder.toText();
  assert.match(plain, /^Asha Verma\n/);
  assert.match(plain, /\nEXPERIENCE\nSoftware Engineer, Brightpath Labs \| Jan 2022 - Present\n• Responsible for building/);

  const picked = report.suggestions.filter((suggestion) => ['strong-verb', 'add-skill', 'new-line'].includes(suggestion.type));
  const updated = builder.toText(picked.slice(0, 3).concat(picked.filter((item) => item.type === 'new-line').slice(0, 1)));
  assert.match(updated, /• Built reusable UI components for the customer dashboard/);
  assert.doesNotMatch(updated, /Responsible for building/);
  assert.match(updated, /JavaScript, React, HTML, CSS, Node\.js, Git, Figma, TypeScript/);
  assert.ok(countPlaceholders(updated) > 0, 'a new-line idea brings [placeholders]');

  const parsed = parseResumeText(updated);
  assert.equal(parsed.name, 'Asha Verma');
  assert.equal(parsed.contact.length, 1);
  assert.ok(parsed.blocks.some((block) => block.type === 'heading' && block.text === 'EXPERIENCE'));
  assert.ok(parsed.blocks.some((block) => block.type === 'bullet' && block.text.startsWith('Built reusable')));
});
