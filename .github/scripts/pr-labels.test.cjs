'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { LABELS, TYPE_LABEL, labelsFor, sizeLabel } = require('./pr-labels.cjs')

const add = (title, info) => labelsFor(title, info).add

test('labels a PR from its Conventional Commit type', () => {
  assert.deepEqual(add('feat(web): add a thing', { lines: 5 }), ['feature', 'size/XS'])
  assert.deepEqual(add('fix: stop crashing', { lines: 5 }), ['fix', 'size/XS'])
  assert.deepEqual(add('docs: explain it', { lines: 5 }), ['documentation', 'size/XS'])
  assert.deepEqual(add('perf(agent): faster', { lines: 5 }), ['performance', 'size/XS'])
  assert.deepEqual(add('refactor: tidy', { lines: 5 }), ['refactor', 'size/XS'])
  assert.deepEqual(add('test: cover it', { lines: 5 }), ['test', 'size/XS'])
  assert.deepEqual(add('ci: speed up', { lines: 5 }), ['ci', 'size/XS'])
})

test('maps the less common types sensibly', () => {
  assert.equal(TYPE_LABEL.build, 'chore')
  assert.equal(TYPE_LABEL.style, 'chore')
  assert.equal(TYPE_LABEL.revert, 'fix')
})

test('a "!" marks a breaking change', () => {
  assert.deepEqual(add('feat(api)!: drop the old field', { lines: 5 }), ['feature', 'breaking', 'size/XS'])
})

test('dependency updates are labelled by scope or by author', () => {
  assert.deepEqual(add('chore(deps): Bump x from 1 to 2', { author: 'dependabot[bot]', lines: 4 }), ['chore', 'dependencies', 'size/XS'])
  assert.deepEqual(add('ci(deps): Bump actions/checkout', { lines: 4 }), ['ci', 'dependencies', 'size/XS'])
  assert.ok(add('Bump something', { author: 'dependabot[bot]' }).includes('dependencies'))
})

test('a title that is not Conventional gets only a size label (the CI title check rejects it separately)', () => {
  assert.deepEqual(add('Update stuff', { lines: 100 }), ['size/M'])
  assert.deepEqual(add('wip', { lines: 100 }), ['size/M'])
  assert.deepEqual(add('unknown(scope): hm', { lines: 100 }), ['size/M'])
})

test('size boundaries', () => {
  const cases = [[0, 'XS'], [9, 'XS'], [10, 'S'], [49, 'S'], [50, 'M'], [249, 'M'], [250, 'L'], [999, 'L'], [1000, 'XL'], [5000, 'XL']]
  for (const [n, s] of cases) assert.equal(sizeLabel(n), `size/${s}`, `${n} lines`)
})

test('everything it can add is a managed label, so stale ones can be removed', () => {
  const managed = new Set(LABELS.map((l) => l.name))
  const { add: a, managed: m } = labelsFor('feat(x)!: y', { author: 'dependabot[bot]', lines: 700 })
  for (const name of a) assert.ok(managed.has(name), name)
  assert.deepEqual(new Set(m), managed)
})

test('every label has a valid colour and a description', () => {
  for (const l of LABELS) {
    assert.match(l.color, /^[0-9a-f]{6}$/, l.name)
    assert.ok(l.description.length > 3, l.name)
  }
  assert.equal(new Set(LABELS.map((l) => l.name)).size, LABELS.length, 'unique names')
})

test('titles are matched case-insensitively on type and tolerate spaces', () => {
  assert.deepEqual(add('  Feat(web): x ', { lines: 1 }), ['feature', 'size/XS'])
})
