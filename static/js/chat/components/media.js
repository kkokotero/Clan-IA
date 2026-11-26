/* Imágenes y vídeos que la IA puede incluir en sus respuestas. */
import { escapeHTML } from '../../core/dom.js';
import { normalizeHref, richText, valText } from './primitives.js';
import { register } from './registry.js';

register("Image", (a) => {
  const src = normalizeHref(valText(a[0]));
  const alt = valText(a[1]) || "Imagen";
  if (!src) return richText(alt);
  return `<figure class="ui-figure">
    <img class="ui-image" src="${escapeHTML(src)}" alt="${escapeHTML(alt)}" loading="lazy" />
    ${a[2] ? `<figcaption>${richText(a[2])}</figcaption>` : ""}
  </figure>`;
});

register("Video", (a) => {
  const src = normalizeHref(valText(a[0]));
  if (!src) return richText(valText(a[1]) || "Vídeo");
  return `<figure class="ui-figure">
    <video class="ui-video" src="${escapeHTML(src)}" controls preload="metadata" playsinline></video>
    ${a[1] ? `<figcaption>${richText(a[1])}</figcaption>` : ""}
  </figure>`;
});
