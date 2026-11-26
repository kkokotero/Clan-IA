import { PROVIDERS, askAI } from '../ai/providers.js';
import { refreshAIStatus, renderHistory } from '../chat/flow.js';
import { current, load, save } from '../chat/model.js';
import { $, app, closeMenu, menuQuery, menuToggle, setMenu } from '../core/dom.js';
import { askConfirmation, initModals } from '../core/modals.js';
import { clearSettings, getSettings, saveSettings } from '../core/settings-store.js';
import { S, getMoodle } from '../core/state.js';
import { moodleLogout, updateMoodleUI } from '../moodle/session.js';
import {
  activateSettingsTab,
  customField,
  customInput,
  keyInput,
  modelSelect,
  populateModels,
  providerSel,
  readModel,
  renderHistoryList,
  updateHistoryStats,
} from '../settings/settings.js';
import { initModelSearch, initSelects, renderModelList, syncClearButton, syncSelectUI } from '../settings/ui.js';

/* Avisos breves tras una acción sobre el historial. */
let toastTimer = null;
function showHistoryToast(text) {
  const toast = $('#historyToast');
  if (!toast) return;
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}

/* Centro de ayuda: estado real de la configuración. */
function updateHelpStatus() {
  const ia = $('#helpIa');
  const conIa = Boolean(getSettings().apiKey);
  if (ia) {
    ia.className = `exp-status-item${conIa ? ' ok' : ''}`;
    ia.innerHTML = `<span class="ic sm">${conIa ? 'check_circle' : 'key_off'}</span><span><b>IA</b><small>${conIa ? 'Clave configurada' : 'Sin clave: configúrala para responder'}</small></span>`;
  }
}

/* Validación de la clave en segundo plano: se dispara al escribir, con retardo
   y sin guardar nada. Solo muestra el resultado (check o error). */
let validateTimer = null;
let validateSeq = 0;
function setKeyStatus(text, kind = '') {
  const status = $('#aiKeyStatus');
  if (!status) return;
  status.className = `key-status${kind ? ' ' + kind : ''}`;
  status.innerHTML = '';
  if (!text) return;
  const icon = document.createElement('span');
  icon.className = 'ic sm';
  icon.textContent = { ok: 'check_circle', error: 'error', pending: 'progress_activity' }[kind] || 'info';
  const label = document.createElement('span');
  label.textContent = text;
  status.appendChild(icon);
  status.appendChild(label);
}
async function validateKey() {
  if (!keyInput || !providerSel) return;
  const apiKey = keyInput.value.trim();
  if (!apiKey) { setKeyStatus(''); return; }
  const provider = PROVIDERS[providerSel.value] ? providerSel.value : 'gemini';
  const settings = { provider, apiKey, model: readModel() };
  const seq = ++validateSeq;
  setKeyStatus('Validando…', 'pending');
  try {
    await askAI('Responde solo: ok', settings);
    if (seq === validateSeq) setKeyStatus('Clave válida', 'ok');
  } catch (err) {
    if (seq !== validateSeq) return;
    const msg = String(err.message || err);
    setKeyStatus(`${PROVIDERS[provider].label}: ${msg}`.slice(0, 160), 'error');
  }
}
function scheduleValidate(delay = 700) {
  clearTimeout(validateTimer);
  validateSeq++;
  if (!keyInput?.value.trim()) { setKeyStatus(''); return; }
  setKeyStatus('Validando…', 'pending');
  validateTimer = setTimeout(validateKey, delay);
}

/* Solo se enlazan los controles que existen en la página actual: cada sección
   tiene su propio HTML, pero todas comparten el menú de la app. */
const on = (sel, ev, fn) => {
  const el = $(sel);
  if (el) el.addEventListener(ev, fn);
};

