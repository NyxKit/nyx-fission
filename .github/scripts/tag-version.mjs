import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'

function git(...args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function report(message) {
  console.log(message)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`)
  }
}

function versionAt(sha) {
  const { version } = JSON.parse(git('show', `${sha}:package.json`))
  if (typeof version !== 'string' || !version.trim()) {
    throw new Error(
      `package.json at ${sha} must contain a nonempty version string.`,
    )
  }
  return version
}

function main() {
  const before = process.env.BEFORE_SHA
  const after = process.env.GITHUB_SHA
  if (
    !/^[a-f0-9]{40}$/.test(before ?? '') ||
    !/^[a-f0-9]{40}$/.test(after ?? '')
  ) {
    throw new Error(
      'BEFORE_SHA and GITHUB_SHA must be full push-event commit SHAs.',
    )
  }
  if (/^0+$/.test(before)) {
    report('Skipped: branch creation has no previous version to compare.')
    return
  }

  const previousVersion = versionAt(before)
  const version = versionAt(after)
  if (version === previousVersion) {
    report(`Skipped: package version is unchanged (${version}).`)
    return
  }

  const tag = `v${version}`
  const ref = `refs/tags/${tag}`
  git('check-ref-format', ref)
  const remoteTagExists = () => git('ls-remote', '--tags', 'origin', ref) !== ''
  if (remoteTagExists()) {
    report(`Skipped: ${tag} already exists; existing tags are never moved.`)
    return
  }

  try {
    // Push a lightweight tag for this event's commit, even if main advanced.
    git('push', 'origin', `${after}:${ref}`)
  } catch (error) {
    // Another run may have created the same version tag after our check.
    if (!remoteTagExists()) throw error
    report(
      `Skipped: ${tag} was created concurrently; existing tags are never moved.`,
    )
    return
  }
  report(`Created ${tag} at ${after} (${previousVersion} → ${version}).`)
}

main()
