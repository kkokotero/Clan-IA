/* Componentes interactivos: formularios, controles, botones y enlaces. */
import { escapeHTML } from '../../core/dom.js';
import { register, renderButtons, renderChildren, renderNode } from './registry.js';
import {
  anchorHTML,
  asArray,
  normalizeHref,
  richText,
  safeIconHTML,
  uiId,
  valText,
} from './primitives.js';

register("Form", (a) =>
  `<form class="ui-form form-expressive" data-ui-form="${escapeHTML(valText(a[0]))}">${renderChildren(a[2])}${renderButtons(a[1], true)}</form>`);
register("FormControl", (a) => {
  const id = uiId("ui-field");
  if (a[1] && typeof a[1] === "object") a[1].__uiIcon = a[3];
  const input = renderNode(a[1])
    .replace("<input ", `<input id="${id}" `)
    .replace("<textarea ", `<textarea id="${id}" `)
    .replace("<select ", `<select id="${id}" `);
  return `<div class="ui-field"><label class="ui-label" for="${id}">${richText(a[0])}</label>${input}${a[2] ? `<span class="ui-hint">${richText(a[2])}</span>` : ""}</div>`;
});
register("Input", (a, node) => {
  const rules = a[3] && typeof a[3] === "object" ? a[3] : {};
  const tipo = valText(a[2]) || "text";
  const ico = safeIconHTML(node?.__uiIcon || a[4] || "edit");
  const toggle = tipo === "password"
    ? `<button class="ui-input-action" type="button" data-toggle-pwd aria-label="Mostrar contraseña" aria-pressed="false"><span class="ic sm">visibility</span></button>`
    : "";
  return `<span class="ui-input-wrap">${ico}<input class="ui-input" type="${escapeHTML(tipo)}" name="${escapeHTML(valText(a[0]))}" placeholder="${escapeHTML(valText(a[1]))}"${rules.required ? " required" : ""}>${toggle}</span>`;
});
register("TextArea", (a, node) => {
  const rules = a[3] && typeof a[3] === "object" ? a[3] : {};
  const ico = safeIconHTML(node?.__uiIcon || a[4] || "notes");
  return `<span class="ui-input-wrap ui-input-wrap-top">${ico}<textarea class="ui-input ui-textarea" name="${escapeHTML(valText(a[0]))}" placeholder="${escapeHTML(valText(a[1]))}" rows="${Number(a[2]) || 3}"${rules.required ? " required" : ""}></textarea></span>`;
});
register("Select", (a, node) => {
  const placeholder = valText(a[2]) || "Elige una opción";
  const opciones = asArray(a[1])
    .map(
      (it) =>
        `<option value="${escapeHTML(valText(it?.args?.[0]))}">${escapeHTML(valText(it?.args?.[1]))}</option>`,
    )
    .join("");
  return `<span class="ui-select-custom" data-search="false">
    <button type="button" class="ui-select-trigger" aria-haspopup="listbox" aria-expanded="false">
      ${safeIconHTML(node?.__uiIcon || a[3] || "list")}
      <span class="ui-select-value">${escapeHTML(placeholder)}</span>
      <span class="ic">expand_more</span>
    </button>
    <span class="ui-select-menu" role="listbox" hidden></span>
  </span>
  <select class="ui-select-native" name="${escapeHTML(valText(a[0]))}" hidden><option value="">${escapeHTML(placeholder)}</option>${opciones}</select>`;
});
register("Chips", (a) => {
  const type = a[1] === "multiple" ? "checkbox" : "radio";
  const name = escapeHTML(valText(a[0]));
  return `<div class="ui-chips">${asArray(a[2])
    .map(
      (it) =>
        `<label class="ui-chip"><input type="${type}" name="${name}" value="${escapeHTML(valText(it?.args?.[0]))}"><span>${safeIconHTML(it?.args?.[2])}${escapeHTML(valText(it?.args?.[1]))}</span></label>`,
    )
    .join("")}</div>`;
});
register("OptionCards", (a) => {
  const type = a[1] === "multiple" ? "checkbox" : "radio";
  const name = escapeHTML(valText(a[0]));
  return `<div class="ui-option-cards">${asArray(a[2])
    .map(
      (it) =>
        `<label class="ui-option-card"><input type="${type}" name="${name}" value="${escapeHTML(valText(it?.args?.[0]))}"><span><b>${safeIconHTML(it?.args?.[3])}${escapeHTML(valText(it?.args?.[1]))}</b>${it?.args?.[2] ? `<small>${escapeHTML(valText(it.args[2]))}</small>` : ""}</span></label>`,
    )
    .join("")}</div>`;
});
register("CheckBoxGroup", (a) =>
  `<div class="ui-checks">${asArray(a[1])
    .map(
      (it) =>
        `<label class="ui-check"><input type="checkbox" name="${escapeHTML(valText(a[0]))}" value="${escapeHTML(valText(it?.args?.[2] || valText(it?.args?.[0])))}"><span><b>${safeIconHTML(it?.args?.[3])}${escapeHTML(valText(it?.args?.[0]))}</b>${it?.args?.[1] ? `<small>${escapeHTML(valText(it.args[1]))}</small>` : ""}</span></label>`,
    )
    .join("")}</div>`);
