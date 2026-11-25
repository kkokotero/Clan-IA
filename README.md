# Ritchie AI — asistente con IA **gratuita** (solo frontend)

Asistente educativo de la cohorte que llama **directamente desde el navegador** a modelos
gratuitos de [Google Gemini](https://aistudio.google.com/apikey) u
[OpenRouter](https://openrouter.ai/keys).

**No hay servidor, ni Node, ni `package.json`, ni build.** Abre `index.html` y funciona.

Las respuestas de la IA se generan en **OpenUI Lang**, pero se dibujan con un **renderizador
propio** (`app.js` + `styles.css`) que usa los mismos colores, formas y componentes que el resto
de la app: tarjetas, pasos, tablas, pestañas, avisos y formularios en lugar de texto plano. El
bundle de [OpenUI](https://openui.com/) se carga desde CDN **solo para construir el prompt**; si
no carga, se usa un prompt mínimo y las respuestas siguen viéndose con la estética de la app.

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
5. Cada respuesta de la IA tiene **Copiar** y **Rehacer**; cada mensaje tuyo tiene **Copiar**
   y **Editar**. Al editar se crea una rama nueva: usa el selector **Rama 1/2** para
   cambiar entre versiones dentro del mismo chat.

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

## Respuestas con interfaz propia

- `index.html` carga solo el bundle de `@openuidev/browser-bundle@0.2` desde jsDelivr, que
  expone `openuiChatLibrary` en `window.__OpenUI`. Ya **no se carga su CSS ni su Renderer**.
- `app.js` usa `openuiChatLibrary.prompt({...})` para generar el system prompt: así el modelo
  conoce la sintaxis y los componentes permitidos. Las reglas de la cohorte y de privacidad se
  pasan como `preamble`.
- La IA devuelve un programa (siempre empieza con `root = Card(...)`) y un intérprete propio en
  `app.js` lo convierte en HTML con las clases de la app. El prompt incluye ejemplos y reglas
  para combinar **tarjetas, encabezados, callouts, separadores, pasos, tablas, listas, entidades,
  pestañas, etiquetas, botones y sugerencias de seguimiento**, eligiendo la vista según el
  contenido; no inventa cifras para gráficas.
- La respuesta llega **en tiempo real**: se usa `streamGenerateContent` (Gemini) o `stream: true`
  (OpenRouter) y el texto se dibuja con cada fragmento; al terminar se sustituye por la interfaz.
  Si el streaming falla, se usa la llamada normal.
- El prompt pide respuestas desarrolladas (120–250 palabras) con varios componentes,
  prohíbe `Sources`/`CardSourceProvider` y **no muestra nombres de documentos, PDFs, bloques de
  fuente ni notas de autonomía** en los mensajes.
- Los **formularios personalizados** son los mismos componentes en las respuestas de la IA y en
  **Configuración de IA** (`index.html` usa `.ui-form`, `.ui-field`, `.ui-input`, `.ui-select` y
  `.ui-btn`). Usan `Form` con `FormControl`, pistas, `Select`, `Chips`, `OptionCards`, `TextArea`,
  casillas y botones primarios/secundarios: campos tonales de 56 px, estados seleccionados con
  marca de verificación, botones de 48 px y una columna en móvil.
- La tipografía sigue la escala **Material 3 Expressive** y la del resto de la página: títulos
  22/28, cuerpo 16/24, texto secundario 14/20 y etiquetas 15/20; los textos grandes de las
  respuestas ya no se reducen.
- Al enviar un formulario, el chat muestra solo el **mensaje de la persona** (por ejemplo,
  «Guardar mis preferencias»); los datos del formulario viajan ocultos como contexto para la IA
  y se resumen después en una **lista de datos con etiquetas legibles**.
- Si no hay conexión con el CDN, se usa un prompt mínimo, pero las respuestas siguen
  dibujándose con la interfaz propia. Requiere internet solo para cargar el bundle del prompt;
  la API key sigue siendo gratuita y local.

## En móvil

La interfaz usa una **barra superior** (logo, menú, nueva conversación y avatar), no un menú
lateral. El botón de menú despliega el historial y las opciones hacia abajo; el avatar abre la
misma configuración de IA. En el modal de Configuración, las secciones (IA, Chats e historial,
Ayuda y TL) se muestran como una **barra horizontal arriba**, con desplazamiento lateral si no
caben todas en la pantalla.

## Privacidad (importante)

- La API key **no está en el código** y no se envía a ningún servidor propio: viaja
  directamente del navegador a Gemini/OpenRouter.
- Cualquier persona con acceso a ese navegador podría ver la key guardada. Usa una key
  **de prueba y restringida** (en Google AI Studio puedes limitarla por sitio web), y nunca
  una key de producción. Para un despliegue público real, la key debería vivir en un backend.
- Los datos personales detectados en la pregunta se ocultan antes de enviarlos al modelo y
  también se redactan en la respuesta. El texto de la IA se escapa antes de insertarse en el DOM.
- Los temas sensibles (salud, calificaciones, situaciones personales) se derivan al
  TL (Team Leader) y nunca se envían a la IA.

## Archivos

- `index.html`: interfaz, modales (documento y **Configuración**, con secciones de IA,
  chats, ayuda y TL (Team Leader)).
- `styles.css`: estilos, incluido el indicador de conexión y el formulario de IA.
- `app.js`: chat, historial, motor local de respaldo y llamada directa a Gemini/OpenRouter.
- `HALLAZGOS.md`: resultados de la prueba con otro equipo.
