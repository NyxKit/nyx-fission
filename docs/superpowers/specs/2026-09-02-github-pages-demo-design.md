# GitHub Pages Demo Deployment

## Goal

Publish the Vite demo to the repository's GitHub Pages project site at
`https://nyxkit.github.io/nyx-fission/` whenever changes are merged into
`main`.

## Workflow

Add `.github/workflows/deploy-demo.yml` using GitHub's official Pages Actions
flow. The workflow will:

1. Run on pushes to `main`, which includes merge results, and support
   `workflow_dispatch` for manual redeploys.
2. Check out the repository.
3. Install pnpm and configure Node.js caching from `pnpm-lock.yaml`.
4. Install dependencies with `pnpm install --frozen-lockfile`.
5. Build the demo with `pnpm build:demo`, producing `dist-demo`.
6. Upload `dist-demo` with `actions/upload-pages-artifact`.
7. Deploy the artifact with `actions/deploy-pages`.

The deployment job will use the `github-pages` environment and expose the
deployment URL from the deploy action.

## Permissions And Concurrency

The workflow will grant the minimum required permissions:

- `contents: read` to check out the repository.
- `pages: write` to publish the Pages artifact.
- `id-token: write` for GitHub's Pages deployment authentication.

Only one deployment will run at a time. A newer deployment may cancel an
older in-progress deployment, while already completed deployments remain
available.

## Compatibility

The existing `build:demo` script and `dist-demo` output directory will be
used without changes. Vite's existing `base: './'` configuration provides
relative asset paths that work under the project-site path
`/nyx-fission/`. The large local `demo/public/fixtures/hero*.mp4` files remain
ignored and are not part of the deployment unless they are supplied by the
build environment.

## Validation

Validate the workflow syntax and run the same production demo build locally.
The resulting `dist-demo` directory must contain the generated demo entry
point and its referenced assets. After merging, confirm the workflow completes
and the project site loads from `https://nyxkit.github.io/nyx-fission/`.

## Alternatives Considered

- Publishing a generated `gh-pages` branch was rejected because it requires
  managing generated branch state and broader write behavior.
- A third-party Pages action was rejected because the official actions provide
  the needed functionality without an additional dependency.
