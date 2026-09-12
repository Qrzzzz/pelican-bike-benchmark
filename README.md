# Pelican Bike Benchmark

This repository is the neutral, static-site testbed for evaluating how well AI systems implement the same prompt: the well-known scene of a pelican riding a bicycle.

## Current scope

Only repository infrastructure is present at this stage:

- a GitHub Pages deployment workflow;
- an intentionally empty `site/` publishing directory;
- no HTML, CSS, JavaScript, assets, or benchmark results.

The `.gitkeep` file in `site/` exists solely so that GitHub Actions has a directory to package. Until an implementation is added, the deployed Pages URL is expected not to contain a usable website.

## Publishing model

Pushes to `main` and manual workflow runs deploy the contents of `site/` through GitHub Pages. The workflow uses the official Pages actions and is ready for a future static implementation without requiring a framework or build step.

When real site work begins, put only the generated or hand-authored static output in `site/` (including an `index.html`).

## Boundaries

This repository deliberately does not prescribe an AI model, a visual style, or a winner. Those choices belong to the benchmark specification and the eventual website implementation.
