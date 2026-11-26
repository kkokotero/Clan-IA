/* Utilidades compartidas por los componentes de la interfaz generada. */
import { escapeHTML } from '../../core/dom.js';

export let uiSeq = 0;
export const uiId = (prefix) => `${prefix}-${++uiSeq}`;

/* Iconos de Material Symbols: solo nombres seguros, definidos por el modelo. */
export const safeIconHTML = (value, cls = "") => {
  const name = String(value == null ? "" : value).trim();
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(name)) return "";
  return `<span class="ic ${cls}">${name}</span>`;
};

export const valText = (v) =>
  v == null ? "" : typeof v === "object" ? "" : String(v);
export const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

/* Enlaces del texto: http(s), www. o rutas internas de la app. */
const URL_INICIO = "(?:https?:\\/\\/|www\\.|\\/(?!\\/))";
export const MD_LINK = new RegExp(`\\[([^\\]\\n]+)\\]\\((${URL_INICIO}[^\\s)]+)\\)`, "gi");
export const BARE_URL = new RegExp(`(^|[\\s(])(${URL_INICIO}[^\\s<>()]+)`, "gi");
export const formatInline = (s) =>
  s
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<i>$1</i>");
export const normalizeHref = (raw) => {
  const s = String(raw).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^www\./i.test(s)) return `https://${s}`;
  if (/^\/(?!\/)/.test(s)) return s;
  return null;
};
export const anchorHTML = (label, href) =>
  `<a class="ui-link" href="${escapeHTML(String(href))}" target="_blank" rel="noopener noreferrer">${label}</a>`;
export function richText(v) {
  const links = [];
  let out = escapeHTML(valText(v)).replace(MD_LINK, (match, label, href) => {
    const safe = normalizeHref(href);
    if (!safe) return match;
    const token = `\u0000${links.length}\u0000`;
    links.push(anchorHTML(formatInline(label), safe));
    return token;
  });
  out = formatInline(out).replace(/\r?\n/g, "<br>");
  out = out.replace(BARE_URL, (match, before, url) => {
    const clean = url.replace(/[.,;:!?]+$/, "");
    const safe = normalizeHref(clean);
    if (!safe) return match;
    return `${before}${anchorHTML(safe, safe)}${url.slice(clean.length)}`;
  });
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)] || "");
}
export function actionText(v) {
  if (!v) return "";
  if (Array.isArray(v)) return actionText(v[0]);
  return v.step === "ToAssistant" ? valText(v.args?.[0]) : "";
}
