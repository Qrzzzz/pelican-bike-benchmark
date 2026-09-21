# Reused theme code

`site/assets/tokens.css` adapts the palette, typography fallbacks, and design-token structure from [Qrzzzz/Qrzzzz.github.io](https://github.com/Qrzzzz/Qrzzzz.github.io), `docs/.vitepress/theme/styles/tokens.css`, reference commit `cdb7908b8dc8224d975c2f11c909cc1a44863ccc`. Focus, reduced-motion and reading-layout patterns are adapted to native HTML/CSS. No article text, fonts, images, or VitePress runtime are copied.

MIT License

Copyright (c) 2026 Cherry Chu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

The header also adapts `NavActions.vue` (sun/moon switch and GitHub SVG), the `Q\` home mark from `Layout.vue` / `styles/site.css`, and reuses `themeTransitionRuntime.mjs` as `site/assets/theme-transition.js` from the same reference commit. Links and accessible labels are localized for this site; the MIT notice above applies.

Current design adaptation (2026-09-21): native HTML layouts use the reference project's current tokens.css, site.css, catalog.css and content.css. The locally hosted font subsets retain the reference fonts' original SIL Open Font License texts in site/assets/fonts/{source-han-serif,source-han-sans,newsreader,maple-mono}/OFL.txt. Font unicode-range declarations are preserved; only ranges used by the current site's text are included, with system fallbacks for other characters.
