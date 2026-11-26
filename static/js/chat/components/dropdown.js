/* Dropdown personalizado para los formularios generados por la IA.
   El <select> nativo queda oculto como fuente de verdad; la interfaz es propia. */
import { escapeHTML } from '../../core/dom.js';

let documentReady = false;

function ensureDocumentListeners() {
  if (documentReady) return;
  documentReady = true;
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ui-select-custom')) {
      document.querySelectorAll('.ui-select-menu').forEach((m) => (m.hidden = true));
      document.querySelectorAll('.ui-select-trigger').forEach((t) =>
        t.setAttribute('aria-expanded', 'false'),
      );
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape')
      document.querySelectorAll('.ui-select-menu').forEach((m) => (m.hidden = true));
  });
}

export function initDropdowns(root = document) {
  ensureDocumentListeners();
  const mobile =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 600px)').matches;
  root.querySelectorAll('.ui-select-custom').forEach((wrap) => {
    if (wrap.dataset.ready) return;
    wrap.dataset.ready = '1';
    const select = wrap.closest('.ui-field')?.querySelector('.ui-select-native');
    const trigger = wrap.querySelector('.ui-select-trigger');
    const menu = wrap.querySelector('.ui-select-menu');
    const label = wrap.querySelector('.ui-select-value');
    if (!select || !trigger || !menu) return;
    const options = () =>
      [...select.options]
        .map((o) => ({ value: o.value, label: o.textContent }))
        .filter((o) => o.value);
    const paint = () => {
      label.textContent = select.selectedOptions[0]?.textContent || 'Selecciona';
      menu.innerHTML = options()
        .map(
          (o) =>
            `<button type="button" class="ui-select-option${o.value === select.value ? ' selected' : ''}" data-value="${escapeHTML(o.value)}">${escapeHTML(o.label)}</button>`,
        )
        .join('');
      menu.hidden = true;
    };
    trigger.addEventListener('click', () => {
      const abrir = menu.hidden;
      document.querySelectorAll('.ui-select-menu').forEach((m) => (m.hidden = true));
      menu.classList.toggle('is-sheet', mobile);
      menu.hidden = !abrir;
      trigger.setAttribute('aria-expanded', String(abrir));
    });
    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('.ui-select-option');
      if (!btn) return;
      select.value = btn.dataset.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      paint();
    });
    paint();
  });
}
