import { $, closeMenu } from './dom.js';
import { S, busy, conversations, currentId, editingId, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from './state.js';
export function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.hidden = false;
  const btn = m.querySelector(".btn-filled, .ui-btn-primary");
  if (btn) btn.focus();
}
export let pendingConfirm = null;
export function settleConfirm(value) {
  const resolve = pendingConfirm;
  pendingConfirm = null;
  document.querySelectorAll(".modal").forEach((m) => (m.hidden = true));
  if (resolve) resolve(Boolean(value));
}
export function askConfirmation(description) {
  return new Promise((resolve) => {
    pendingConfirm = resolve;
    const text = $("#confirmText");
    if (text) text.textContent = String(description || "").slice(0, 1400);
    openModal("confirmModal");
  });
}
export function closeModals() {
  document.querySelectorAll(".modal").forEach((m) => (m.hidden = true));
  if (pendingConfirm) settleConfirm(false);
}
export function initModals() {
  document.querySelectorAll(".modal").forEach((m) =>
    m.addEventListener("click", (e) => {
      if (e.target === m || e.target.closest("[data-close]")) closeModals();
    }),
  );
  const confirmModal = $("#confirmModal");
  if (confirmModal)
    confirmModal.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-confirm]");
      if (btn) settleConfirm(btn.dataset.confirm === "yes");
    });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModals();
      closeMenu();
    }
  });
}
