/* Todos los trabajos del usuario con instrucciones, fecha y enlace. */
import { compactMoodleResult } from '../../core/helpers.js';
import { S } from '../../core/state.js';
import { moodleIdsParam, moodleRequest } from '../../moodle/client.js';
import { ensureMoodleSession, ingestMoodleResult } from '../../moodle/session.js';

export const meta = { id: 'moodle-assignments' };

export async function run(order, ctx) {
  await ensureMoodleSession().catch(() => {});
  try {
    const cursos = await moodleRequest('core_enrol_get_users_courses', {
      userid: S.moodleUserId,
    });
    const ids = (Array.isArray(cursos) ? cursos : []).map((c) => c.id).slice(0, 20);
    if (!ids.length) return 'No se encontraron cursos matriculados.';
    const data = await moodleRequest(
      'mod_assign_get_assignments',
      moodleIdsParam(ids, 'courseids'),
    );
    ingestMoodleResult('mod_assign_get_assignments', data);
    return `Trabajos reales de Moodle:\n${compactMoodleResult(data)}`;
  } catch (err) {
    return `No se pudieron consultar los trabajos: ${err.message || err}`;
  }
}
