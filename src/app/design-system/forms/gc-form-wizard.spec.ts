import { TestBed } from '@angular/core/testing';
import { provideFormlyCore } from '@ngx-formly/core';
import { withFormlyMaterial } from '@ngx-formly/material';
import { GcFormWizard } from './gc-form-wizard';

describe('GcFormWizard', () => {
  it('does not advance until the current step is valid', async () => {
    await TestBed.configureTestingModule({
      imports: [GcFormWizard],
      providers: [provideFormlyCore(withFormlyMaterial())],
    }).compileComponents();

    const fixture = TestBed.createComponent(GcFormWizard);
    const model = { nombre: '' };
    fixture.componentRef.setInput('steps', [
      { id: 'datos', title: 'Datos', fields: [
        { key: 'nombre', type: 'input', props: { label: 'Nombre', required: true } },
      ] },
    ]);
    fixture.componentRef.setInput('model', model);
    fixture.componentRef.setInput('reviewFields', [{ key: 'nombre', label: 'Nombre' }]);
    fixture.detectChanges();
    await fixture.whenStable();

    const next = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.gc-form-actions button:last-child');
    expect(next).not.toBeNull();
    next?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.index()).toBe(0);

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input');
    expect(input).not.toBeNull();
    if (!input) return;
    input.value = 'Cappuccino';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    next?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.index()).toBe(1);
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
  });
});
