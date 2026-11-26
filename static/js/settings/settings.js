import { PROVIDERS } from '../ai/providers.js';
import { syncSelectUI } from './ui.js';
import { current } from '../chat/model.js';
import { $, escapeHTML } from '../core/dom.js';
import { openModal } from '../core/modals.js';
import { getSettings } from '../core/settings-store.js';
import { S, busy, conversations, currentId, editingId, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from '../core/state.js';
export const providerSel = $("#aiProvider");
export const keyInput = $("#aiKey");
export const modelSelect = $("#aiModel");
export const customInput = $("#aiModelCustom");
export const customField = $("#customModelField");

/* Llena el desplegable con los modelos del proveedor elegido */
export function populateModels(provider, selected) {
  if (!modelSelect) return;
  const p = PROVIDERS[provider] || PROVIDERS.gemini;
  modelSelect.innerHTML =
    p.models
      .map(
        (m) =>
          `<option value="${escapeHTML(m.value)}">${escapeHTML(m.label)}</option>`,
      )
      .join("") + `<option value="__custom__">Otro (escribir ID)</option>`;
  const known = p.models.some((m) => m.value === selected);
  modelSelect.value = known ? selected : "__custom__";
  customInput.value = known ? "" : selected || "";
  customField.hidden = known;
  syncSelectUI();
}

export function readModel() {
  if (!modelSelect) return PROVIDERS.gemini.defaultModel;
  const provider = PROVIDERS[providerSel.value] ? providerSel.value : "gemini";
  return modelSelect.value === "__custom__"
    ? customInput.value.trim() || PROVIDERS[provider].defaultModel
    : modelSelect.value;
}

/* Cada sección vive en su propia página: cambiar de opción es una redirección
   directa, así se puede enlazar /settings/ai/ o /settings/chats/ sin pasar por
   un modal ni depender de pestañas ocultas. */
export function activateSettingsTab(name) {
  if (name === "moodle") name = "ia";
  const target = `/settings/${name}/`;
  if (window.location.pathname !== target) window.location.assign(target);
}

/* Lista de conversaciones con búsqueda y acciones por chat. */
export function renderHistoryList() {
  const list = $("#historyList");
  if (!list) return;
  const q = ($("#historySearch")?.value || "").trim().toLowerCase();
  /* Sin búsqueda solo se muestran los 3 últimos; al buscar se busca en todos. */
  const shown = q
    ? S.conversations.filter((c) =>
        String(c.title || "").toLowerCase().includes(q),
      ).slice(0, 3)
    : [...S.conversations].reverse().slice(0, 3);
  list.innerHTML = shown.length
    ? shown
        .map((c) => {
          const n = (c.nodes || []).length;
          const branches = (c.nodes || []).filter(
            (node) => (c.nodes || []).filter((x) => x.parentId === node.id).length > 1,
          ).length;
          const active = c.id === S.currentId;
          return `<div class="history-card${active ? " active" : ""}" data-id="${escapeHTML(c.id)}">
            <div class="history-card-main">
              <b>${escapeHTML(c.title || "Sin título")}</b>
              <small>${n} mensaje${n === 1 ? "" : "s"}${branches ? ` · ${branches} rama${branches === 1 ? "" : "s"}` : ""}</small>
            </div>
            <div class="history-card-actions">
              <button type="button" class="icon-btn" data-action="open" aria-label="Abrir conversación"><span class="ic sm">open_in_new</span></button>
              <button type="button" class="icon-btn" data-action="rename" aria-label="Renombrar conversación"><span class="ic sm">edit</span></button>
              <button type="button" class="icon-btn danger-icon" data-action="delete" aria-label="Eliminar conversación"><span class="ic sm">delete</span></button>
            </div>
          </div>`;
        })
        .join("") +
      (!q && S.conversations.length > 3
        ? `<p class="exp-model-empty">Mostrando los 3 chats más recientes de ${S.conversations.length}. Usa la búsqueda para encontrar los demás.</p>`
        : "")
    : `<p class="exp-model-empty">${q ? "No hay conversaciones que coincidan." : "Aún no hay conversaciones. ¡Haz tu primera pregunta en el chat!"}</p>`;
  const wrap = $("#historySearchWrap");
  if (wrap) wrap.hidden = S.conversations.length <= 3;
  const del = $("#deleteCurrent");
  if (del) del.hidden = !current();
  const clear = $("#clearHistory");
  if (clear) clear.hidden = !S.conversations.length;
}

export function updateHistoryStats() {
  const el = $("#historyStats");
  if (!el) return;
  const total = S.conversations.reduce(
    (n, c) => n + (c.nodes ? c.nodes.length : 0),
    0,
  );
  el.innerHTML =
    `<div class="stat"><b>${S.conversations.length}</b><span>Conversaciones</span></div>` +
    `<div class="stat"><b>${total}</b><span>Mensajes</span></div>`;
  $("#deleteCurrent").disabled = !current();
  renderHistoryList();
}

export function openSettings(tab = "ia") {
  activateSettingsTab(tab);
}
/* El perfil del usuario es la entrada a la configuración local de la IA */
export const settingsTabs = document.querySelector(".settings-tabs");
export const tabsQuery = window.matchMedia("(max-width: 600px)");
/* En móvil las pestañas forman una barra horizontal; en escritorio, una columna */
export function syncTabsOrientation() {
  if (settingsTabs)
    settingsTabs.setAttribute(
      "aria-orientation",
      tabsQuery.matches ? "horizontal" : "vertical",
    );
}