register("SwitchGroup", (a) =>
  `<div class="ui-checks">${asArray(a[1])
    .map(
      (it) =>
        `<label class="ui-check ui-check-switch"><input type="checkbox" name="${escapeHTML(valText(a[0]))}" value="${escapeHTML(valText(it?.args?.[2] || valText(it?.args?.[0])))}"><span><b>${safeIconHTML(it?.args?.[3])}${escapeHTML(valText(it?.args?.[0]))}</b>${it?.args?.[1] ? `<small>${escapeHTML(valText(it.args[1]))}</small>` : ""}</span></label>`,
    )
    .join("")}</div>`);
register("RadioGroup", (a) =>
  `<div class="ui-checks">${asArray(a[1])
    .map(
      (it) =>
        `<label class="ui-check"><input type="radio" name="${escapeHTML(valText(a[0]))}" value="${escapeHTML(valText(it?.args?.[2]))}"><span><b>${safeIconHTML(it?.args?.[3])}${escapeHTML(valText(it?.args?.[0]))}</b>${it?.args?.[1] ? `<small>${escapeHTML(valText(it.args[1]))}</small>` : ""}</span></label>`,
    )
    .join("")}</div>`);
register("Buttons", (args, node) => renderButtons(node));
register("Button", (args, node) => renderButtons(node));
register("LinkButton", (a) => {
  const href = normalizeHref(valText(a[1]));
  const label = valText(a[0]);
  const variant = ["primary", "secondary", "tertiary"].includes(a[2]) ? a[2] : "secondary";
  const ico = safeIconHTML(a[3] || "open_in_new");
  return href
    ? `<a class="ui-btn ui-btn-${variant}" href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${ico}${escapeHTML(label)}</a>`
    : escapeHTML(label);
});
register("Link", (a) => {
  const label = richText(a[0]);
  const href = normalizeHref(valText(a[1]));
  return href ? anchorHTML(label, href) : label;
});
register("TextLink", (a) => {
  const label = richText(a[0]);
  const href = normalizeHref(valText(a[1]));
  return href ? anchorHTML(label, href) : label;
});
register("FollowUpBlock", (a) =>
  `<div class="ui-follow"><span>Preguntas relacionadas</span>${asArray(a[0])
    .map(
      (it) =>
        `<button type="button" class="ui-follow-item" data-toassistant="${escapeHTML(valText(it?.args?.[0]))}">${safeIconHTML(it?.args?.[1])}${escapeHTML(valText(it?.args?.[0]))}</button>`,
    )
    .join("")}</div>`);
