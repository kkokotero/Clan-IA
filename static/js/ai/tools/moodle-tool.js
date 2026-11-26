import { compactMoodleResult } from '../../core/helpers.js';
import { S } from '../../core/state.js';
import {
  collectMoodleCMIds,
  collectMoodleURLs,
  moodleRequest,
  moodleToolAllowed,
  sanitizeMoodleParams,
} from '../../moodle/client.js';
import { ensureMoodleSession, ingestMoodleResult } from '../../moodle/session.js';

export const meta = { id: 'moodle-tool' };
const SIN_PARAMETROS = new Set([
  'core_webservice_get_site_info',
  'core_country_get_countries',
]);

export async function run(order, ctx) {
  /* La sesión se inicializa aquí, solo cuando una herramienta Moodle corre. */
  await ensureMoodleSession().catch(() => {});
  const fn = order.fn || order.function || order.name;
  if (!fn) return null;
  const params = sanitizeMoodleParams(fn, order);
  let data;
  if (!moodleToolAllowed(fn)) {
    data = { error: `Función no disponible o no permitida: ${fn}` };
  } else if (!Object.keys(params).length && !SIN_PARAMETROS.has(fn)) {
    data = { error: `Faltan parámetros válidos para ${fn}` };
  } else {
    try {
      data = await moodleRequest(fn, params);
      if (fn === 'core_course_get_contents') collectMoodleCMIds(data);
      collectMoodleURLs(data);
    } catch (err) {
      data = { error: String(err.message || err) };
    }
  }
  ctx.entries.push({ fn, params, data });
  ingestMoodleResult(fn, data);
  if (fn === 'core_course_get_contents' && Array.isArray(data))
    S.moodleContents[params.courseid] = data;
  if (fn === 'core_enrol_get_enrolled_users' && Array.isArray(data))
    data.forEach((u) => {
      const id = Number(u && u.id);
      if (id) S.moodlePeopleIds.add(id);
    });
  return null;
}
