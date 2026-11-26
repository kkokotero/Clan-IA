/* Política: si la IA respondió sin consultar nada, se descubre una sola vez
   el mínimo necesario (cursos propios), sin precargar el resto. */
import { S, getMoodle } from '../../core/state.js';
import { moodleRequest } from '../../moodle/client.js';
import { ensureMoodleSession, ingestMoodleResult } from '../../moodle/session.js';

export async function maybe(question, ctx) {
  if (ctx.autoDescubierto || !getMoodle().token || !S.moodleUserId) return null;
  if (ctx.moodleData) return null;
  ctx.autoDescubierto = true;
  await ensureMoodleSession().catch(() => {});
  try {
    const data = await moodleRequest('core_enrol_get_users_courses', {
      userid: S.moodleUserId,
    });
    ingestMoodleResult('core_enrol_get_users_courses', data);
    ctx.moodleData = true;
    return 'Descubrí tus cursos reales en Moodle con una sola consulta. Usa esos datos y verifícalos con MOODLE_VERIFY.';
  } catch (e) {
    return 'No pude consultar tus cursos en Moodle con esos datos. Si no puedes responder con información real, responde exactamente MOODLE_NOT_FOUND.';
  }
}
