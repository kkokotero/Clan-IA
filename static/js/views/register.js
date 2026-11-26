import { $, chat } from '../core/dom.js';
import { S, busy, conversations, currentId, editingId, getMoodle, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId, resetMoodleData, saveMoodle } from '../core/state.js';
import { moodleLogin } from '../moodle/client.js';
import { setMoodleStatus } from '../moodle/session.js';
if (getMoodle().token) window.location.replace('/chat/');
export function initRegister() {
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
      window.location.assign('/chat/');
    } catch (err) {
      const msg = String(err.message || err);
      const detail = /invalidlogin|acceso inválido|contraseña|usuario/i.test(msg)
        ? "Revisa tu usuario y contraseña."
        : /contexto de curso|no accesible/i.test(msg)
          ? "Tu cuenta no tiene acceso a todos los cursos del sitio; ya solo consultamos tus cursos matriculados. Si persiste, pide al TL que active los servicios web."
          : "Revisa tus credenciales y que los servicios web estén activos.";
      setMoodleStatus(`No se pudo ingresar: ${msg} ${detail}`, true);
    } finally {
      btn.innerHTML = originalLabel;
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      btn.removeAttribute("aria-label");
    }
  });
}
initRegister();

