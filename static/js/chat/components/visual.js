/* Componentes de visualización: calendario navegable, vistas por horas y
   tarjeta de confirmación para acciones que afectan algo. */
import { escapeHTML } from '../../core/dom.js';
import { asArray, safeIconHTML, valText } from './primitives.js';
import { register } from './registry.js';

const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const HORAS = Array.from({ length: 14 }, (_, i) => i + 7);
const fechaClave = (v) => String(valText(v) || "").slice(0, 10);
const eventosDe = (args) =>
  asArray(args).map((e) => ({
    fecha: fechaClave(e?.args?.[0]),
    titulo: valText(e?.args?.[1]),
    detalle: valText(e?.args?.[2]),
    icono: valText(e?.args?.[3]) || "event",
  }));

function rejilla(anio, mes, eventos) {
  const inicio = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const total = new Date(anio, mes + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < inicio; i++) celdas.push('<div class="ui-cal-dia vacio"></div>');
  for (let d = 1; d <= total; d++) {
    const clave = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const delDia = eventos.filter((e) => e.fecha === clave);
    celdas.push(`<div class="ui-cal-dia"><span class="ui-cal-num">${d}</span>${delDia
      .map(
        (e) =>
          `<span class="ui-cal-evento">${safeIconHTML(e.icono)}<b>${escapeHTML(e.titulo)}</b>${e.detalle ? `<small>${escapeHTML(e.detalle)}</small>` : ""}</span>`,
      )
      .join("")}</div>`);
  }
  return celdas.join("");
}

function nombreMes(anio, mes) {
  return new Date(anio, mes, 1).toLocaleString("es-CO", { month: "long", year: "numeric" });
}

register("Calendar", (a) => {
  const m = /^(\d{4})-(\d{1,2})/.exec(valText(a[0]));
  const hoy = new Date();
  const anio = m ? Number(m[1]) : hoy.getFullYear();
  const mes = m ? Number(m[2]) - 1 : hoy.getMonth();
  const eventos = eventosDe(a[1]);
  return `<div class="ui-calendar" data-cal anio="${anio}" mes="${mes}" eventos="${escapeHTML(JSON.stringify(eventos))}">
    <div class="ui-cal-head">
      <button type="button" data-cal-prev aria-label="Mes anterior"><span class="ic sm">chevron_left</span></button>
      <b>${escapeHTML(nombreMes(anio, mes))}</b>
      <button type="button" data-cal-next aria-label="Mes siguiente"><span class="ic sm">chevron_right</span></button>
    </div>
    <div class="ui-cal-semana">${DIAS.map((d) => `<span>${d}</span>`).join("")}</div>
    <div class="ui-cal-grid">${rejilla(anio, mes, eventos)}</div>
  </div>`;
});

export function initCalendars(root = document) {
  root.querySelectorAll("[data-cal]").forEach((holder) => {
    if (holder.dataset.ready) return;
    holder.dataset.ready = "1";
    const titulo = holder.querySelector(".ui-cal-head b");
    const grid = holder.querySelector(".ui-cal-grid");
    if (!titulo || !grid) return;
    const mover = (delta) => {
      let anio = Number(holder.dataset.anio);
      let mes = Number(holder.dataset.mes) + delta;
      if (mes < 0) { mes = 11; anio--; }
      if (mes > 11) { mes = 0; anio++; }
      holder.dataset.anio = String(anio);
      holder.dataset.mes = String(mes);
      titulo.textContent = nombreMes(anio, mes);
      let eventos = [];
      try { eventos = JSON.parse(holder.dataset.eventos || "[]"); } catch (e) {}
      grid.innerHTML = rejilla(anio, mes, eventos);
    };
    holder.querySelector("[data-cal-prev]")?.addEventListener("click", () => mover(-1));
    holder.querySelector("[data-cal-next]")?.addEventListener("click", () => mover(1));
  });
}

const horasGrid = (fechas, eventos) =>
  `<div class="ui-horas" style="--col: ${fechas.length}">
    <div class="ui-hora-col ui-hora-label">${HORAS.map((h) => `<span>${String(h).padStart(2, "0")}:00</span>`).join("")}</div>
    ${fechas
      .map(
        (fecha) => `<div class="ui-hora-col">
          <div class="ui-hora-dia">${escapeHTML(fecha)}</div>
          ${HORAS.map((h) => {
            const items = eventos.filter(
              (e) => e.fecha === fecha && Number(e.hora) === h,
            );
            return `<div class="ui-hora-celda">${items
              .map(
                (e) => `<span class="ui-cal-evento">${safeIconHTML(e.icono)}<b>${escapeHTML(e.titulo)}</b></span>`,
              )
              .join("")}</div>`;
          }).join("")}
        </div>`,
      )
      .join("")}
  </div>`;

const eventosConHora = (args) =>
  asArray(args).map((e) => {
    const fecha = fechaClave(e?.args?.[0]);
    const horaTexto = String(valText(e?.args?.[0]) || "");
    const m = /T(\d{1,2}):\d{2}/.exec(horaTexto);
    return {
      fecha,
      titulo: valText(e?.args?.[1]),
      detalle: valText(e?.args?.[2]),
      icono: valText(e?.args?.[3]) || "event",
      hora: m ? Number(m[1]) : 9,
    };
  });

register("WeekCalendar", (a) => {
  const base = valText(a[0]) || new Date().toISOString().slice(0, 10);
  const inicio = new Date(`${base}T00:00:00`);
  inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
  const fechas = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
  return `<div class="ui-semana"><div class="ui-cal-head"><b>Semana del ${escapeHTML(fechas[0])}</b></div>${horasGrid(fechas, eventosConHora(a[1]))}</div>`;
});

register("DayCalendar", (a) => {
  const fecha = valText(a[0]) || new Date().toISOString().slice(0, 10);
  return `<div class="ui-semana"><div class="ui-cal-head"><b>${escapeHTML(fecha)}</b></div>${horasGrid([fecha], eventosConHora(a[1]))}</div>`;
});

register("ConfirmTask", (a) => {
  const titulo = valText(a[0]);
  const detalle = valText(a[1]);
  const id = valText(a[2]) || titulo;
  return `<div class="ui-confirm">
    <span class="ui-confirm-ico">${safeIconHTML(a[3] || "help_outline", "lg")}</span>
    <div class="ui-confirm-text"><b>${escapeHTML(titulo)}</b>${detalle ? `<p>${escapeHTML(detalle)}</p>` : ""}</div>
    <div class="ui-buttons">
      <button type="button" class="ui-btn ui-btn-primary" data-toassistant="${escapeHTML(`Confirmar ${id}`)}">Confirmar</button>
      <button type="button" class="ui-btn ui-btn-secondary" data-toassistant="${escapeHTML(`Cancelar ${id}`)}">Cancelar</button>
    </div>
  </div>`;
});
