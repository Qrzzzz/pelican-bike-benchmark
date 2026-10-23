export function controlIcon(name) {
  const icon={copy:'copy',download:'arrow-down',external:'external-link',close:'x'}[name];
  return `<span class="control-icon site-icon site-icon--${icon}" aria-hidden="true"></span>`;
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
    wrapper.className = 'code-window language-text';
    const labels = {
      'method-commands': ['导入命令', 'Shell', '#copy-commands'],
      'method-prompt': ['固定提示词', 'Text', '[data-copy-prompt]'],
      'source-code': ['原始输出', 'HTML', '#copy-source'],
    };
    const heading = pre.previousElementSibling;
    const [title, language, selector] = labels[pre.id] ||
      [pre.getAttribute('aria-label') || (heading?.matches('h3') ? heading.textContent : pre.closest('details')?.querySelector('summary')?.textContent) || '完整记录', pre.textContent.trim().startsWith('{') ? 'JSON' : 'Text'];
    const lang = document.createElement('span');
    lang.className = 'lang';
    lang.textContent = language;
    let button = selector ? root.querySelector(selector) : null;
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.addEventListener('click', () => copy(pre.textContent, button));
    }
    const actions = button.closest('.actions');
    button.classList.remove('primary', 'button');
    button.innerHTML = '<span class="control-label sr-only">复制</span>';
    button.classList.add('code-window__copy', 'copy');
    button.setAttribute('aria-label', `复制${title}`);
    if (!pre.id) pre.id = `code-record-${root.querySelectorAll('.code-window').length + 1}`;
    button.setAttribute('aria-controls', pre.id);
    wrapper.append(button, lang);
    if (actions && !actions.children.length) actions.remove();
    pre.before(wrapper);
    wrapper.append(pre);
    pre.tabIndex = 0;
    pre.setAttribute('role', 'region');
    if (!pre.hasAttribute('aria-label')) pre.setAttribute('aria-label', title);
    wrapper.hidden = pre.hidden;
    new MutationObserver(() => { wrapper.hidden = pre.hidden; }).observe(pre, { attributes: true, attributeFilter: ['hidden'] });
  });
}
