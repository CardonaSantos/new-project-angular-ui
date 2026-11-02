import {gcErrorMessage} from '../../../core/http/api-error';

const technicalTerms=/^Menú incompleto:/i;
/** Nest may report identifiers/enums for a failed publication: show actionable guidance instead. */
export function catalogUiError(error:unknown):string {
 const raw=gcErrorMessage(error);
 if(/property\s+\w+\s+should not exist/i.test(raw))
  return 'No se pudo procesar esta solicitud. Actualiza la página e inténtalo de nuevo.';
 if(technicalTerms.test(raw))
  return 'No se puede publicar todavía. Revisa las fotos, los precios y la disponibilidad de los productos en cada sucursal.';
 if(/menú modificado por otra sesión|la versión del menú cambió/i.test(raw))
  return 'Esta carta se modificó en otra sesión. Actualiza la información antes de guardar.';
 return raw;
}
