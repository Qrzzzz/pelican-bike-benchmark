# Shared front end

The VitePress shell reuses the pinned personal-docs theme in `.vitepress/vendor`.
The source repository and file hashes are recorded in `theme-source.json` and
verified by `tests/theme.test.mjs`. Native business controllers are mounted in a
Vue-owned, build-rendered island; submitted HTML never enters the Vue template.

`npm run build` generates the four Markdown entries and trusted page payloads
from `site/*.html`, then renders the Vue theme to `dist`. Data and submission
evidence remain authoritative under `site/`; public copies are generated only.
The existing `.html` links, query parameters, return links and full-document
navigation remain supported. Search, navigation, appearance and reading layout
belong to the shared theme. The legacy native header/document styles are not
loaded by the new front end.

To inspect upstream drift, compare the source SHA in `theme-source.json` first.
An intentional update can be made with:

    node scripts/sync-theme.mjs <path-to-personal-docs-repository>

Review the resulting diff and run `npm run check` and `npm run build`, followed
by browser checks of themes, narrow layouts, search, comparison and preview.
Do not point builds at an external checkout; the vendored snapshot is sufficient.

The repeatable browser acceptance script is `scripts/verify-theme-browser.js`.
After building and starting the preview on port 4187, open the site with
`playwright-cli`, then run `playwright-cli run-code --filename=scripts/verify-theme-browser.js`.
It verifies provider filtering, selection/comparison, source hashes and clipboard,
command copying, outline, appearance, shared search, no-JS rendering and 32
light/dark responsive page layouts. Screenshots go under `output/playwright/`.
