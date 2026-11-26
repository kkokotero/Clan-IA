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

/* Vídeo: usa Plyr como motor de controles y visualización. */
const embedInfo = (src) => {
  const url = new URL(src);
  const host = url.hostname.replace(/^www\./, "");
  let provider, id;
  if (host === "youtube.com" || host === "m.youtube.com") {
    provider = "youtube";
    id = url.pathname === "/watch"
      ? url.searchParams.get("v")
      : url.pathname.startsWith("/shorts/")
        ? url.pathname.split("/")[2]
        : url.pathname.startsWith("/embed/")
          ? url.pathname.split("/")[2]
          : null;
  } else if (host === "youtu.be") {
    provider = "youtube";
    id = url.pathname.slice(1).split("/")[0];
  } else if (host === "vimeo.com") {
    provider = "vimeo";
    id = url.pathname.slice(1).split("/")[0];
  }
  return id ? { provider, id } : null;
};

register("Video", (a) => {
  const src = normalizeHref(valText(a[0]));
  if (!src) return richText(valText(a[1]) || "Vídeo");
  const pie = a[1] ? `<figcaption>${richText(a[1])}</figcaption>` : "";
  const embed = embedInfo(src);
  if (embed)
    return `<figure class="ui-figure">
      <div class="plyr__video-embed" data-plyr-provider="${embed.provider}" data-plyr-embed-id="${escapeHTML(embed.id)}" data-src="${escapeHTML(src)}"></div>
      ${pie}
    </figure>`;
  return `<figure class="ui-figure">
    <video class="ui-player-plyr" src="${escapeHTML(src)}" controls playsinline preload="metadata"></video>
    ${pie}
  </figure>`;
});
