# Ritchie AI — asistente con IA **gratuita** (solo frontend)

Asistente educativo de la cohorte que llama **directamente desde el navegador** a modelos
gratuitos de [Google Gemini](https://aistudio.google.com/apikey) u
[OpenRouter](https://openrouter.ai/keys).

**No hay servidor, ni Node, ni `package.json`, ni build.** Abre `index.html` y funciona.

Las respuestas de la IA se generan en **OpenUI Lang** y se dibujan con el renderer oficial de
[OpenUI](https://openui.com/) (`@openuidev/browser-bundle`) cargado desde CDN: tarjetas, pasos,
tablas y avisos en lugar de texto plano. Si el CDN no carga, la app degrada a respuestas en texto.

> Los documentos de la cohorte son ficticios (de demostración). Sin una API key configurada,
> la app responde con su motor local de respaldo y lo indica en la barra lateral.

## Cómo usarlo

1. Abre **`index.html`** en tu navegador (doble clic; no necesitas servidor).
2. Haz clic en tu **perfil** (abajo en la barra lateral; en móvil, tu avatar en la barra
   superior) → se abre **Configurar IA**.
3. Elige proveedor, selecciona un modelo de la **lista desplegable** y pega tu API key
   gratuita. Puedes pulsar **Probar conexión** antes de guardar:
   - **Google Gemini** → crea una key en https://aistudio.google.com/apikey.
     Modelos gratuitos vigentes: `gemini-4-hydrogen` (recomendado) y
     `gemini-3.5-flash-lite` (rápido). Los antiguos `gemini-3.8-flash`, `3.6-flash`,
     `3.5-flash`, `2.5-flash` y `2.0-flash` están deprecados o saturados (503) y se
     eliminaron de la lista.
   - **OpenRouter** → crea una key en https://openrouter.ai/keys. Por defecto
     `openrouter/free`; también Nemotron 3 Ultra, ERNIE 5.5 Flash, Nemotron 3.5
     Super VL/Lightning, Gemma 4 26B y Ling 3.2 Flash (todos `:free`).
4. Guarda. El indicador debe pasar a **"IA activa · Google Gemini"** (u OpenRouter).

La clave se guarda en `localStorage` de tu navegador (en tu máquina, sin servidor), bajo la
clave `ritchie-ia-config-ia`. El perfil muestra el estado (`IA activa · …` o `Configurar IA
(local)`). Puedes quitarla cuando quieras con **Quitar key**.

## Cambiar de proveedor o modelo

Vuelve a tu perfil → **Configurar IA**. Al cambiar de proveedor, la lista de modelos se
actualiza automáticamente y se selecciona el recomendado. Si necesitas un modelo que no
aparece, elige **Otro (escribir ID)** en la lista y escribe el ID exacto; el campo aparece
solo en ese caso.

Si un modelo responde **503/429** (alta demanda o cuota), la app reintenta automáticamente
con el siguiente modelo gratuito de la lista antes de mostrar el error.

## Respuestas con OpenUI

- `index.html` carga el CSS y el bundle de `@openuidev/browser-bundle@0.2` desde jsDelivr; el
  bundle expone `window.__OpenUI` con `Renderer`, `createRoot` y `openuiChatLibrary`.
- `app.js` usa `openuiChatLibrary.prompt({...})` para generar el system prompt: así el modelo
  conoce la sintaxis y los componentes permitidos. Las reglas de la cohorte y de privacidad se
  pasan como `preamble`.
- La IA devuelve un programa OpenUI Lang (por ejemplo `root = Card([title, detail, steps])`) y
  el `Renderer` lo convierte en interfaz dentro de cada mensaje.
- La respuesta llega **en tiempo real**: se usa `streamGenerateContent` (Gemini) o `stream: true`
  (OpenRouter) y la interfaz se redibuja con cada fragmento. Si el streaming falla, se usa la
  llamada normal.
- El prompt pide respuestas desarrolladas (120–250 palabras) con varios componentes OpenUI,
  prohíbe `Sources`/`CardSourceProvider` y **no muestra nombres de documentos, PDFs, bloques de
  fuente ni notas de autonomía** en los mensajes.
- El CSS fuerza **colores oscuros y legibles** dentro de la respuesta OpenUI (OpenUI trae textos
  grises muy claros por defecto) y oculta cualquier sección de fuentes que el renderer genere.
- Si no hay conexión con el CDN, se usa un prompt mínimo y las respuestas se muestran como texto.
- Requiere internet para cargar el bundle; la API key sigue siendo gratuita y local.

## En móvil

La interfaz usa una **barra superior** (logo, menú, nueva conversación y avatar), no un menú
lateral. El botón de menú despliega el historial y las opciones hacia abajo; el avatar abre la
misma configuración de IA.

## Privacidad (importante)

- La API key **no está en el código** y no se envía a ningún servidor propio: viaja
  directamente del navegador a Gemini/OpenRouter.
- Cualquier persona con acceso a ese navegador podría ver la key guardada. Usa una key
  **de prueba y restringida** (en Google AI Studio puedes limitarla por sitio web), y nunca
  una key de producción. Para un despliegue público real, la key debería vivir en un backend.
- Los datos personales detectados en la pregunta se ocultan antes de enviarlos al modelo y
  también se redactan en la respuesta. El texto de la IA se escapa antes de insertarse en el DOM.
- Los temas sensibles (salud, calificaciones, situaciones personales) se derivan a un coach
  y nunca se envían a la IA.

## Archivos

- `index.html`: interfaz, modales (coach, ayuda, documento y **Configurar IA**).
- `styles.css`: estilos, incluido el indicador de conexión y el formulario de IA.
- `app.js`: chat, historial, motor local de respaldo y llamada directa a Gemini/OpenRouter.
- `HALLAZGOS.md`: resultados de la prueba con otro equipo.
