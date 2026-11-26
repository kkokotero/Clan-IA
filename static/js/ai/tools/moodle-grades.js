/* Calificaciones de los cursos propios (solo lectura). */
import { compactMoodleResult } from '../../core/helpers.js';
import { S } from '../../core/state.js';
import { MOODLE_BLOCKED, moodleIdsParam, moodleRequest } from '../../moodle/client.js';
import { ensureMoodleSession } from '../../moodle/session.js';

export const meta = { id: 'moodle-grades' };

export async function run(order, ctx) {
  await ensureMoodleSession().catch(() => {});
  try {
    const cursos = await moodleRequest('core_enrol_get_users_courses', {
      userid: S.moodleUserId,
    });
    const ids = (Array.isArray(cursos) ? cursos : []).map((c) => c.id).slice(0, 10);
    if (!ids.length) return 'No hay cursos matriculados para consultar notas.';
    const fn = 'gradereport_user_get_grade_items';
    if (MOODLE_BLOCKED.has(fn)) return 'El sitio no expone las calificaciones.';
    const data = await moodleRequest(
      fn,
      { userid: S.moodleUserId, ...moodleIdsParam(ids, 'courseids') },
    );
    return `Calificaciones reales:\n${compactMoodleResult(data)}`;
  } catch (err) {
    return `No se pudieron consultar las calificaciones: ${err.message || err}`;
  }
}
