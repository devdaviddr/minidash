'use strict'
// Works out which labels a pull request should have from its Conventional Commit title and its size.
// Pure functions so they can be tested; the workflow (pr-labels.yml) does the GitHub calls.

/** Every label this automation manages, with the colour and description used when it has to create one. */
const LABELS = [
  { name: 'feature', color: '1f883d', description: 'New functionality' },
  { name: 'fix', color: 'd1242f', description: 'Bug fix' },
  { name: 'performance', color: 'fb8500', description: 'Speed or resource use' },
  { name: 'refactor', color: '8250df', description: 'Code change that neither fixes a bug nor adds a feature' },
  { name: 'documentation', color: '0075ca', description: 'Improvements or additions to documentation' },
  { name: 'test', color: '1b7c83', description: 'Adding or improving tests' },
  { name: 'ci', color: '6e7781', description: 'CI and build configuration' },
  { name: 'chore', color: '8c959f', description: 'Maintenance' },
  { name: 'dependencies', color: '0366d6', description: 'Dependency updates' },
  { name: 'breaking', color: 'b60205', description: 'Breaking change' },
  { name: 'release', color: 'ededed', description: 'Release or merge-back PR; left out of release notes' },
  { name: 'size/XS', color: 'c2e0c6', description: 'Under 10 lines changed' },
  { name: 'size/S', color: 'bfdadc', description: '10 to 49 lines changed' },
  { name: 'size/M', color: 'fef2c0', description: '50 to 249 lines changed' },
  { name: 'size/L', color: 'f9d0c4', description: '250 to 999 lines changed' },
  { name: 'size/XL', color: 'e99695', description: '1000 or more lines changed' },
]

/** Conventional Commit type -> label. */
const TYPE_LABEL = {
  feat: 'feature',
  fix: 'fix',
  revert: 'fix',
  perf: 'performance',
  refactor: 'refactor',
  docs: 'documentation',
  test: 'test',
  ci: 'ci',
  build: 'chore',
  chore: 'chore',
  style: 'chore',
}

const TITLE = /^(\w+)(?:\(([^)]*)\))?(!)?: .+/

/** Size label for a count of changed lines (generated files should already be excluded). */
function sizeLabel(lines) {
  if (lines < 10) return 'size/XS'
  if (lines < 50) return 'size/S'
  if (lines < 250) return 'size/M'
  if (lines < 1000) return 'size/L'
  return 'size/XL'
}

/**
 * @param {string} title  the PR title
 * @param {{ author?: string, lines?: number }} info
 * @returns {{ add: string[], managed: string[] }} labels to have, and every label this automation owns
 *   (so stale ones can be removed when a title is edited)
 */
function labelsFor(title, { author = '', lines = 0 } = {}) {
  const add = []
  const m = TITLE.exec(title.trim())
  if (m) {
    const [, type, scope, bang] = m
    const label = TYPE_LABEL[type.toLowerCase()]
    if (label) add.push(label)
    if (bang) add.push('breaking')
    if (scope === 'deps' || /dependabot/i.test(author)) add.push('dependencies')
    // Git Flow release and merge-back PRs (`chore(release): 0.5.0`) carry no change of their own.
    if (scope === 'release') add.push('release')
  } else if (/dependabot/i.test(author)) {
    add.push('dependencies')
  }
  add.push(sizeLabel(lines))
  return { add: [...new Set(add)], managed: LABELS.map((l) => l.name) }
}

module.exports = { LABELS, TYPE_LABEL, labelsFor, sizeLabel }