export function initSettings() {
  /* ---------- Menú de la app (presente en todas las páginas de ajustes) ---------- */
  const toggle = () => {
    const open = app?.dataset.menu !== 'open';
    if (typeof setMenu === 'function') setMenu(open);
    else if (app) app.dataset.menu = open ? 'open' : 'closed';
  };
  on('#menuToggle', 'click', toggle);
  on('#mobileMenuBtn', 'click', toggle);
  on('#scrim', 'click', () => closeMenu());
  menuQuery?.addEventListener('change', (e) => setMenu(!e.matches));
  on('#newChat', 'click', () => window.location.assign('/chat/'));
  on('#mobileNewChat', 'click', () => window.location.assign('/chat/'));
  on('#profileBtn', 'click', () => closeMenu());
  on('#mobileProfileBtn', 'click', () => window.location.assign('/settings/ai/'));
  on('#tlBtnSide', 'click', () => closeMenu());
  on('#moodleBtnSide', 'click', (e) => {
    closeMenu();
    if (!getMoodle().token) {
      e.preventDefault();
      window.location.assign('/');
    }
  });
  on('#logoutBtnSide', 'click', (e) => {
    e.preventDefault();
    closeMenu();
    moodleLogout();
  });
  on('#settingsLogout', 'click', () => moodleLogout());

  /* ---------- Página de IA ---------- */
  on('#aiKey', 'input', () => scheduleValidate());
  providerSel?.addEventListener('change', () => {
    const provider = PROVIDERS[providerSel.value] ? providerSel.value : 'gemini';
    populateModels(provider, PROVIDERS[provider].defaultModel);
    syncSelectUI();
    scheduleValidate(400);
  });
  modelSelect?.addEventListener('change', () => {
    customField.hidden = modelSelect.value !== '__custom__';
    if (!customField.hidden) customInput.focus();
    renderModelList();
    syncSelectUI();
    scheduleValidate(400);
  });
  on('#aiModelList', 'click', (e) => {
    const card = e.target.closest('.exp-model-card');
    if (card && modelSelect) {
      modelSelect.value = card.dataset.value;
      modelSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  on('#settingsForm', 'submit', (e) => {
    e.preventDefault();
    const provider = PROVIDERS[providerSel.value] ? providerSel.value : 'gemini';
    saveSettings({ provider, apiKey: keyInput.value.trim(), model: readModel() });
    refreshAIStatus();
    syncClearButton();
    clearTimeout(validateTimer);
    validateSeq++;
    setKeyStatus('Guardado en este navegador', 'ok');
  });
  on('#aiClear', 'click', () => {
    clearSettings();
    keyInput.value = '';
    providerSel.value = 'gemini';
    populateModels('gemini', PROVIDERS.gemini.defaultModel);
    refreshAIStatus();
    syncClearButton();
    clearTimeout(validateTimer);
    validateSeq++;
    setKeyStatus('');
  });

  /* ---------- Contactos copiables (sección TL) ---------- */
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.copy || '';
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
        else {
          const tmp = document.createElement('textarea');
          tmp.value = value;
          document.body.appendChild(tmp);
          tmp.select();
          document.execCommand('copy');
          tmp.remove();
        }
        const original = btn.innerHTML;
        btn.innerHTML = '<span class="ic sm">check</span>';
        setTimeout(() => { btn.innerHTML = original; }, 1200);
      } catch (e) {}
    });
  });

  /* ---------- Navegación entre secciones de configuración ---------- */
  document.querySelectorAll('[data-settings-tab]').forEach((btn) => {
    btn.addEventListener('click', () =>
      activateSettingsTab(btn.dataset.settingsTab),
    );
  });

  /* ---------- Lista de conversaciones ---------- */
  on('#historySearch', 'input', () => renderHistoryList());
  let renamingId = null;
  const renameModal = $('#renameModal');
  on('#historyList', 'click', async (e) => {
    const card = e.target.closest('.history-card');
    if (!card) return;
    const action = e.target.closest('[data-action]')?.dataset.action;
    const conv = S.conversations.find((c) => c.id === card.dataset.id);
    if (!conv) return;
    if (!action) {
      if (e.target.closest('a')) return;
      window.location.assign(`/chat/?chat=${encodeURIComponent(conv.id)}`);
      return;
    }
    if (action === 'open') {
      window.location.assign(`/chat/?chat=${encodeURIComponent(conv.id)}`);
    } else if (action === 'rename') {
      renamingId = conv.id;
      const input = $('#renameInput');
      if (input) { input.value = conv.title || ''; input.focus(); }
      if (renameModal) renameModal.hidden = false;
    } else if (action === 'delete') {
      if (!(await askConfirmation(`¿Borrar la conversación «${conv.title || 'Sin título'}»?`))) return;
      S.conversations = S.conversations.filter((c) => c.id !== conv.id);
      if (S.currentId === conv.id) S.currentId = null;
      save();
      updateHistoryStats();
      showHistoryToast('Conversación eliminada');
    }
  });
  on('#renameCancel', 'click', () => {
    if (renameModal) renameModal.hidden = true;
    renamingId = null;
  });
  on('#renameConfirm', 'click', () => {
    const conv = S.conversations.find((c) => c.id === renamingId);
    const value = $('#renameInput')?.value.trim();
    if (conv && value) {
      conv.title = value;
      save();
      updateHistoryStats();
      showHistoryToast('Conversación renombrada');
    }
    if (renameModal) renameModal.hidden = true;
    renamingId = null;
  });
  renameModal?.addEventListener('click', (e) => {
    if (e.target === renameModal) {
      renameModal.hidden = true;
      renamingId = null;
    }
  });

  /* ---------- Página de chats e historial ---------- */
  on('#exportHistory', 'click', () => {
    const blob = new Blob([JSON.stringify(S.conversations, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clan-ia-historial.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showHistoryToast('Historial exportado');
  });
  on('#deleteCurrent', 'click', async () => {
    if (!current() || !(await askConfirmation('¿Borrar la conversación actual?'))) return;
    S.conversations = S.conversations.filter((c) => c.id !== S.currentId);
    S.currentId = null;
    save();
    renderHistory();
    updateHistoryStats();
    showHistoryToast('Conversación eliminada');
  });
  on('#clearHistory', 'click', async () => {
    if (
      !S.conversations.length ||
      !(await askConfirmation('¿Borrar todas las conversaciones? Esta acción no se puede deshacer.'))
    )
      return;
    S.conversations = [];
    S.currentId = null;
    save();
    renderHistory();
    updateHistoryStats();
    showHistoryToast('Historial borrado');
  });
}

load();
initSelects();
initModelSearch();
/* Estado inicial del formulario de IA (ahora es una página, no un modal). */
const cfgIA = getSettings();
if (providerSel) providerSel.value = cfgIA.provider;
if (keyInput) keyInput.value = cfgIA.apiKey;
if (providerSel) populateModels(cfgIA.provider, cfgIA.model);
syncSelectUI();
if (keyInput?.value.trim()) scheduleValidate(400);
syncClearButton();
updateHelpStatus();
renderHistory();
updateHistoryStats();
refreshAIStatus();
updateMoodleUI();
setMenu(!menuQuery.matches);
const sinSesion = !getMoodle().token;
for (const sel of ['#logoutBtnSide', '#settingsLogout']) {
  const btn = $(sel);
  if (btn && sinSesion) btn.hidden = true;
}
const enlaceMoodle = $('#moodleBtnSide');
if (enlaceMoodle) enlaceMoodle.href = `${getMoodle().base}/my/`;
initSettings();
initModals();
