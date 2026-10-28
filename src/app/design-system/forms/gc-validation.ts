import { AbstractControl } from '@angular/forms';
import { z } from 'zod';

export interface GcFormIssue {
  field: string;
  message: string;
}

export interface GcValidationResult {
  valid: boolean;
  issues: readonly GcFormIssue[];
}

/** Zod is a data-boundary validator, not a replacement for Reactive Forms UX. */
export function gcValidateSchema(schema: z.ZodType, value: unknown): GcValidationResult {
  const result = schema.safeParse(value);
  if (result.success) return { valid: true, issues: [] };
  return {
    valid: false,
    issues: result.error.issues.map((issue) => ({
      field: issue.path.map(String).join('.'),
      message: issue.message,
    })),
  };
}

/** Accepts normalized backend field errors; does not presume a NestJS DTO envelope. */
export function gcApplyServerErrors(
  form: AbstractControl,
  issues: readonly GcFormIssue[],
): void {
  for (const issue of issues) {
    const control = form.get(issue.field);
    if (!control) continue;
    control.setErrors({ ...(control.errors ?? {}), server: issue.message });
    control.markAsTouched();
  }
}

export function gcFieldMessages(
  control: AbstractControl,
  labels: Readonly<Record<string, string>> = {},
): GcFormIssue[] {
  const issues: GcFormIssue[] = [];
  const visit = (current: AbstractControl, path: string): void => {
    const controls = (current as { controls?: Record<string, AbstractControl> }).controls;
    if (controls && !Array.isArray(controls)) {
      for (const [key, child] of Object.entries(controls)) visit(child, path ? path + '.' + key : key);
      return;
    }
    if (!current.invalid) return;
    const name = labels[path] ?? path;
    const errors = current.errors ?? {};
    if (errors['required']) issues.push({ field: path, message: name + ' es obligatorio.' });
    else if (errors['minlength']) issues.push({ field: path, message: name + ' es demasiado corto.' });
    else if (errors['maxlength']) issues.push({ field: path, message: name + ' excede la longitud permitida.' });
    else if (errors['email']) issues.push({ field: path, message: name + ' debe ser un correo válido.' });
    else if (errors['server']) issues.push({ field: path, message: String(errors['server']) });
    else issues.push({ field: path, message: 'Revisa ' + name + '.' });
  };
  visit(control, '');
  return issues;
}
