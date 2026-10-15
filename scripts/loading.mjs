import { loadingPoems } from '../site/assets/loadingPoems.mjs';
import { bootstrapLoadingPoem, createLoadingPoemPlayer } from '../site/assets/loadingPoemRuntime.mjs';

// Native-HTML counterpart of personal-docs loadingBootHtml.mjs. Keep the
// original composition and runtime; adapt only build/theme/app integration.
export function prepareLoadingHtml(html, { markup, css, tokens }) {
  const themePattern = /<script\b[^>]*\bid="sync-initial-theme-color"[^>]*>[\s\S]*?<\/script>/;
  const theme = html.match(themePattern)?.[0];
  if (!theme) throw new Error('Missing initial theme script');
  html = html.replace(theme, '');
  const criticalTokens = [...tokens.matchAll(/(:root(?:\[data-theme="dark"\])?)\s*\{([^}]+)\}/g)]
    .map(([, selector, declarations]) => `${selector}{${(declarations.match(/--site-(?:canvas|accent|text(?:-muted)?|font-(?:mono|sans|reading))\s*:[^;]+;/g) || []).join('')}}`).join('\n');
  html = html.replace(/<link\b[^>]*\brel="[^"]*stylesheet[^"]*"[^>]*>/g, link => {
    const asyncLink = link.replace(/>$/, ' data-site-boot-style media="print" onload="this.media=\'all\';this.dataset.siteStyleReady=\'true\';document.dispatchEvent(new Event(\'site-loading-style-ready\'))" onerror="this.dataset.siteStyleReady=\'true\';document.dispatchEvent(new Event(\'site-loading-style-ready\'))">');
    return `${asyncLink}<noscript>${link}</noscript>`;
  });
  const critical = `<style id="site-loading-critical">${criticalTokens}\n${css}\nhtml.site-boot-loading{overflow:hidden}html.site-boot-loading body{visibility:hidden;overflow:hidden}html.site-boot-loading .site-loading--boot{visibility:visible}</style>`;
  const boot = `<script id="site-loading-bootstrap">;(${bootstrapLoadingPoem.toString()})(${JSON.stringify(loadingPoems).replace(/</g, '\\u003c')}, ${createLoadingPoemPlayer.toString()});</script>`;
  // Leave charset first, then establish theme/loading before blocking resources.
  html = html.replace(/<meta\s+charset="[^"]+"\s*\/?>/i, match => `${match}${theme}${critical}${boot}`);
  return html.replace(/<body\b[^>]*>/, match => `${match}\n${markup}`);
}
