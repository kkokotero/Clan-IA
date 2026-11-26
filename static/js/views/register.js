import { $, chat } from '../core/dom.js';
import { S, busy, conversations, currentId, editingId, getMoodle, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId, resetMoodleData, saveMoodle } from '../core/state.js';
import { moodleLogin } from '../moodle/client.js';
import { setMoodleStatus } from '../moodle/session.js';
if (getMoodle().token) window.location.replace('/chat/');
if (new URLSearchParams(window.location.search).get('moodle') === 'renovar')
  setMoodleStatus('Tu sesión de Moodle venció. Vuelve a ingresar para renovarla.');
export function initRegister() {
  /* Mostrar / ocultar la contraseña escrita. */
  const toggle = $("#togglePassword");
  toggle?.addEventListener("click", () => {
    const pwd = $("#moodlePassword");
    if (!pwd) return;
    const visible = pwd.type === "password";
    pwd.type = visible ? "text" : "password";
    toggle.setAttribute("aria-pressed", String(visible));
    toggle.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
    const icon = toggle.querySelector(".ic");
    if (icon) icon.textContent = visible ? "visibility_off" : "visibility";
    pwd.focus();
  });

  $("#moodleForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    const base = getMoodle().base;
    /* El botón muestra un indicador de carga en lugar de texto. */
    const originalLabel = btn.innerHTML;
    btn.innerHTML = '<span class="ui-btn-spinner" aria-hidden="true"></span>';
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    btn.setAttribute("aria-label", "Ingresando");
    try {
      const token = await moodleLogin(
        $("#moodleUsername").value.trim(),
        $("#moodlePassword").value,
      );
      /* La contraseña se descarta en cuanto obtuvimos el token */
      $("#moodlePassword").value = "";
      /* El registro solo guarda el token: nada de cursos ni materiales aquí.
         Los datos de Moodle se consultan después, bajo demanda, con MOODLE_TOOL. */
      resetMoodleData();
      saveMoodle({ token, base });
      setMoodleStatus("");
      /* Sesión activa: salimos del registro y entramos al chat. */
      const pendiente = localStorage.getItem('ritchie-ia-chat-pendiente');
    localStorage.removeItem('ritchie-ia-chat-pendiente');
    window.location.assign(
      pendiente ? `/chat/?chat=${encodeURIComponent(pendiente)}` : '/chat/',
    );
    } catch (err) {
      const raw = String(err.message || err).trim();
      let titulo = "No se pudo iniciar sesión";
      let detalle = "Revisa tus credenciales e inténtalo de nuevo. Si persiste, contacta al TL.";
      if (/invalidlogin|invalid login|acceso inválido|contraseña|usuario|wrong password|invalid credentials/i.test(raw)) {
        titulo = "Usuario o contraseña incorrectos";
        detalle = "Verifica tus datos de Moodle e inténtalo otra vez.";
      } else if (/contexto de curso|no accesible|course id/i.test(raw)) {
        titulo = "Tu cuenta no tiene acceso a todos los cursos";
        detalle = "Solo consultamos tus cursos matriculados. Si persiste, pide al TL que revise los permisos.";
      } else if (/servicio|webservice|not enabled|disabled|403|404/i.test(raw)) {
        titulo = "Moodle no permite el ingreso por servicios web";
        detalle = "Pide al Team Leader que active los servicios web para tu cuenta.";
      } else if (/red|network|fetch|failed|timeout|offline|cors/i.test(raw)) {
        titulo = "No pudimos conectar con Moodle";
        detalle = "Revisa tu conexión e inténtalo de nuevo.";
      }
      setMoodleStatus(`${titulo}. ${detalle}`, true);
    } finally {
      btn.innerHTML = originalLabel;
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      btn.removeAttribute("aria-label");
    }
  });
}
initRegister();

