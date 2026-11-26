/* Registro propio de componentes: el modelo devuelve un programa y aquí se
   resuelve cada tipo a su función de dibujo (HTML con las clases de la app). */
import { escapeHTML } from '../../core/dom.js';
import { actionText, asArray, normalizeHref, richText, safeIconHTML, valText } from './primitives.js';

const registry = new Map();
export function register(type, draw) {
  registry.set(type, draw);
}

export function renderNode(node) {
  if (node == null || node === false) return "";
  if (Array.isArray(node)) return node.map(renderNode).join("");
  if (typeof node !== "object" || !node.type) return richText(node);
  const args = node.args || [];
  const draw = registry.get(node.type);
  if (draw) return draw(args, node);
  const child = args.find(Array.isArray);
  if (child) return child.map(renderNode).join("");
  const textos = args.filter((x) => typeof x === "string" && x.trim());
  return textos.length ? textos.map(richText).join(" ") : richText(args[0]);
}

export const renderChildren = (args) => asArray(args).map(renderNode).join("");

export function renderButtons(node, inForm = false) {
  const list =
    node && node.type === "Buttons" ? asArray(node.args?.[0]) : asArray(node);
  const vertical = node?.args?.[1] === "column";
  const full = inForm && list.length === 1;
  const body = list
    .map((b, i) => {
      if (!b || b.type !== "Button") return renderNode(b);
      const label = valText(b.args?.[0]);
      const action = actionText(b.args?.[1]);
      const variant = ["primary", "secondary", "tertiary"].includes(b.args?.[2])
        ? b.args?.[2]
        : "secondary";
      const href = action ? null : normalizeHref(valText(b.args?.[1]));
      if (href)
        return `<a class="ui-btn ui-btn-${variant}" href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>`;
      const submit = inForm && i === 0 && action;
      return `<button type="${submit ? "submit" : "button"}" class="ui-btn ui-btn-${variant}"${action ? ` data-toassistant="${escapeHTML(action)}"` : ""}>${safeIconHTML(b.args?.[3])}${escapeHTML(label)}</button>`;
    })
    .join("");
  return `<div class="ui-buttons${vertical ? " ui-buttons-column" : ""}${full ? " ui-buttons-full" : ""}">${body}</div>`;
}
