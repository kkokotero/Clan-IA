/* Controles personalizados de configuración: los <select> nativos siguen siendo
   la fuente de verdad, pero la interfaz es propia. Con data-search="true" el
   desplegable incluye un buscador y permite usar un valor escrito. */
import { PROVIDERS } from '../ai/providers.js';
import { $, escapeHTML } from '../core/dom.js';
import { getSettings } from '../core/settings-store.js';

const mobile = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 600px)').matches;

let sheet = null;
function getSheet() {
  if (sheet) return sheet;
  sheet = document.createElement('div');
  sheet.className = 'ui-select-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="ui-select-sheet-card" role="dialog" aria-modal="true">
      <div class="ui-select-sheet-grab" aria-hidden="true"></div>
      <h2 class="ui-select-sheet-title"></h2>
      <div class="ui-select-search"><span class="ic sm">search</span><input class="ui-select-search-input" type="search" aria-label="Buscar opción" placeholder="Buscar…" /></div>
      <div class="ui-select-sheet-options" role="listbox"></div>
      <button type="button" class="ui-btn ui-btn-tertiary ui-select-sheet-close">Cerrar</button>
    </div>`;
  document.body.appendChild(sheet);
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet || e.target.closest('.ui-select-sheet-close')) closeSheet();
  });
  return sheet;
}
function closeSheet() {
  if (sheet) sheet.hidden = true;
}

function currentLabel(select) {
  return select?.selectedOptions?.[0]?.textContent || '';
}
function optionsOf(select) {
  return [...(select?.options || [])].map((o) => ({ value: o.value, label: o.textContent }));
}
const optionsHTML = (select) =>
  optionsOf(select)
    .map(
      (o) =>
        `<button type="button" class="ui-select-option${o.value === select.value ? ' selected' : ''}" role="option" aria-selected="${o.value === select.value}" data-value="${escapeHTML(o.value)}">${escapeHTML(o.label)}</button>`,
    )
    .join('');

/* El buscador filtra y, si no hay coincidencia, permite usar el texto escrito. */
function bindSearch(container, select) {
  if (!container) return;
  const input = container.querySelector('.ui-select-search-input');
  if (!input) return;
  input.value = '';
  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    const buttons = [...container.querySelectorAll('.ui-select-option')];
    let visible = 0;
    buttons.forEach((b) => {
      const texto = b.textContent.toLowerCase();
      b.hidden = q ? !texto.includes(q) : false;
      if (!b.hidden) visible++;
    });
    const libre = container.querySelector('.ui-select-option-libre');
    if (libre) libre.remove();
    if (q && !visible) {
      const extra = document.createElement('button');
      extra.type = 'button';
      extra.className = 'ui-select-option ui-select-option-libre';
      extra.dataset.value = input.value.trim();
      extra.textContent = `Usar «${input.value.trim()}»`;
      extra.addEventListener('click', () => {
        choose(select, extra.dataset.value);
        if (container.classList.contains('ui-select-menu')) {
          container.hidden = true;
          const trigger = container.closest('.ui-select-custom')?.querySelector('.ui-select-trigger');
          trigger?.setAttribute('aria-expanded', 'false');
        } else closeSheet();
      });
      container.appendChild(extra);
    }
  };
}

function paint(select) {
  const wrap = select?.closest('.ui-field')?.querySelector('.ui-select-custom');
  if (!wrap) return;
  const trigger = wrap.querySelector('.ui-select-trigger');
  const label = wrap.querySelector('.ui-select-value');
  const menu = wrap.querySelector('.ui-select-menu');
  if (label) label.textContent = currentLabel(select);
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  if (!menu) return;
  const search = wrap.dataset.search === 'true'
    ? '<div class="ui-select-search"><span class="ic sm">search</span><input class="ui-select-search-input" type="search" aria-label="Buscar opción" placeholder="Buscar…" /></div>'
    : '';
  menu.innerHTML = search + optionsHTML(select);
  menu.hidden = true;
  if (wrap.dataset.search === 'true') bindSearch(menu, select);
}

function choose(select, value) {
  const changed = select.value !== value;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  if (!changed) syncSelectUI();
}

function openMenu(select) {
  const wrap = select.closest('.ui-field')?.querySelector('.ui-select-custom');
  if (!wrap) return;
  const menu = wrap.querySelector('.ui-select-menu');
  const trigger = wrap.querySelector('.ui-select-trigger');
  if (mobile()) {
    const s = getSheet();
    s.querySelector('.ui-select-sheet-title').textContent =
      wrap.closest('.ui-field')?.querySelector('.ui-label')?.textContent || 'Selecciona';
    const options = s.querySelector('.ui-select-sheet-options');
    options.innerHTML = optionsHTML(select);
    if (options) {
      options.onclick = (e) => {
        const btn = e.target.closest('.ui-select-option');
        if (!btn) return;
        choose(select, btn.dataset.value);
        closeSheet();
      };
      bindSearch(s, select);
    }
    s.hidden = false;
    return;
  }
  document.querySelectorAll('.ui-select-menu').forEach((m) => {
    if (m !== menu) m.hidden = true;
  });
  document.querySelectorAll('.ui-select-trigger').forEach((t) => {
    if (t !== trigger) t.setAttribute('aria-expanded', 'false');
  });
  menu.hidden = !menu.hidden;
  trigger.setAttribute('aria-expanded', String(!menu.hidden));
}

export function initSelects() {
  document.querySelectorAll('.ui-select-custom').forEach((wrap) => {
    const select = wrap.closest('.ui-field')?.querySelector('.ui-select-native');
    if (!select) return;
    const trigger = wrap.querySelector('.ui-select-trigger');
    const menu = wrap.querySelector('.ui-select-menu');
    trigger?.addEventListener('click', () => openMenu(select));
    menu?.addEventListener('click', (e) => {
      const btn = e.target.closest('.ui-select-option');
      if (btn) {
        choose(select, btn.dataset.value);
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
    paint(select);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ui-select-custom')) {
      document.querySelectorAll('.ui-select-menu').forEach((m) => (m.hidden = true));
      document.querySelectorAll('.ui-select-trigger').forEach((t) =>
        t.setAttribute('aria-expanded', 'false'),
      );
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSheet();
      document.querySelectorAll('.ui-select-menu').forEach((m) => (m.hidden = true));
    }
  });
}

export function syncSelectUI() {
  document.querySelectorAll('.ui-select-native').forEach(paint);
  renderModelList();
  updateKeyHint();
}

/* Mensaje de la key, contextual al proveedor seleccionado. */
export function updateKeyHint() {
  const hint = $('#aiKeyHint');
  if (!hint) return;
  const provider = PROVIDERS[$('#aiProvider')?.value || 'gemini'] || PROVIDERS.gemini;
  const url = provider.keyUrl || '';
  const dominio = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const link = url
    ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(dominio)}</a> (${escapeHTML(provider.label)})`
    : escapeHTML(provider.label);
  const body = hint.querySelector('span:last-child') || hint;
  body.innerHTML = `Conseguir una key: ${link}. ${escapeHTML(provider.help || '')}`;
}

