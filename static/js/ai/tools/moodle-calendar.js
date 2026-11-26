/* Eventos del calendario del usuario. */
import { compactMoodleResult } from '../../core/helpers.js';
import { S } from '../../core/state.js';
import { moodleRequest } from '../../moodle/client.js';
import { ensureMoodleSession } from '../../moodle/session.js';

export const meta = { id: 'moodle-calendar' };

export async function run(order, ctx) {
  await ensureMoodleSession().catch(() => {});
  const dias = Math.min(Math.max(Number(order.days) || 60, 1), 365);
  try {
    const data = await moodleRequest('core_calendar_get_calendar_events', {
      userid: S.moodleUserId,
      days: dias,
    });
    return `Eventos reales de Moodle (${dias} días):\n${compactMoodleResult(data)}`;
  } catch (err) {
    return `No se pudo consultar el calendario: ${err.message || err}`;
  }
}
