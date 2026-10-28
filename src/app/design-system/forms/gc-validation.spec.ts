import { FormControl, FormGroup, Validators } from '@angular/forms';
import { z } from 'zod';
import { gcApplyServerErrors, gcFieldMessages, gcValidateSchema } from './gc-validation';

describe('Gc validation', () => {
  it('maps cross-field Zod issues to their field paths', () => {
    const schema = z.object({ cost: z.number(), price: z.number() })
      .refine((x) => x.price >= x.cost, { path: ['price'], message: 'No menor al costo' });
    const invalid = gcValidateSchema(schema, { cost: 10, price: 2 });
    expect(invalid).toEqual({ valid: false, issues: [{ field: 'price', message: 'No menor al costo' }] });
  });

  it('maps normalized server errors to touched controls without discarding existing errors', () => {
    const form = new FormGroup({ email: new FormControl('', [Validators.required]) });
    form.get('email')?.updateValueAndValidity();
    gcApplyServerErrors(form, [{ field: 'email', message: 'Correo ya registrado' }]);
    expect(form.get('email')?.errors?.['required']).toBe(true);
    expect(form.get('email')?.errors?.['server']).toBe('Correo ya registrado');
    expect(gcFieldMessages(form)[0].field).toBe('email');
  });
});