/* Catálogo visible de modelos del proveedor elegido. */
export function renderModelList() {
  const list = $('#aiModelList');
  const select = $('#aiModel');
  if (!list || !select) return;
  const q = ($('#aiModelSearch')?.value || '').trim().toLowerCase();
  const provider = $('#aiProvider')?.value || 'gemini';
  const p = PROVIDERS[provider] || PROVIDERS.gemini;
  const models = [
    ...p.models.map((m) => ({ value: m.value, label: m.label })),
    { value: "__custom__", label: "Otro (escribir ID)" },
  ];
  const searchWrap = document.querySelector('.exp-model-search');
  if (searchWrap) searchWrap.hidden = models.length <= 4;
  const shown = q
    ? models.filter(
        (m) =>
          m.label.toLowerCase().includes(q) || m.value.toLowerCase().includes(q),
      )
    : models;
  list.innerHTML = shown.length
    ? shown
        .map(
          (m) => `
        <button type="button" class="exp-model-card${select.value === m.value ? ' selected' : ''}" data-value="${escapeHTML(m.value)}">
          <span class="ic sm">${select.value === m.value ? 'check_circle' : 'circle'}</span>
          <span><b>${escapeHTML(m.label)}</b><small>${escapeHTML(m.value)}</small></span>
        </button>`,
        )
        .join('')
    : '<p class="exp-model-empty">No hay modelos que coincidan con la búsqueda.</p>';
}

export function initModelSearch() {
  const input = $('#aiModelSearch');
  if (input) input.addEventListener('input', renderModelList);
}

/* «Quitar key» solo existe cuando ya hay una clave guardada. */
export function syncClearButton() {
  const btn = $('#aiClear');
  if (!btn) return;
  btn.hidden = !Boolean(getSettings().apiKey);
}
