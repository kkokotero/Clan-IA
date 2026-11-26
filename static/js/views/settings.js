import { PROVIDERS, askAI } from '../ai/providers.js';
import { refreshAIStatus, renderHistory } from '../chat/flow.js';
import { current, load, save } from '../chat/model.js';
import { $, app, closeMenu, escapeHTML, menuQuery, menuToggle, setMenu } from '../core/dom.js';
import { askConfirmation, initModals } from '../core/modals.js';
import { clearSettings, getSettings, saveSettings } from '../core/settings-store.js';
import { moodleIdsParam, moodleRequest, moodleToolAllowed } from '../moodle/client.js';
import { S, getMoodle, saveMoodle } from '../core/state.js';
import { ensureMoodleSession, moodleLogout, updateMoodleUI } from '../moodle/session.js';
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

/* Las opciones se completan con valores reales de Moodle cuando el sitio los
   expone; si no, se conservan las opciones locales y el buscador permite escribir. */
async function loadProfileOptions() {
  const found = new Set();
  const add = (sel, value, label = value) => {
    const el = $(sel);
    if (!el || !value) return;
    if ([...(el.options || [])].some((o) => o.value === value)) return;
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label || value;
    el.add(opt);
    found.add(sel);
  };
  if (moodleToolAllowed('core_country_get_countries')) {
    try {
      const countries = await moodleRequest('core_country_get_countries');
      (Array.isArray(countries) ? countries : []).forEach((c) =>
        add('#profileCountry', c.code || c.shortname || c.id, c.fullname || c.code || c.shortname),
      );
    } catch (e) {}
  }
  /* Descubre cualquier función del sitio que devuelva catálogos útiles. */
  const destino = (fn) =>
    /country/i.test(fn) ? '#profileCountry'
    : /timezone/i.test(fn) ? '#profileTimezone'
    : /city/i.test(fn) ? '#profileCity'
    : /institution/i.test(fn) ? '#profileInstitution'
    : '#profileDepartment';
  const candidatas = S.moodleFunctions.filter((f) =>
    /country|timezone|city|institution|department/i.test(f),
  );
  for (const fn of candidatas.slice(0, 10)) {
    try {
      const data = await moodleRequest(fn);
      const rows = Array.isArray(data)
        ? data
        : data?.countries || data?.timezones || data?.items || data?.fields || [];
      rows.forEach((row) => {
        if (!row || typeof row !== 'object') return;
        const value =
          row.code ?? row.shortname ?? row.value ?? row.name ?? row.fullname ??
          row.timezone ?? row.city ?? row.institution ?? row.department ?? row.id;
        if (value == null) return;
        add(destino(fn), String(value), String(row.fullname || row.label || row.name || value));
      });
    } catch (e) {}
  }
  try {
    const courses = await moodleRequest('core_enrol_get_users_courses', {
      userid: S.moodleUserId,
    });
    for (const course of (Array.isArray(courses) ? courses : []).slice(0, 20)) {
      if (!moodleToolAllowed('core_enrol_get_enrolled_users')) break;
      const users = await moodleRequest('core_enrol_get_enrolled_users', {
        courseid: course.id,
      });
      (Array.isArray(users) ? users : []).forEach((u) => {
        add('#profileCity', u.city);
        add('#profileCountry', u.country);
        add('#profileTimezone', u.timezone);
        add('#profileInstitution', u.institution);
        add('#profileDepartment', u.department);
      });
    }
  } catch (e) {}
  if (S.moodleUserId && moodleToolAllowed('core_user_get_users_by_field')) {
    try {
      const [me] = await moodleRequest('core_user_get_users_by_field', {
        field: 'id',
        ...moodleIdsParam([S.moodleUserId], 'values'),
      });
      if (me) {
        add('#profileCity', me.city);
        add('#profileCountry', me.country);
        add('#profileTimezone', me.timezone || S.moodleProfileContext?.match(/timezone[^:]*: ?([^,}]+)/)?.[1]);
        add('#profileInstitution', me.institution);
        add('#profileDepartment', me.department);
      }
    } catch (e) {}
  }
  if (found.size) syncSelectUI();
  const info = $('#profileOptionsInfo');
  if (info)
    info.textContent = found.size
      ? 'Opciones sugeridas obtenidas de tu Moodle. Puedes buscar o escribir la que necesites.'
      : 'Usa el buscador para encontrar una opción o escribir la que necesites.';
}

