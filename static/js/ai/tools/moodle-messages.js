/* Conversaciones y mensajes de Moodle del usuario. */
import { compactMoodleResult } from '../../core/helpers.js';
import { S } from '../../core/state.js';
import { moodleRequest } from '../../moodle/client.js';
import { ensureMoodleSession } from '../../moodle/session.js';

export const meta = { id: 'moodle-messages' };

export async function run(order, ctx) {
  await ensureMoodleSession().catch(() => {});
  try {
    const conversaciones = await moodleRequest('core_message_get_conversations', {
      userid: S.moodleUserId,
      limitnum: 20,
    });
    const id = order.conversationid;
    let mensajes = [];
    if (id) {
      mensajes = await moodleRequest('core_message_get_messages', {
        userid: S.moodleUserId,
        conversationid: id,
        limitnum: 20,
      });
    }
    return `Mensajes de Moodle:\n${compactMoodleResult({ conversaciones, mensajes })}`;
  } catch (err) {
    return `No se pudieron consultar los mensajes: ${err.message || err}`;
  }
}
