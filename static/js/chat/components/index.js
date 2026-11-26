/* Punto de entrada del sistema de UI propio. Importa los módulos que registran
   cada componente y expone el renderizador y las utilidades al resto de la app. */
import './layout.js';
import './data.js';
import './forms.js';
import './media.js';
import './visual.js';
import './charts.js';

export { renderNode, renderButtons, renderChildren } from './registry.js';
export {
  uiId,
  valText,
  asArray,
  richText,
  formatInline,
  normalizeHref,
  anchorHTML,
  actionText,
} from './primitives.js';
