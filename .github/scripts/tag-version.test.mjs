import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const script = fileURLToPath(new URL('./tag-version.mjs', import.meta.url))

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'nyx-version-tag-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const repo = join(root, 'repo')
  const remote = join(root, 'origin.git')
  mkdirSync(repo)
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  git('init', '--initial-branch=main')
  git('config', 'user.name', 'Tagging test')
  git('config', 'user.email', 'test@example.invalid')
  git('config', 'commit.gpgsign', 'false')
  git('init', '--bare', remote)
  git('remote', 'add', 'origin', remote)

  const commit = (version, extra = {}) => {
    writeFileSync(
      join(repo, 'package.json'),
      JSON.stringify({ version, ...extra }),
    )
    git('add', 'package.json')
    git('commit', '--allow-empty', '-m', 'Update package')
    return git('rev-parse', 'HEAD')
  }
  const run = (before, after) =>
    spawnSync(process.execPath, [script], {
      cwd: repo,
      encoding: 'utf8',
      env: {
        ...process.env,
        BEFORE_SHA: before,
        GITHUB_SHA: after,
        GITHUB_STEP_SUMMARY: '',
      },
    })
  const tags = () => git('ls-remote', '--tags', 'origin')
  return { git, commit, run, tags, remote }
}

test('demo-only changes skip even when the current version has no tag', (t) => {
  const f = fixture(t)
  const before = f.commit('1.2.0')
  const after = f.commit('1.2.0')
  const result = f.run(before, after)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /version is unchanged/)
  assert.equal(f.tags(), '')
})

test('package metadata changes without a version change also skip', (t) => {
  const f = fixture(t)
  const before = f.commit('1.2.0')
  const result = f.run(
    before,
    f.commit('1.2.0', { description: 'Updated description' }),
  )
  assert.equal(result.status, 0, result.stderr)
  assert.equal(f.tags(), '')
})

test('multi-commit push tags its final commit even when HEAD has advanced', (t) => {
  const f = fixture(t)
  const before = f.commit('1.2.0')
  f.commit('1.3.0')
  const after = f.commit('1.3.0', { description: 'Follow-up in same push' })
  f.commit('1.4.0')
  const result = f.run(before, after)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(f.tags(), `${after}\trefs/tags/v1.3.0`)
  const rerun = f.run(before, after)
  assert.equal(rerun.status, 0, rerun.stderr)
  assert.match(rerun.stdout, /already exists/)
})

test('a merge commit is tagged when its version differs from the previous main tip', (t) => {
  const f = fixture(t)
  const before = f.commit('1.2.0')
  f.git('switch', '-c', 'feature')
  f.commit('1.3.0')
  f.git('switch', 'main')
  f.git('merge', '--no-ff', 'feature', '-m', 'Merge feature')
  const after = f.git('rev-parse', 'HEAD')
  const result = f.run(before, after)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(f.tags(), `${after}\trefs/tags/v1.3.0`)
})

test('an existing tag at another commit is never moved', (t) => {
  const f = fixture(t)
  const before = f.commit('1.2.0')
  f.git('push', 'origin', `${before}:refs/tags/v1.3.0`)
  const result = f.run(before, f.commit('1.3.0'))
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /already exists/)
  assert.equal(f.tags(), `${before}\trefs/tags/v1.3.0`)
})

test('prerelease versions keep their complete version in the tag', (t) => {
  const f = fixture(t)
  const before = f.commit('1.2.0')
  const after = f.commit('1.3.0-beta.1+build.7')
  const result = f.run(before, after)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(f.tags(), `${after}\trefs/tags/v1.3.0-beta.1+build.7`)
})

test('branch creation skips without guessing a comparison baseline', (t) => {
  const f = fixture(t)
  const result = f.run('0'.repeat(40), f.commit('1.2.0'))
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /branch creation/)
  assert.equal(f.tags(), '')
})

test('invalid tag names fail without creating refs', (t) => {
  const f = fixture(t)
  const before = f.commit('1.2.0')
  const result = f.run(before, f.commit('1.3.0:refs/heads/main'))
  assert.notEqual(result.status, 0)
  assert.equal(f.tags(), '')
})

test('missing comparison history fails instead of guessing a version change', (t) => {
  const f = fixture(t)
  const result = f.run('a'.repeat(40), f.commit('1.2.0'))
  assert.notEqual(result.status, 0)
  assert.equal(f.tags(), '')
})

test('a rejected push remains a failure when the tag does not exist', (t) => {
  const f = fixture(t)
  const before = f.commit('1.2.0')
  writeFileSync(join(f.remote, 'hooks', 'pre-receive'), '#!/bin/sh\nexit 1\n', {
    mode: 0o755,
  })
  const result = f.run(before, f.commit('1.3.0'))
  assert.notEqual(result.status, 0)
  assert.equal(f.tags(), '')
})
