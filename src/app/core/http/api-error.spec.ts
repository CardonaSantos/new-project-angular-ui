import { HttpErrorResponse } from '@angular/common/http';
import { gcNormalizeHttpError, gcErrorMessage, GcApiError } from './api-error';

describe('API error messages', () => {
  it('shows NestJS validation messages to the operator', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { message: ['email must be an email', 'password should not be empty'] },
    });
    const result = gcNormalizeHttpError(error);
    expect(result.message).toContain('email must be an email');
    expect(result.message).toContain('password should not be empty');
  });

  it('preserves domain conflicts and forbidden messages', () => {
    expect(gcNormalizeHttpError(new HttpErrorResponse({
      status: 409, error: { message: 'El turno ya se encuentra cerrado' },
    })).message).toBe('El turno ya se encuentra cerrado');
    expect(gcNormalizeHttpError(new HttpErrorResponse({
      status: 403, error: { message: 'Permiso insuficiente' },
    })).message).toBe('Permiso insuficiente');
  });

  it('hides 500 internals, handles connection failure and parses field issues', () => {
    expect(gcNormalizeHttpError(new HttpErrorResponse({
      status: 500, error: { message: 'Database password leaked' },
    })).message).not.toContain('Database password');
    expect(gcNormalizeHttpError(new HttpErrorResponse({ status: 0 })).message).toContain('conectar');
    const parsed = gcNormalizeHttpError(new HttpErrorResponse({
      status: 400,
      error: { fieldErrors: [{ field: 'email', message: 'Correo inválido' }] },
    }));
    expect(parsed.fieldIssues).toEqual([{ field: 'email', message: 'Correo inválido' }]);
    expect(gcErrorMessage(new GcApiError(409, 'Duplicado'))).toBe('Duplicado');
  });
});
