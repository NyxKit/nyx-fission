# GitHub Pages Demo Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Vite demo to `https://nyxkit.github.io/nyx-fission/` after pushes to `main`, including pushes created by merged pull requests.

**Architecture:** GitHub Actions will build the existing `dist-demo` output using the repository's pnpm scripts, upload it as a Pages artifact, and deploy it through the official Pages deployment action. The workflow will use least-privilege permissions, the `github-pages` environment, and concurrency cancellation so stale builds do not deploy after newer changes.

**Tech Stack:** GitHub Actions, `actions/checkout`, `pnpm/action-setup`, `actions/setup-node`, `actions/upload-pages-artifact`, `actions/deploy-pages`, Vite, pnpm.

---

### Task 1: Add the GitHub Pages deployment workflow

**Files:**
- Create: `.github/workflows/deploy-demo.yml`

- [ ] **Step 1: Create the workflow with the approved trigger and permissions**

Create `.github/workflows/deploy-demo.yml` with this complete content:

```yaml
name: Deploy demo to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build demo
        run: pnpm build:demo

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist-demo

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    permissions:
      pages: write
      id-token: write

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

The workflow must keep the build and deployment in separate jobs so the
artifact is the only input to the deployment job. `push` to `main` covers
merge commits; `workflow_dispatch` supports manual recovery or redeployment.

- [ ] **Step 2: Check the workflow for accidental large fixture inclusion**

Run:

```bash
git status --short
git check-ignore -v demo/public/fixtures/hero0.mp4
```

Expected: the workflow is the only new source file, and `hero0.mp4` is still
ignored by the existing `demo/public/fixtures/hero*.mp4` rule. The workflow
does not add or commit the large local fixtures.

- [ ] **Step 3: Validate the production demo build**

Run:

```bash
pnpm build:demo
```

Expected: Vite exits successfully and writes the demo site to `dist-demo`.

- [ ] **Step 4: Run the repository checks**

Run:

```bash
pnpm test:unit
pnpm lint
```

Expected: all unit tests pass and ESLint exits with status 0.

- [ ] **Step 5: Commit the workflow**

Run:

```bash
git add .github/workflows/deploy-demo.yml
git commit -m "ci: deploy demo to GitHub Pages"
```

Expected: one commit containing only the deployment workflow. Push the commit
to `main` so GitHub Actions can run it:

```bash
git push origin main
```

### Task 2: Enable GitHub Pages deployment for the repository

**Files:**
- No repository files

- [ ] **Step 1: Set the Pages source to GitHub Actions**

In the GitHub repository, open `Settings` -> `Pages` and set `Build and
deployment` -> `Source` to `GitHub Actions`. Do not select a branch source;
the workflow uploads and deploys the artifact directly.

- [ ] **Step 2: Confirm the deployment environment permissions**

In `Settings` -> `Environments`, confirm the `github-pages` environment can be
used by the workflow. Do not add required reviewers for this deployment unless
the repository's governance requires an approval gate.

- [ ] **Step 3: Verify the deployed site**

After the workflow completes successfully, open:

```text
https://nyxkit.github.io/nyx-fission/
```

Expected: the demo loads at the project-site path, relative JS/CSS assets
resolve, and the existing tracked SVG/MP4 demo fixtures load. The ignored
`hero*.mp4` files are not required by the current demo entry point.
