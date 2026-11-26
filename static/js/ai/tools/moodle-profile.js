/* Perfil completo del usuario desde Moodle (datos reales, bajo demanda). */
import { compactMoodleValue } from '../../core/helpers.js';
import { S } from '../../core/state.js';
import { moodleIdsParam, moodleRequest } from '../../moodle/client.js';
import { ensureMoodleSession } from '../../moodle/session.js';

export const meta = { id: 'moodle-profile' };

export async function run(order, ctx) {
  await ensureMoodleSession().catch(() => {});
  try {
    const [user] = await moodleRequest('core_user_get_users_by_field', {
      field: 'id',
      ...moodleIdsParam([S.moodleUserId], 'values'),
    });
    if (!user) return 'No se pudo leer tu perfil de Moodle.';
    const campos = [
      'id', 'username', 'firstname', 'lastname', 'fullname', 'email',
      'city', 'country', 'timezone', 'institution', 'department',
      'phone1', 'phone2', 'url', 'alternatename', 'description', 'idnumber',
    ];
    const perfil = {};
    campos.forEach((c) => {
      if (user[c] != null && String(user[c]).trim()) perfil[c] = user[c];
    });
    return `Perfil real de Moodle: ${JSON.stringify(compactMoodleValue(perfil))}`;
  } catch (err) {
    return `No se pudo leer tu perfil: ${err.message || err}`;
  }
}
