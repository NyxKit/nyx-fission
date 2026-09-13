# Automatic version tags

`.github/workflows/tag-version.yml` runs on pushes to `main`, including merge,
squash, and rebase merges, as well as direct pushes. It compares the root
`package.json` version at the push payload's `before` commit with the version at
the event's commit SHA. This covers a version bump anywhere in a multi-commit
push, rather than assuming the last commit contains the bump.

| Situation                                                      | Result                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| Version unchanged, including demo-only edits                   | Success with a skip message; no tag                     |
| Other package metadata changed                                 | Success with a skip message; no tag                     |
| Version changed, e.g. 1.2.0 to 1.3.0                           | Push lightweight tag `v1.3.0` at that event's commit    |
| Version tag already exists                                     | Success with a skip message; never move or overwrite it |
| Branch creation without a previous commit                      | Success with a skip message                             |
| Invalid/missing version, missing history, or rejected tag push | Fail with the underlying error                          |

Versions are compared for equality, not release ordering. Prerelease/build suffixes
are retained. A rollback to an already-tagged version skips; any other changed
version gets its own tag. The package version must form a valid Git tag name.

The workflow does not backfill missing tags when the version is unchanged. Adding
this workflow without a version bump therefore does not tag the current 1.2.0.
It creates neither a GitHub Release nor an npm publication and does not update the
version itself.

Each run checks out its event's exact SHA with full history. No shared concurrency
group cancels or replaces another push's pending run. The tag push never uses
force; if another run creates the tag between inspection and push, it skips after
confirming that the remote tag exists. Outcomes also appear in the Actions step
summary.

The job uses the repository's `GITHUB_TOKEN` with `contents: write`, through
checkout's persisted Git credentials. No extra secret is required. Repository
rules must permit that token to create version tags. Real permission or network
errors are failures, so a skipped version bump cannot hide a broken tag push.

GitHub does not trigger ordinary downstream workflows from tag pushes made using
`GITHUB_TOKEN`. If publishing from tags is added later, design that handoff
explicitly. [GitHub workflow triggering documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)

Push-event semantics and checkout history behavior are documented in
[GitHub's workflow events reference](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#push)
and [actions/checkout](https://github.com/actions/checkout#usage).

Run the isolated Git integration checks locally with:

```sh
node --test .github/scripts/tag-version.test.mjs
```

They use temporary local repositories and bare remotes, not GitHub. The tagging
workflow runs these checks before attempting to create its tag.
