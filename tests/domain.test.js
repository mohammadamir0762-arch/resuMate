import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JobDescription } from '../src/domain/JobDescription.js';
import { MatchReport } from '../src/domain/MatchReport.js';
import { Page } from '../src/domain/Page.js';
import { ResumeDocument } from '../src/domain/ResumeDocument.js';
import { Skill } from '../src/domain/Skill.js';
import { Suggestion } from '../src/domain/Suggestion.js';
import { TextBlock } from '../src/domain/TextBlock.js';

const block = (id, text, line) => ({ id, text, line, x: 72, y: 700 - line * 16 });

test('TextBlock spots section headings', () => {
  assert.equal(new TextBlock({ id: 'a', text: 'EXPERIENCE' }).isHeading(), true);
  assert.equal(new TextBlock({ id: 'b', text: 'Work Experience' }).isHeading(), true);
  assert.equal(new TextBlock({ id: 'c', text: 'Built a dashboard for sales' }).isHeading(), false);
  assert.equal(new TextBlock({ id: 'd', text: 'AWS, GCP' }).isHeading(), false);
  assert.equal(new TextBlock({ id: 'e', text: 'Hi' }).toString(), 'Hi');
});

test('Page joins blocks on the same line with a gap and lines with newlines', () => {
  const page = new Page({
    pageNumber: 1,
    blocks: [block('b1', 'Engineer', 0), block('b2', '2022', 0), block('b3', 'Built things', 1)],
  });

  assert.equal(page.getBlockCount(), 3);
  assert.equal(page.getText(), 'Engineer   2022\nBuilt things');
});

test('ResumeDocument exposes pages, text and word count', () => {
  const resume = new ResumeDocument({
    fileName: 'cv.pdf',
    pages: [
      { pageNumber: 1, blocks: [block('p1-b1', 'Asha Verma', 0)] },
      { pageNumber: 2, blocks: [block('p2-b1', 'Node.js and C++', 0)] },
    ],
  });

  assert.equal(resume.getPageCount(), 2);
  assert.equal(resume.getPage(2).getText(), 'Node.js and C++');
  assert.equal(resume.getPage(9), null);
  assert.equal(resume.getFullText(), 'Asha Verma\n\nNode.js and C++');
  assert.equal(resume.getWordCount(), 5);
  assert.equal(resume.hasText(), true);
});

test('ResumeDocument splits blocks into sections', () => {
  const resume = new ResumeDocument({
    pages: [
      {
        pageNumber: 1,
        blocks: [
          block('b1', 'Asha Verma', 0),
          block('b2', 'SKILLS', 1),
          block('b3', 'React, CSS', 2),
          block('b4', 'Work Experience', 3),
          block('b5', 'Built a dashboard', 4),
        ],
      },
    ],
  });

  const sections = resume.getSections();
  assert.deepEqual(
    sections.map((section) => [section.key, section.blocks.map((item) => item.id)]),
    [
      ['header', ['b1']],
      ['skills', ['b3']],
      ['experience', ['b5']],
    ],
  );
  assert.equal(resume.getSectionLabelMap().get('b4'), 'Experience');
});

test('JobDescription reads a title and keywords', () => {
  const job = new JobDescription(
    'Job title: Data Analyst\nWe need strong SQL and dashboards. Dashboards for finance teams.',
  );

  assert.equal(job.title, 'Data Analyst');
  assert.equal(job.isEmpty(), false);
  assert.equal(job.getKeywords()[0], 'dashboards');
  assert.ok(!job.getKeywords().includes('strong'), 'filler words are dropped');
  assert.equal(new JobDescription('   ').isEmpty(), true);
});

