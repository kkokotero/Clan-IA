/* Cursos propios y sus secciones/materiales. */
import { compactMoodleResult } from '../../core/helpers.js';
import { S } from '../../core/state.js';
import { collectMoodleCMIds, moodleRequest } from '../../moodle/client.js';
import { ensureMoodleSession, ingestMoodleResult } from '../../moodle/session.js';

export const meta = { id: 'moodle-courses' };

export async function run(order, ctx) {
  await ensureMoodleSession().catch(() => {});
  try {
    const cursos = await moodleRequest('core_enrol_get_users_courses', {
      userid: S.moodleUserId,
    });
    const ids = (Array.isArray(cursos) ? cursos : []).map((c) => c.id).slice(0, 20);
    const salida = [];
    for (const id of ids) {
      const contenido = await moodleRequest('core_course_get_contents', { courseid: id });
      collectMoodleCMIds(contenido);
      ingestMoodleResult('core_course_get_contents', contenido);
      S.moodleContents[id] = contenido;
      salida.push({ curso: cursos.find((c) => c.id === id)?.fullname || id, secciones: contenido.length });
    }
    return `Cursos y secciones reales:\n${compactMoodleResult(salida)}`;
  } catch (err) {
    return `No se pudieron consultar los cursos: ${err.message || err}`;
  }
}
