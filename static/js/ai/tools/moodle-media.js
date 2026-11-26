/* Imágenes y vídeos de Moodle: devuelve una URL directa con token para que la
   IA pueda usarla en los componentes Image/Video. */
import { S } from '../../core/state.js';
import {
  moodleDirectURL,
  moodleSafeURL,
} from '../../moodle/client.js';
import { ensureMoodleSession } from '../../moodle/session.js';

export const meta = { id: 'moodle-media' };

const extension = (url) =>
  (String(url).match(/\.(png|jpe?g|gif|webp|svg|mp4|webm|ogg|mov)(\?|$)/i) || [])[1] || "";

export async function run(order, ctx) {
  await ensureMoodleSession().catch(() => {});
  const buscado = String(order.url || order.name || order.query || '').trim();
  if (!buscado) return 'Indica una URL de Moodle o el nombre de un archivo.';
  let url = moodleDirectURL(buscado);
  if (!url && !moodleSafeURL(buscado)) {
    const coincidencia = S.moodleURLs.find((u) =>
      String(u).toLowerCase().includes(buscado.toLowerCase()),
    );
    url = coincidencia ? moodleDirectURL(coincidencia) : null;
  }
  if (!url) return `No encontré «${buscado}» entre los archivos de Moodle consultados.`;
  const ext = extension(url);
  if (!ext) return `El archivo no es una imagen ni un vídeo: ${url}`;
  const tipo = /^(mp4|webm|ogg|mov)$/i.test(ext) ? 'vídeo' : 'imagen';
  return `Archivo de Moodle (${tipo}) listo para compartir: ${url}`;
}
