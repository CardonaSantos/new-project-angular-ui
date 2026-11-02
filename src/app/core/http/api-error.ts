import { HttpErrorResponse } from '@angular/common/http';

export interface GcFieldIssue { field: string; message: string }

export class GcApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldIssues: readonly GcFieldIssue[] = [],
    public readonly source?: HttpErrorResponse,
  ) {
    super(message);
    this.name = 'GcApiError';
  }
}

const defaultMessages: Record<number, string> = {
  0: 'No se pudo conectar al servidor. Comprueba tu conexión e inténtalo de nuevo.',
  400: 'Los datos enviados no son válidos. Revisa el formulario.',
  401: 'Tu sesión no es válida o ha caducado. Inicia sesión nuevamente.',
  403: 'No tienes permiso para realizar esta operación.',
  404: 'No se encontró el recurso solicitado.',
  409: 'La operación entra en conflicto con el estado actual. Actualiza los datos.',
  422: 'Hay datos pendientes de corregir.',
  429: 'Demasiados intentos. Espera un momento antes de volver a probar.',
  500: 'Ocurrió un error interno del servidor. Inténtalo de nuevo.',
  502: 'El servidor no está disponible temporalmente.',
  503: 'El servicio no está disponible temporalmente.',
  504: 'El servidor tardó demasiado en responder.',
};

function messageText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const message = value.trim().replace(/\s+/g, ' ');
  return message ? message.slice(0, 320) : null;
}

function readMessage(payload: unknown): string | null {
  if (typeof payload === 'string') return messageText(payload);
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (typeof record['message'] === 'string') return messageText(record['message']);
  if (Array.isArray(record['message'])) {
    const messages = record['message'].map(messageText).filter((s): s is string => !!s);
    return messages.length ? messages.slice(0, 4).join(' · ').slice(0, 320) : null;
  }
  return null;
}

function readFieldIssues(payload: unknown): GcFieldIssue[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const candidates = record['fieldErrors'] ?? record['errors'];
  if (!Array.isArray(candidates)) return [];
  return candidates.flatMap((item): GcFieldIssue[] => {
    if (!item || typeof item !== 'object') return [];
    const issue = item as Record<string, unknown>;
    const field = messageText(issue['field']);
    const message = messageText(issue['message']);
    return field && message ? [{ field, message }] : [];
  }).slice(0, 30);
}

/** Preserves safe, readable NestJS messages while hiding raw server internals. */
export function gcNormalizeHttpError(error: HttpErrorResponse): GcApiError {
  const status = error.status;
  const fallback = defaultMessages[status] ??
    (status >= 500 ? defaultMessages[500] : 'No se pudo completar la operación.');
  // The API may return descriptive 4xx messages; do not expose 5xx internals.
  const detail = status >= 400 && status < 500 ? readMessage(error.error) : null;
  const issues = status === 400 || status === 422 ? readFieldIssues(error.error) : [];
  return new GcApiError(status, detail ?? fallback, issues, error);
}

export function gcErrorMessage(error: unknown): string {
  if (error instanceof GcApiError) return error.message;
  if (error instanceof HttpErrorResponse) return gcNormalizeHttpError(error).message;
  return 'No se pudo completar la operación. Inténtalo de nuevo.';
}
