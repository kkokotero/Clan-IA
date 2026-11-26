import { S, busy, conversations, currentId, editingId, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from './state.js';
export const $ = (sel) => document.querySelector(sel);
export const app = $("#app");
export const main = $(".main");
export const landing = $("#landing");
export const chat = $("#chat");
export const welcome = $("#welcome");
export const messagesEl = $("#messages");
export const form = $("#form");
export const composerWrap = $(".composer-wrap");
export const input = $("#input");
export const sendBtn = $("#send");
export const historyEl = $("#history");
export const icon = (name, cls = "") => `<span class="ic ${cls}">${name}</span>`;
export const LOGO_MINI = `<div class="logo-tile mini" aria-hidden="true"><span class="logo">cruelty_free</span></div>`;

export const facts = (rows) =>
  `<ul class="facts">${rows
    .map(
      ([ic, label, value]) =>
        `<li><span class="fi">${icon(ic)}</span><span class="ft"><b>${label}</b><span>${value}</span></span></li>`,
    )
    .join("")}</ul>`;

export const normalize = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") + " ";
export const escapeHTML = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const menuQuery = window.matchMedia("(max-width: 900px)");
export const menuToggle = $("#menuToggle");

export function setMenu(open) {
  app.dataset.menu = open ? "open" : "closed";
  [menuToggle, $("#mobileMenuBtn")].forEach((btn) => {
    if (!btn) return;
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  });
}

/* En escritorio el panel permanece; en móvil se cierra el desplegable superior. */
export function closeMenu() {
  if (menuQuery.matches) setMenu(false);
}
