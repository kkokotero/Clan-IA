/* Busca en los datos de Moodle ya consultados en esta sesión (sin más llamadas). */
import { compactMoodleResult } from '../../core/helpers.js';
import { S } from '../../core/state.js';

export const meta = { id: 'moodle-search' };

export async function run(order, ctx) {
  const q = String(order.q || order.query || order.text || '').trim().toLowerCase();
  if (!q) return 'Indica qué quieres buscar.';
  const encontrados = {
    cursos: S.moodleCourses.filter((c) => String(c.fullname || '').toLowerCase().includes(q)),
    materiales: S.moodleMaterials.filter((m) =>
      String(m.title || '').toLowerCase().includes(q) ||
      String(m.detail || '').toLowerCase().includes(q),
    ),
    tareas: S.moodleTasks.filter((t) => String(t.name || '').toLowerCase().includes(q)),
    eventos: S.moodleEvents.filter((e) => String(e.name || '').toLowerCase().includes(q)),
    enlaces: S.moodleURLs.filter((u) => String(u).toLowerCase().includes(q)).slice(0, 20),
  };
  return `Resultados en los datos ya consultados:\n${compactMoodleResult(encontrados)}`;
}