/* Perfil: se lee y se escribe directamente en Moodle. */
function showProfileMsg(text, kind = '') {
  const msg = $('#profileMsg');
  if (!msg) return;
  msg.textContent = text;
  msg.className = `ui-hint${kind ? ' is-' + kind : ''}`;
}
async function loadProfile() {
  if (!getMoodle().token) {
    showProfileMsg('Ingresa a Moodle desde el inicio para editar tu perfil.', 'error');
    return;
  }
  await ensureMoodleSession().catch(() => {});
  let user = {};
  try {
    const rows = await moodleRequest('core_user_get_users_by_field', {
      field: 'id',
      ...moodleIdsParam([S.moodleUserId], 'values'),
    });
    if (Array.isArray(rows) && rows[0]) user = rows[0];
  } catch (e) {
    S.lastMoodleError = String(e.message || e);
  }
  const set = (sel, value) => {
    const el = $(sel);
    if (el) el.value = value || '';
  };
  set('#profileFirstname', user.firstname);
  set('#profileLastname', user.lastname);
  set('#profileAlternative', user.alternatename);
  set('#profileIdNumber', user.idnumber);
  set('#profileEmail', user.email);
  const setChoice = (sel, value) => {
    const el = $(sel);
    if (!el) return;
    if (value && ![...(el.options || [])].some((o) => o.value === value)) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      el.add(opt);
    }
    el.value = value || '';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  setChoice('#profileCity', user.city);
  setChoice('#profileCountry', user.country);
  setChoice('#profileTimezone', user.timezone);
  setChoice('#profileInstitution', user.institution);
  setChoice('#profileDepartment', user.department);
  syncSelectUI();
  set('#profilePhone', user.phone1);
  set('#profilePhone2', user.phone2);
  set('#profileUrl', user.url);
  set('#profileDescription', user.description);
  const name = user.fullname || [user.firstname, user.lastname].filter(Boolean).join(' ') || S.moodleUser || 'Estudiante';
  const full = $('#profileFullName');
  if (full) full.textContent = name;
  const username = $('#profileUsername');
  if (username) username.textContent = user.username ? `@${user.username}` : 'Tu cuenta de Moodle';
  const avatar = $('#profileAvatar');
  if (avatar) {
    const url = S.moodleAvatarUrl || getMoodle().avatarUrl;
    if (url) avatar.innerHTML = `<img class="avatar-img" src="${escapeHTML(url)}" alt="" />`;
    else avatar.textContent = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'ES';
  }
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

  /* ---------- Página de perfil ---------- */
  on('#profileForm', 'submit', async (e) => {
    e.preventDefault();
    if (!getMoodle().token) {
      showProfileMsg('Ingresa a Moodle desde el inicio para editar tu perfil.', 'error');
      return;
    }
    const fields = {
      firstname: $('#profileFirstname')?.value.trim(),
      lastname: $('#profileLastname')?.value.trim(),
      alternatename: $('#profileAlternative')?.value.trim(),
      idnumber: $('#profileIdNumber')?.value.trim(),
      email: $('#profileEmail')?.value.trim(),
      city: $('#profileCity')?.value.trim(),
      country: $('#profileCountry')?.value.trim(),
      timezone: $('#profileTimezone')?.value.trim(),
      institution: $('#profileInstitution')?.value.trim(),
      department: $('#profileDepartment')?.value.trim(),
      phone1: $('#profilePhone')?.value.trim(),
      phone2: $('#profilePhone2')?.value.trim(),
      url: $('#profileUrl')?.value.trim(),
      description: $('#profileDescription')?.value.trim(),
    };
    const changes = Object.entries(fields).filter(([, v]) => v);
    if (!changes.length) {
      showProfileMsg('No hay cambios para guardar.');
      return;
    }
    const params = { 'users[0][id]': S.moodleUserId };
    changes.forEach(([k, v]) => { params[`users[0][${k}]`] = v; });
    const ok = await askConfirmation(`¿Guardar en Moodle los cambios de: ${changes.map(([k]) => k).join(', ')}?`);
    if (!ok) {
      showProfileMsg('Cambios cancelados.');
      return;
    }
    try {
      await moodleRequest('core_user_update_users', params);
      const fullname = [fields.firstname, fields.lastname].filter(Boolean).join(' ');
      if (fullname) {
        S.moodleUser = fullname;
        saveMoodle({ ...getMoodle(), name: fullname });
      }
      updateMoodleUI();
      showProfileMsg('Cambios guardados en Moodle.', 'ok');
    } catch (err) {
      showProfileMsg(`No se pudo guardar: ${err.message || err}`, 'error');
    }
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
if ($('#profileForm')) {
  loadProfile();
  loadProfileOptions();
}
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
