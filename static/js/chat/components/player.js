/* Inicializa Plyr para los vídeos generados por la IA. Si el CDN no cargó,
   se dejan los controles nativos (o un iframe del servicio para embeddings). */
export function initPlayers(root = document) {
  const nodos = [
    ...root.querySelectorAll('.ui-player-plyr'),
    ...root.querySelectorAll('[data-plyr-provider]'),
  ];
  nodos.forEach((nodo) => {
    if (nodo.dataset.ready) return;
    nodo.dataset.ready = '1';
    if (typeof window.Plyr === 'function') {
      try {
        new window.Plyr(nodo, {
          controls: [
            'play-large', 'play', 'progress', 'current-time', 'duration',
            'mute', 'volume', 'settings', 'speed', 'fullscreen',
          ],
          settings: ['speed'],
          speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
          tooltips: { controls: true, seek: true },
          i18n: {
            play: 'Reproducir', pause: 'Pausar', mute: 'Silenciar', unmute: 'Activar sonido',
            volume: 'Volumen', fullscreen: 'Pantalla completa', settings: 'Ajustes',
            speed: 'Velocidad', currentTime: 'Tiempo actual', duration: 'Duración',
          },
        });
        return;
      } catch (e) {}
    }
    /* Sin Plyr: fallback con el reproductor del servicio. */
    if (nodo.dataset.plyrProvider) {
      const id = nodo.dataset.plyrEmbedId;
      const src = nodo.dataset.src || '';
      const embed =
        nodo.dataset.plyrProvider === 'youtube'
          ? `https://www.youtube.com/embed/${encodeURIComponent(id)}`
          : `https://player.vimeo.com/video/${encodeURIComponent(id)}`;
      nodo.innerHTML = `<iframe src="${embed}" title="Vídeo" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:0" data-src="${encodeURIComponent(src)}"></iframe>`;
    }
  });
}
