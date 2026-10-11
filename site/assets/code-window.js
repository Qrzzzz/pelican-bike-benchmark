const paths = {
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  external: '<path d="M14 4h6v6m0-6L10 14M10 4H4v16h16v-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};
export function controlIcon(name) {
  return `<svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}
export function decorateControls(root = document) {
  root.querySelectorAll('.button, .text-link, .icon-button').forEach((control) => {
    if (control.querySelector('.control-icon')) return;
    const text = control.textContent.trim();
    const glyph = text.match(/[⧉↓↗×]$/)?.[0];
    if (!glyph || [...control.children].some(child => child.getAttribute('aria-hidden') !== 'true')) return;
    const label = document.createElement('span');
    label.className = 'control-label';
    label.textContent = text.slice(0, -1).trim();
    control.replaceChildren(label);
    control.insertAdjacentHTML('beforeend', controlIcon({ '⧉': 'copy', '↓': 'download', '↗': 'external', '×': 'close' }[glyph]));
  });
}
export function initCodeWindows(root, copy) {
  root.querySelectorAll('pre.code').forEach((pre) => {
    if (pre.closest('.code-window')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'code-window';
    const labels = {
      'method-commands': ['导入命令', 'Shell', '#copy-commands'],
      'method-prompt': ['固定提示词', 'Text', '[data-copy-prompt]'],
      'source-code': ['原始输出', 'HTML', '#copy-source'],
    };
    const heading = pre.previousElementSibling;
    const [title, language, selector] = labels[pre.id] ||
      [pre.getAttribute('aria-label') || (heading?.matches('h3') ? heading.textContent : pre.closest('details')?.querySelector('summary')?.textContent) || '完整记录', pre.textContent.trim().startsWith('{') ? 'JSON' : 'Text'];
    const header = document.createElement('div');
    header.className = 'code-window__header';
    const dots = document.createElement('span');
    dots.className = 'code-window__dots';
    dots.setAttribute('aria-hidden', 'true');
    const caption = document.createElement('span');
    caption.className = 'code-window__title';
    caption.textContent = title;
    const lang = document.createElement('span');
    lang.className = 'code-window__language';
    lang.textContent = language;
    let button = selector ? root.querySelector(selector) : null;
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'button';
      button.addEventListener('click', () => copy(pre.textContent, button));
    }
    const actions = button.closest('.actions');
    button.classList.remove('primary');
    button.innerHTML = `<span class="control-label">复制</span>${controlIcon('copy')}`;
    button.classList.add('code-window__copy');
    button.setAttribute('aria-label', `复制${title}`);
    if (!pre.id) pre.id = `code-record-${root.querySelectorAll('.code-window').length + 1}`;
    button.setAttribute('aria-controls', pre.id);
    header.replaceChildren(dots, caption, lang, button);
    if (actions && !actions.children.length) actions.remove();
    pre.before(wrapper);
    wrapper.append(header, pre);
    pre.tabIndex = 0;
    pre.setAttribute('role', 'region');
    if (!pre.hasAttribute('aria-label')) pre.setAttribute('aria-label', title);
    wrapper.hidden = pre.hidden;
    new MutationObserver(() => { wrapper.hidden = pre.hidden; }).observe(pre, { attributes: true, attributeFilter: ['hidden'] });
  });
}
