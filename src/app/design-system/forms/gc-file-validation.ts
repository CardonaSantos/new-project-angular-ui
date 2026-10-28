export interface GcFilePolicy {
  maxFiles: number;
  maxBytes: number;
  allowedMime: readonly string[];
}

export interface GcFileCheckResult {
  accepted: readonly File[];
  errors: readonly string[];
}

/** UI checks only; the backend must independently inspect content and size. */
export function gcCheckFiles(files: readonly File[], policy: GcFilePolicy): GcFileCheckResult {
  const accepted: File[] = [];
  const errors: string[] = [];
  for (const file of files) {
    if (accepted.length >= policy.maxFiles) {
      errors.push('Solo se permiten ' + policy.maxFiles + ' archivos.');
      break;
    }
    if (!policy.allowedMime.includes(file.type)) {
      errors.push(file.name + ': formato no permitido.');
      continue;
    }
    if (file.size <= 0 || file.size > policy.maxBytes) {
      errors.push(file.name + ': tamaño no permitido.');
      continue;
    }
    accepted.push(file);
  }
  return { accepted, errors };
}