test('Skill matches whole terms only', () => {
  const java = new Skill({ name: 'Java', category: 'Languages' });
  const js = new Skill({ name: 'JavaScript', terms: ['javascript', 'js'] });
  const cpp = new Skill({ name: 'C++', terms: ['c++', 'cpp'] });
  const ml = new Skill({ name: 'Machine Learning', terms: ['machine learning'] });

  assert.equal(java.foundIn('i write javascript'), false);
  assert.equal(java.foundIn('java, spring'), true);
  assert.equal(js.foundIn('node.js services'), false);
  assert.equal(js.foundIn('vanilla js.'), true);
  assert.equal(cpp.foundIn('modern c++ and rust'), true);
  assert.equal(ml.foundIn('machine-learning models'), true);
  assert.equal(cpp.matches('CPP'), true);
  assert.deepEqual(java.toJSON(), { name: 'Java', category: 'Languages', weight: 1 });
});

test('MatchReport levels follow the threshold', () => {
  assert.equal(new MatchReport({ score: 60 }).getLevel(), 'strong');
  assert.equal(new MatchReport({ score: 40 }).getLevel(), 'fair');
  assert.equal(new MatchReport({ score: 39 }).getLevel(), 'weak');
  assert.match(new MatchReport({ score: 90 }).getSummary(), /Strong match/);
});

test('MatchReport survives a JSON round trip with its suggestions', () => {
  const report = new MatchReport({ score: 72, jobTitle: 'Engineer', missingKeywords: ['Docker'] });
  report.addSuggestion({ section: 'Skills', rewrittenText: 'React, Docker' });

  const copy = MatchReport.fromJSON(JSON.parse(JSON.stringify(report.toJSON())));

  assert.equal(copy.getScore(), 72);
  assert.equal(copy.id, report.id);
  assert.ok(copy.generatedAt instanceof Date);
  assert.ok(copy.suggestions[0] instanceof Suggestion);
  assert.equal(copy.suggestions[0].apply(), 'React, Docker');
});

test('JobDescription skips company fluff and finds nice-to-have lines', () => {
  const job = new JobDescription(`Senior Backend Engineer – Payments
About us
FinStack helps small businesses in India get paid.

What you'll do
• Build services in Java or Kotlin

Nice to have
• Terraform
Experience with gRPC is a plus

Benefits
Health insurance
Flexible hours`);

  assert.equal(job.getCoreTitle(), 'Backend Engineer');
  assert.ok(!job.relevantText.includes('FinStack'), 'about us is dropped');
  assert.ok(!job.relevantText.includes('Health insurance'), 'benefits are dropped');
  assert.match(job.preferredText, /Terraform/);
  assert.match(job.preferredText, /gRPC/);
  assert.doesNotMatch(job.requiredText, /Terraform/);
  assert.deepEqual(job.getChoiceClauses().map((clause) => clause.trim()), ['• Build services in Java or Kotlin']);
});

test('JobDescription takes the first sentence of a one-line post as the title', () => {
  const job = new JobDescription('Junior Frontend Developer. React, TypeScript, CSS.');
  assert.equal(job.title, 'Junior Frontend Developer');
  assert.equal(job.getCoreTitle(), 'Frontend Developer');
});

test('TextBlock does not treat numbers or wrapped words as headings', () => {
  assert.equal(new TextBlock({ id: 'a', text: 'CGPA 8.6/10' }).isHeading(), false);
  assert.equal(new TextBlock({ id: 'b', text: 'EKS.' }).isHeading(), false);
  assert.equal(new TextBlock({ id: 'c', text: 'HTML5 & CSS3' }).isHeading(), false);
  assert.equal(new TextBlock({ id: 'd', text: 'CONTACT' }).isHeading(), true);
});

test('JobDescription finds the title below a company blurb', () => {
  const job = new JobDescription(
    "AVEVA's comprehensive portfolio helps industrial companies run safer and greener operations.\n\nSoftware Engineer Intern\nLocation: Hyderabad\nWhat you will do\n- Build features in C# and .NET",
  );
  assert.equal(job.title, 'Software Engineer Intern');
  assert.equal(job.getCoreTitle(), 'Software Engineer');
});
