import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLayoutBlocks, buildPageLayout, collapseLetterSpacing, groupIntoRows } from '../src/parser/layout.js';

const item = (str, x, y, width = str.length * 5, height = 10) => ({
  str,
  transform: [height, 0, 0, height, x, y],
  width,
  height,
});

test('groups items on the same baseline into one row, left to right', () => {
  const rows = groupIntoRows([
    { text: 'World', x: 60, y: 700 },
    { text: 'Hello', x: 10, y: 702 },
    { text: 'Below', x: 10, y: 680 },
  ]);

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows[0].items.map((entry) => entry.text),
    ['Hello', 'World'],
  );
});

test('orders blocks from top to bottom and numbers them per page', () => {
  const blocks = buildLayoutBlocks([item('Second', 10, 600), item('First', 10, 700)], 2);

  assert.deepEqual(
    blocks.map((block) => [block.id, block.text]),
    [
      ['p2-b1', 'First'],
      ['p2-b2', 'Second'],
    ],
  );
});

test('splits a row at a wide gap so columns and dates become separate blocks', () => {
  const blocks = buildLayoutBlocks(
    [item('Software Engineer', 72, 500, 90), item('Jan 2022 - Present', 460, 500, 90)],
    1,
  );

  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].line, blocks[1].line);
  assert.equal(blocks[1].x, 460);
});

test('joins word pieces that touch without adding a space', () => {
  const blocks = buildLayoutBlocks([item('Java', 10, 500, 20), item('Script', 30, 500, 30)], 1);
  assert.equal(blocks[0].text, 'JavaScript');
});

test('adds a space when there is a visible gap between items', () => {
  const blocks = buildLayoutBlocks([item('Hello', 10, 500, 25), item('there', 38, 500, 25)], 1);
  assert.equal(blocks[0].text, 'Hello there');
});

test('skips empty items and keeps block size', () => {
  const blocks = buildLayoutBlocks(
    [item('   ', 10, 500), item('Skills', 10, 480, 40, 14), item('', 10, 470)],
    1,
  );

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].width, 40);
  assert.equal(blocks[0].height, 14);
});

test('joins spaced-out letters back into words', () => {
  assert.equal(collapseLetterSpacing('E X P E R I E N C E'), 'EXPERIENCE');
  assert.equal(collapseLetterSpacing('C O N TA C T'), 'CONTACT');
  assert.equal(collapseLetterSpacing('Built a tool'), null);

  // One item per letter, with a wider gap between words.
  const letters = 'ABOUT ME'.split('').reduce(
    (state, char) => {
      if (char === ' ') return { ...state, x: state.x + 10 };
      return { x: state.x + 14, items: [...state.items, item(char, state.x, 600, 8, 11)] };
    },
    { x: 50, items: [] },
  ).items;
  // A spaced word as one item, then the next word after a big gap.
  const spacedWords = [item('A A R A V', 50, 700, 110, 26), item('N A I R', 185, 700, 80, 26)];

  assert.deepEqual(
    buildLayoutBlocks([...spacedWords, ...letters], 1).map((block) => block.text),
    ['AARAV NAIR', 'ABOUT ME'],
  );
});

test('reads a two-column page one column at a time', () => {
  const sidebar = ['SKILLS', 'Java and Spring Boot', 'Python and Flask', 'Docker and Kubernetes', 'PostgreSQL and Redis', 'AWS and Terraform', 'Git and Jenkins', 'English and Hindi'];
  const main = ['EXPERIENCE', 'Built payment services in Java for two million daily events', 'Cut API latency from 480 ms to 120 ms with caching', 'Moved fourteen services to Kubernetes on AWS last year', 'Mentored three junior engineers on the payments team', 'Wrote clear docs for internal APIs and onboarding'];
  const items = [item('Priya Sharma', 40, 760, 120, 20)];
  sidebar.forEach((text, index) => items.push(item(text, 40, 700 - index * 16, 140)));
  main.forEach((text, index) => items.push(item(text, 220, 700 - index * 16, 330)));

  const { blocks, columnSplit } = buildPageLayout(items, 1);

  assert.equal(columnSplit, 220);
  assert.deepEqual(
    blocks.slice(0, 3).map((block) => block.text),
    ['Priya Sharma', 'SKILLS', 'Java and Spring Boot'],
  );
  assert.equal(blocks[9].text, 'EXPERIENCE');
  assert.equal(blocks[9].column, 'right');
});

test('right-aligned dates in a one-column resume are not a second column', () => {
  const items = [];
  for (let index = 0; index < 4; index += 1) {
    const y = 700 - index * 60;
    items.push(item('Software Engineer, Some Company', 72, y, 180), item('2020 - 2022', 470, y, 60));
    items.push(item('Built and shipped many features for customers across several product teams', 72, y - 16, 460));
  }
  assert.equal(buildPageLayout(items, 1).columnSplit, null);
});

test('drops icon-font names and stacked copies of the same text', () => {
  const blocks = buildLayoutBlocks(
    [
      item('Phone-Alt', 40, 720, 10, 10),
      item('+91 98765 43210', 52, 720, 70, 10),
      item('Source Code', 374.4, 300, 63, 11),
      item('Source Code', 374.7, 299.8, 63, 11),
      item('Source Code', 375.1, 299.5, 63, 11),
    ],
    1,
  );

  assert.deepEqual(
    blocks.map((block) => block.text),
    ['+91 98765 43210', 'Source Code'],
  );
});
